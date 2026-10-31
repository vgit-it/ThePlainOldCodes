// Checks the chord-story reader (docs/SOLO-HARMONY.md, src/parts/soloharmony.ts) and measures, as a baseline, how the
// solo writer "Tune first" lines up with the story its chords tell:
//  - the reader on known progressions (I V vi IV, i bVI bVII i, a loop that ends on V, a deceptive move);
//  - on real solos: the mix of roles, how many loop, how many arrivals and twists, how many end open;
//  - the baseline: where the climax lands (role, pull), whether calls end on a chord that waits and answers on home,
//    and whether the energy follows the chords' pull and the section's tension.
//   npm run solo-harmony-check        (N=96 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { beatAt, readHarmony, type HarmonyRole } from '../src/parts/soloharmony';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const corr = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
};

// ---- the reader on known progressions
const roles = (mode: any, ch: [number, string][], bars = 2) => readHarmony(ch.map(([root, q], i) => ({ step: i * bars * 16, chord: { root, q: q as never } })), ch.length * bars * 16, mode);
{
  const a = roles('major', [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']]);
  if (a.beats.map((b) => b.role).join() !== 'home,tense,rest,away') fail(`I V vi IV read as ${a.beats.map((b) => b.role)}`);
  if (a.loop !== 0) fail('I V vi IV once is not a loop');
  const b = roles('minor', [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']]);
  if (b.beats[3].arrival <= 0) fail('i bVI bVII i: the last chord is not an arrival');
  if (b.beats.map((x) => x.role).join() !== 'home,rest,away,home') fail(`i bVI bVII i read as ${b.beats.map((x) => x.role)}`);
  const c = roles('major', [[0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min']]);
  if (!c.beats[3].twist) fail('V to vi is not a twist');
  const d = readHarmony([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ step: i * 16, chord: { root: [0, 5, 7, 5][i % 4], q: 'maj' as never } })), 128, 'major');
  if (d.loop !== 64 || d.loops !== 2) fail(`a 4-chord loop twice: loop ${d.loop}, ${d.loops}x`);
  const e = roles('major', [[0, 'maj'], [5, 'maj'], [7, 'maj']]);
  if (!e.endsOpen) fail('a section ending on V is not open');
  const f = readHarmony([{ step: 0, chord: { root: 0, q: 'add9' } }, { step: 16, chord: { root: 0, q: 'add9' } }], 32, 'major');
  if (f.beats.length !== 1) fail('the same chord twice should be one');
}

// ---- real solos
const build = (j: number) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `tf-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, mood, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on' } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const R: Record<HarmonyRole, number> = { home: 0, rest: 0, away: 0, tense: 0, lift: 0 };
const T = { solos: 0, loops: 0, arrivals: 0, twists: 0, open: 0, beats: 0, climax: 0, climaxRole: { ...R }, climaxArr: 0, climaxPull: 0, callN: 0, callWait: 0, ansN: 0, ansHome: 0, callPull: 0, ansPull: 0, timePull: 0, timeHome: 0, arrivalsHit: 0, arrivalsTotal: 0, tenseTop: 0 };
const timeRole = { ...R };
const cEnergyPull: number[] = [], cEnergyTension: number[] = [], cPullTension: number[] = [];
let dull = 0;
for (let j = 0; j < N; j++) {
  for (const sec of build(j).secs) {
    T.solos++;
    const total = sec.song.total;
    const map = readHarmony(sec.chords.timeline, total, sec.song.mode);
    T.beats += map.beats.length;
    if (map.loop) T.loops++;
    if (map.endsOpen) T.open++;
    T.arrivals += map.beats.filter((b) => b.arrival > 0).length;
    T.twists += map.beats.filter((b) => b.twist).length;
    if (map.beats.every((b) => b.role === 'home')) dull++;
    for (const b of map.beats) timeRole[b.role] += b.len;
    T.timePull += mean(Array.from({ length: Math.floor(total / 4) }, (_, i) => beatAt(map, i * 4).pull));
    T.timeHome += pct(Array.from({ length: Math.floor(total / 4) }, (_, i) => beatAt(map, i * 4).role === 'home' ? 1 : 0).reduce((a, b) => a + b, 0), Math.floor(total / 4)) / 100;
    const lands = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'mid');
    for (const l of lands) {
      const b = beatAt(map, l.step);
      if (l.role === 'climax') { T.climax++; T.climaxRole[b.role]++; T.climaxPull += b.pull; if (b.arrival > 0 && l.step - b.step < 16) T.climaxArr++; }
      if (l.role === 'call') { T.callN++; T.callPull += b.pull; if (b.pull >= 0.4) T.callWait++; }
      if (l.role === 'answer' || l.role === 'end') { T.ansN++; T.ansPull += b.pull; if (b.role === 'home') T.ansHome++; }
    }
    for (const b of map.beats.filter((x) => x.arrival > 0)) { T.arrivalsTotal++; if (lands.some((l: any) => l.step >= b.step && l.step < b.step + 8)) T.arrivalsHit++; }
    // the energy by bar against the pull of the chords and the section's tension
    const bars = sec.song.bars;
    const eBar = bars.map((b: any) => mean(sec.soloCurve.energy.slice(b.start, b.start + b.len)));
    const pBar = bars.map((b: any) => mean(Array.from({ length: b.len }, (_, i) => beatAt(map, b.start + i).pull)));
    const tBar = sec.section.tension as number[];
    const c1 = corr(eBar, pBar), c2 = corr(eBar, tBar), c3 = corr(pBar, tBar);
    if (!Number.isNaN(c1)) cEnergyPull.push(c1);
    if (!Number.isNaN(c2)) cEnergyTension.push(c2);
    if (!Number.isNaN(c3)) cPullTension.push(c3);
  }
}
const tt = Object.values(timeRole).reduce((a, b) => a + b, 0);
console.log(`solos ${T.solos}, ${(T.beats / T.solos).toFixed(1)} chords a solo; chord loops ${pct(T.loops, T.solos)}%, end open ${pct(T.open, T.solos)}%, ${(T.arrivals / T.solos).toFixed(1)} arrivals and ${(T.twists / T.solos).toFixed(1)} twists a solo, all-home solos ${dull}`);
console.log('time on each role: ' + Object.entries(timeRole).map(([k, v]) => `${k} ${pct(v, tt)}%`).join(', '));
console.log(`baseline, climax (${T.climax}): on ${Object.entries(T.climaxRole).map(([k, v]) => `${k} ${pct(v, T.climax)}%`).join(', ')}; mean pull ${(T.climaxPull / Math.max(1, T.climax)).toFixed(2)} (the solo's own mean ${(T.timePull / T.solos).toFixed(2)}); in the first bar of an arrival ${pct(T.climaxArr, T.climax)}%`);
console.log(`baseline, calls end on a waiting chord (pull .4+) ${pct(T.callWait, T.callN)}% (mean pull ${(T.callPull / Math.max(1, T.callN)).toFixed(2)}); answers and the end land on home ${pct(T.ansHome, T.ansN)}% (mean pull ${(T.ansPull / Math.max(1, T.ansN)).toFixed(2)}); home takes ${pct(timeRole.home, tt)}% of the time`);
console.log(`baseline, a landing within half a bar of an arrival ${pct(T.arrivalsHit, T.arrivalsTotal)}% of ${T.arrivalsTotal}`);
console.log(`baseline, the energy curve against the chords' pull: r ${mean(cEnergyPull).toFixed(2)}; against the section's tension: r ${mean(cEnergyTension).toFixed(2)} (the chords' pull against the tension: r ${mean(cPullTension).toFixed(2)})`);
if (pct(T.loops, T.solos) === 0) fail('no solo has a chord loop (the loop read may be broken)');
if (T.arrivals === 0) fail('no arrivals found in any solo');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
