// Checks the "Tune first" solo writer (docs/SOLO-TUNE.md, src/parts/solotunefirst.ts) on real songs, all meters:
//  - the written melody (no player): no overlaps, in range, never more than a beat of silence, the last bar one held note on its first beat;
//  - phrases of 2, 3 or 4 bars that add up to the solo; chord notes on the bars' first beats and on held notes;
//  - it sounds like a tune (src/parts/solotune.ts) in nearly every solo; the best-of-many beats one try;
//  - with Solo polish on, the same melody is dressed (the strong notes stay) and the same seed plays the same.
//   npm run solo-tunefirst-check        (N=96 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { groupStarts } from '../src/rhythm';
import { chordTones } from '../src/parts/guitar2';
import { TUNE_PASS, tuneScore } from '../src/parts/solotune';
import { QUALITIES, SCALES, chordPc } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mod = (n: number, m: number) => ((n % m) + m) % m;
const isCore = (key: number, mode: string, chord: any, m: number) => {
  if (chordTones(key, chord).includes(mod(m, 12))) return true;
  if (new Set((QUALITIES[chord.q] as readonly number[]).map((x) => x % 12)).size > 2) return false;
  const d = mod(m - chordPc(key, chord), 12);
  return (d === 3 || d === 4) && (SCALES[mode as never] as readonly number[]).includes(mod(m - key, 12));
};
const groupsHalf = (b: any) => b.start + groupStarts(b.groups).reduce((best: number, gs: number) => (Math.abs(gs - b.len / 2) < Math.abs(best - b.len / 2) ? gs : best), 0);
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `tf-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, meter, mood, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', ...(process.env.MOOD ? { soloMood: 'on' } : {}), ...extra } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.vib ?? 0}`).join('|');

const T = { solos: 0, notes: 0, overlap: 0, range: 0, overBeat: 0, endHold: 0, barStarts: 0, barStartCore: 0, strong: 0, strongCore: 0, tunes: 0, one: 0, oneTunes: 0, phrases: 0, answers: 0, by: { 2: 0, 3: 0, 4: 0 } as Record<number, number>, scoreSum: 0, oneScoreSum: 0 };
const meterStat: Record<string, { n: number; ok: number }> = {};
let dressedNotes = 0, plainNotes = 0, plainDressed = 0, keptGoals = 0, goals = 0;
for (let j = 0; j < N; j++) {
  const plain = build(j, {}), one = build(j, { soloTuneTries: 1 });
  plain.secs.forEach((sec, si) => {
    T.solos++;
    const total = sec.song.total, bars = sec.song.bars;
    const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step);
    if (hits.length < 2) return fail(`${plain.s}: ${hits.length} notes`);
    const lastBar = bars[bars.length - 1];
    const barAt = (g: number) => bars.find((b: any) => g >= b.start && g < b.start + b.len) ?? lastBar;
    const beat = (g: number) => Math.min(...barAt(g).groups);
    const chordAt = (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(total - 1, g)]].chord;
    const cSteps: number[] = sec.chords.timeline.map((e: any) => e.step);
    if (hits[0].step > beat(0)) fail(`${plain.s}: first note at ${hits[0].step}`);
    hits.forEach((h: any, k: number) => {
      T.notes++;
      const nx = hits[k + 1];
      if (nx && h.step + h.len > nx.step) { T.overlap++; fail(`${plain.s}: note at ${h.step} len ${h.len} overlaps the next at ${nx.step}`); }
      const m = h.notes[0];
      if (m < 50 || m > 86) { T.range++; fail(`${plain.s}: note ${m} out of range`); }
      // (the last bar's hold is carried into the next section and may be replaced by a pickup: track.ts)
      if (nx && h.step + h.len < lastBar.start && nx.step - (h.step + h.len) > beat(h.step)) { T.overBeat++; fail(`${plain.s}: ${nx.step - (h.step + h.len)} steps of silence after ${h.step}`); }
      const end = h.step === lastBar.start ? total : h.step + h.len;
      const half = groupsHalf(barAt(h.step));
      const strong = h.step === barAt(h.step).start || h.step === half || h.len >= beat(h.step) * 1.5;
      if (strong && h.step !== lastBar.start) { T.strong++; if (process.env.DEBUG && !([h.step, ...cSteps.filter((c) => c > h.step && c < end)].every((g) => isCore(sec.song.key, sec.song.mode, chordAt(g), m)))) console.log(`non-core strong: ${plain.s} ${plain.meter} step ${h.step} len ${h.len} midi ${m} pc ${mod(m - sec.song.key, 12)} chord ${JSON.stringify(chordAt(h.step))} barstart ${h.step === barAt(h.step).start}`); if ([h.step, ...cSteps.filter((c) => c > h.step && c < end)].every((g) => isCore(sec.song.key, sec.song.mode, chordAt(g), m))) T.strongCore++; }
      if (h.step === barAt(h.step).start && h.step !== lastBar.start) { T.barStarts++; if (isCore(sec.song.key, sec.song.mode, chordAt(h.step), m)) T.barStartCore++; }
    });
    // (the last note may be carried into the next section: the plan's end landing is the last bar's hold)
    const endL = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role === 'end').pop();
    if (!endL || endL.step !== lastBar.start) fail(`${plain.s}: the end landing is not on the last bar (${endL?.step})`);
    else T.endHold++;
    // phrases: 2 to 4 bars, adding up to the solo
    const m2 = /phrases of ([\d +]+) bars/.exec((sec.notes ?? []).join(' '));
    if (m2) {
      const ls = m2[1].split('+').map((x) => Number(x.trim()));
      T.phrases += ls.length;
      if (ls.reduce((a, b) => a + b, 0) !== bars.length) fail(`${plain.s}: phrases ${ls.join('+')} do not add up to ${bars.length} bars`);
      ls.forEach((l) => { if (bars.length > 3 && (l < 2 || l > 4)) fail(`${plain.s}: a phrase of ${l} bars`); if (T.by[l] !== undefined) T.by[l]++; });
    }
    const ctx = { bars, key: sec.song.key, chordAt };
    const t = tuneScore(sec.guitar2, ctx), t1 = tuneScore(one.secs[si].guitar2, ctx);
    T.scoreSum += t.score; T.oneScoreSum += t1.score;
    if (t.score >= TUNE_PASS) T.tunes++;
    if (t1.score >= TUNE_PASS) T.oneTunes++;
    (meterStat[plain.meter] ??= { n: 0, ok: 0 }).n++;
    if (t.score >= TUNE_PASS) meterStat[plain.meter].ok++;
    const landings = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'mid');
    plainNotes += hits.length;
    void landings;
  });
  // dressed: Solo polish on
  if (j % 3 === 0) {
    const a = build(j, { soloPolish: 'on' }), again = build(j, { soloPolish: 'on' });
    a.secs.forEach((sec, si) => {
      if (key(sec) !== key(again.secs[si])) fail(`${a.s}: not the same twice`);
      const hs = sec.guitar2.filter((h: any) => !h.mute && h.notes.length);
      dressedNotes += hs.length;
      const base = plain.secs[si].guitar2.filter((h: any) => !h.mute && h.notes.length);
      plainDressed += base.length;
      for (const l of (plain.secs[si].soloCurve?.landings ?? []).filter((x: any) => x.role !== 'mid' && x.role !== 'end')) {
        goals++;
        if (hs.some((h: any) => h.notes[h.notes.length - 1] === l.midi && Math.abs(h.step - l.step) <= 1)) keptGoals++;
      }
      void base;
    });
  }
}
const avg = (x: number) => (x / Math.max(1, T.solos)).toFixed(2);
console.log(`solos ${T.solos}, ${T.notes} notes (${(T.notes / T.solos).toFixed(0)} a solo); phrases ${T.phrases}: ${[2, 3, 4].map((l) => `${pct(T.by[l], T.phrases)}% of ${l} bars`).join(', ')}`);
console.log(`chord notes: ${pct(T.barStartCore, T.barStarts)}% of bar starts, ${pct(T.strongCore, T.strong)}% of strong places; last bar one hold ${T.endHold} of ${T.solos}`);
console.log(`as a tune: ${pct(T.tunes, T.solos)}% of solos at ${TUNE_PASS}+ (mean ${avg(T.scoreSum)}); one try only: ${pct(T.oneTunes, T.solos)}% (mean ${avg(T.oneScoreSum)})`);
console.log('by meter: ' + Object.entries(meterStat).map(([k, v]) => `${k} ${pct(v.ok, v.n)}% of ${v.n}`).join(', '));
console.log(`dressed (Solo polish): ${plainDressed ? Math.round((100 * dressedNotes) / plainDressed) : 0}% as many notes as written, strong notes kept ${pct(keptGoals, goals)}% of ${goals}`);
if (pct(T.barStartCore, T.barStarts) < 90) fail('chord notes on bar starts under 90%');
if (pct(T.strongCore, T.strong) < 85) fail('chord notes on strong places under 85%');
if (pct(T.tunes, T.solos) < (process.env.MOOD ? 80 : 85)) fail('under 85% of the solos sound like a tune');
if (T.scoreSum <= T.oneScoreSum) fail('the best of many does not beat one try');
if (pct(keptGoals, goals) < 85) fail('the player lost the strong notes');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
