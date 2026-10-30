// Checks the feel of the Solo expression (docs/SOLO-EXPRESSION.md, "Feel: 32nds, bursts, muted notes, pre-bends"): Tune first solos with Solo expression on,
// all genres, moods, meters and tempos (with recast, echo and bend dials on too):
//  - above 100 bpm no run of 3 or more 32nds in a row (a pair at the start or the end of a run of 16ths is fine), outside a burst;
//  - the burst (a bar or two of palm-muted notes, `chug`): never in pop or funk, rare in rock, grunge and hard rock, most in metal and angry, at most one per solo,
//    8 to 40 steps long, never over a goal note, at a speed the hand can play (50 ms between muted notes);
//  - ghost notes (dead, muted) sit inside runs and never replace the tune's notes; pre-bends let down and minor-third bends can be heard;
//  - slides from note to note (art `slide`): a fret to five apart, the note before long enough, the two follow on; bends into the next note (pushed up or let down on its beat);
//  - the same seed gives the same notes.
//   npm run solo-feel-check        (N=120 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 120);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `feel-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  const secs = (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloExpress: 'on', soloRecast: 'on', soloEcho: 'on', soloBends: 'dials', ...extra } as never).sections as any[]).filter((x) => x.section?.solo);
  return { s, genre, mood, secs };
};
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.shift ?? 0}:${h.len}:${h.notes.join('.')}:${h.mute ?? ''}:${h.chug ? 1 : 0}:${h.bend ?? 0}:${h.unbend ?? 0}:${h.lateBend ?? 0}`).join('|');

const T = { solos: 0, fast: 0, run3: 0, run3Slow: 0, pairs: 0, slides: 0, slideSolos: 0, slideDist: [0, 0, 0, 0, 0, 0], pushNext: 0, fallNext: 0, burstSolos: 0, burstOver1: 0, chug: 0, chugSlow: 0, ghosts: 0, ghostSolos: 0, preRel: 0, minor3: 0, hash: 0, bursts32: 0, bursts16: 0, burstLens: [] as number[] };
const burstBy: Record<string, [number, number]> = {}, burstMood: Record<string, [number, number]> = {}, ghostBy: Record<string, [number, number]> = {};
const bump = (m: Record<string, [number, number]>, k: string, hit: boolean) => { const v = (m[k] ??= [0, 0]); v[1]++; if (hit) v[0]++; };
for (let j = 0; j < N; j++) {
  const a = build(j, {}), again = build(j, {});
  a.secs.forEach((sec, si) => {
    T.solos++;
    const song = sec.song, s16 = 15000 / song.bpm;
    const all: any[] = [...sec.guitar2].sort((x, y) => (x.step + (x.shift ?? 0)) - (y.step + (y.shift ?? 0)));
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) T.hash++;
    const h = all.filter((x) => !x.mute && x.notes.length);
    // 32nds in a row (not in a burst)
    let run = 0, maxRun = 0;
    for (const x of h) {
      if (x.len <= 0.51 && !x.chug) { run++; T.fast++; maxRun = Math.max(maxRun, run); } else run = 0;
    }
    if (maxRun >= 3) { if (song.bpm > 100) { T.run3++; fail(`${a.s}: ${maxRun} 32nds in a row at ${song.bpm} bpm`); } else T.run3Slow++; }
    // pairs
    run = 0;
    for (let k = 0; k <= h.length; k++) { const q = k < h.length && h[k].len <= 0.51 && !h[k].chug; if (q) run++; else { if (run === 2) T.pairs++; run = 0; } }
    // burst
    const chug = h.filter((x) => x.chug);
    const steps = chug.length ? (chug[chug.length - 1].step + chug[chug.length - 1].len) - chug[0].step : 0;
    const burst = chug.length >= 8;
    bump(burstBy, a.genre, burst); bump(burstMood, a.mood, burst);
    if (burst) {
      T.burstSolos++; T.chug += chug.length; T.burstLens.push(Math.round(steps));
      if (s16 * 0.5 >= 52) T.bursts32++; else T.bursts16++;
      // one burst: the muted notes all sit in one stretch
      const gaps = chug.slice(1).filter((x, k) => x.step - (chug[k].step + chug[k].len) > 8).length;
      if (gaps) { T.burstOver1++; fail(`${a.s}: more than one burst in a solo`); }
      if (steps < 7.5 || steps > 41) fail(`${a.s}: burst of ${steps.toFixed(1)} steps`);
      if (a.genre === 'pop' || a.genre === 'funk') fail(`${a.s}: a burst in ${a.genre}`);
      // the goal notes inside the burst's time are not muted
      for (const g of (sec.soloCurve?.landings ?? []).filter((l: any) => ['call', 'answer', 'climax', 'end'].includes(l.role))) {
        const at = h.find((x) => Math.abs(x.step + (x.shift ?? 0) - g.step) < 1e-6);
        if (at?.chug) fail(`${a.s}: a goal note at ${g.step} is muted`);
      }
    }
    for (let k = 1; k < chug.length; k++) {
      const ms = ((chug[k].step + (chug[k].shift ?? 0)) - (chug[k - 1].step + (chug[k - 1].shift ?? 0))) * s16;
      if (ms > 0 && ms < 50 - 1e-6) { T.chugSlow++; fail(`${a.s}: muted notes ${ms.toFixed(0)} ms apart`); }
    }
    // ghost notes
    const ghosts = all.filter((x) => x.mute === 'dead' && x.len <= 2.01);
    T.ghosts += ghosts.length; if (ghosts.length) T.ghostSolos++;
    bump(ghostBy, a.genre, ghosts.length > 0);
    for (const g of ghosts) {
      const before = h.filter((x) => x.step + (x.shift ?? 0) < g.step - 1e-6).pop(), after = h.find((x) => x.step + (x.shift ?? 0) > g.step + 1e-6);
      if (!before || !after) fail(`${a.s}: a ghost note at ${g.step} with no note beside it`);
    }
    // slides from note to note
    let slides = 0;
    h.forEach((x, k) => {
      if (x.art !== 'slide' || k === 0) return;
      const pv = h[k - 1], dist = Math.abs(x.notes[0] - pv.notes[0]);
      slides++; T.slideDist[Math.min(5, dist)]++;
      if (dist < 1 || dist > 5) fail(`${a.s}: slide of ${dist} semitones at ${x.step} (${sec.song.bpm} bpm, slide field ${x.slide ?? '-'}, bend ${x.bend ?? '-'})`);
      if (x.step + (x.shift ?? 0) - (pv.step + (pv.shift ?? 0) + pv.len) > 0.51) fail(`${a.s}: a slide at ${x.step} after a gap`);
      if (pv.len * s16 < 70) fail(`${a.s}: a slide at ${x.step} from a note of ${(pv.len * s16).toFixed(0)} ms`);
    });
    T.slides += slides; if (slides) T.slideSolos++;
    // bends
    T.pushNext += h.filter((x) => x.lateBend && x.bendAt !== undefined).length;
    T.fallNext += h.filter((x) => x.unbend && !x.bend && x.bendAt !== undefined).length;
    T.preRel += h.filter((x) => x.unbend && !x.bend).length;
    T.minor3 += h.filter((x) => x.bend === 3 || x.lateBend === 3).length;
  });
}
const row = (m: Record<string, [number, number]>) => Object.entries(m).map(([k, v]) => `${k} ${pct(v[0], v[1])}%`).join(', ');
console.log(`solos ${T.solos}; 32nds ${T.fast}; pairs ${T.pairs}`);
console.log(`3+ 32nds in a row: above 100 bpm ${T.run3}; at 100 or under ${T.run3Slow} solos (allowed)`);
console.log(`bursts: ${T.burstSolos} solos (${pct(T.burstSolos, T.solos)}%); 32nds ${T.bursts32}, 16ths (tempo too quick) ${T.bursts16}; lengths ${T.burstLens.sort((a, b) => a - b).join(' ')}`);
console.log(`bursts by genre: ${row(burstBy)}`);
console.log(`bursts by mood: ${row(burstMood)}`);
console.log(`ghost notes ${T.ghosts} in ${T.ghostSolos} solos; by genre ${row(ghostBy)}`);
console.log(`slides note to note ${T.slides} in ${T.slideSolos} solos (a fret apart ${T.slideDist[1]}, 2: ${T.slideDist[2]}, 3: ${T.slideDist[3]}, 4: ${T.slideDist[4]}, 5: ${T.slideDist[5]}); bends timed to a beat: pushed up ${T.pushNext}, let down ${T.fallNext}`);
console.log(`pre-bends let down ${T.preRel}; minor-third bends ${T.minor3}`);
if (T.hash) fail(`${T.hash} solos differ with the same seed`);
console.log(bad ? `${bad} problems` : 'all good');
process.exit(bad ? 1 : 0);
