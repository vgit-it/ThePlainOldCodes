// Checks "Tension notes" (docs/SOLO-HARMONY.md, step 3c: `tenseCost` in src/parts/solotunefirst.ts), Solo story on:
//  - off is the default and changes nothing; same seed, same notes; the plot is the same;
//  - the notes inside the phrases (not the strong notes at the phrase ends) follow the chord's pull: over a chord that wants to move more of them
//    are notes that want to move (the 2nd, 4th, flat 5th, flat 6th and the leading note), over home or an arrival fewer;
//  - the more a bar pulls, the more of its notes want to move (the bars' pull against the share of such notes);
//  - the leading note over a chord that wants to move goes up a semitone or steps down more often than it jumps away;
//  - it is still a tune: the pass share and the mean tune score hold; runs with and without Notes follow the chords.
//   npm run solo-tense-check        (N=96 songs; EXTRA='{"soloMood":"on"}' adds to the base options)
import { MAIN_GUITARS, generate } from '../src/generator';
import { beatAt, readHarmony } from '../src/parts/soloharmony';
import { TUNE_PASS, tuneScore } from '../src/parts/solotune';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const UNSTABLE = new Set([1, 2, 5, 6, 8, 11]);
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const pc = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
const corr = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b);
  let c = 0, va = 0, vb = 0;
  a.forEach((x, i) => { c += (x - ma) * (b[i] - mb); va += (x - ma) ** 2; vb += (b[i] - mb) ** 2; });
  return va > 1e-9 && vb > 1e-9 ? c / Math.sqrt(va * vb) : NaN;
};
const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `sn-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloStory: 'on', ...JSON.parse(process.env.EXTRA ?? '{}'), ...extra } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

type Acc = { solos: number; tenseN: number; tenseU: number; restN: number; restU: number; r: number[]; leadN: number; leadOk: number; tunes: number; score: number };
const acc = (): Acc => ({ solos: 0, tenseN: 0, tenseU: 0, restN: 0, restU: 0, r: [], leadN: 0, leadOk: 0, tunes: 0, score: 0 });
const A = { off: acc(), on: acc(), notes: acc(), both: acc() };
let same = 0, total = 0, hash = 0, plotSame = 0, plots = 0;

function measure(a: Acc, sec: any) {
  a.solos++;
  const song = sec.song, bars = song.bars, T = song.total;
  const map = readHarmony(sec.chords.timeline, T, song.mode);
  const goalAt = new Set((sec.soloCurve?.landings ?? []).map((l: any) => l.step));
  const hits = (sec.guitar2 as any[]).filter((h) => h.notes?.length && !h.mute).sort((x, y) => x.step - y.step);
  const unstable = bars.map(() => 0), count = bars.map(() => 0), pull = bars.map((b: any) => mean(Array.from({ length: b.len }, (_, i) => beatAt(map, b.start + i).pull)));
  hits.forEach((h, i) => {
    if (goalAt.has(h.step)) return;
    const b = beatAt(map, h.step), u = UNSTABLE.has(mod(h.notes[0] - song.key, 12));
    const q = bars.findIndex((bb: any) => h.step >= bb.start && h.step < bb.start + bb.len);
    if (q >= 0) { count[q]++; if (u) unstable[q]++; }
    if (b.role === 'tense') { a.tenseN++; if (u) a.tenseU++; }
    else if (b.arrival > 0 || b.role === 'home') { a.restN++; if (u) a.restU++; }
    const nx = hits[i + 1];
    if (b.role === 'tense' && mod(h.notes[0] - song.key, 12) === 11 && nx && nx.step - h.step <= 8) { a.leadN++; const d = nx.notes[0] - h.notes[0]; if (d === 1 || d === -1 || d === -2) a.leadOk++; }
  });
  if (bars.length >= 6) {
    const keep = bars.map((_: any, q: number) => q).filter((q: number) => count[q] >= 2);
    const c = corr(keep.map((q: number) => unstable[q] / count[q]), keep.map((q: number) => pull[q]));
    if (!Number.isNaN(c)) a.r.push(c);
  }
  const t = tuneScore(sec.guitar2, { bars, key: song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(T - 1, g)]].chord }).score;
  a.score += t; if (t >= TUNE_PASS) a.tunes++;
}

for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { soloStoryTense: 'off' }), on = build(j, { soloStoryTense: 'on' }), again = build(j, { soloStoryTense: 'on' });
  const notes = build(j, { soloStoryNotes: 'on' }), both = build(j, { soloStoryNotes: 'on', soloStoryTense: 'on' });
  total++;
  if (off.secs.every((sec, si) => JSON.stringify(sec.guitar2) === JSON.stringify(offTrue.secs[si].guitar2))) same++; else fail(`${off.s}: 'off' is not the default`);
  on.secs.forEach((sec, si) => {
    measure(A.on, sec); measure(A.off, off.secs[si]); measure(A.notes, notes.secs[si]); measure(A.both, both.secs[si]);
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) hash++;
    const plotOf = (s: any) => (s.notes ?? []).filter((n: string) => n.startsWith('plot (')).join('');
    plots++; if (plotOf(sec) === plotOf(off.secs[si]) && plotOf(both.secs[si]) === plotOf(notes.secs[si])) plotSame++;
  });
}
const solos = A.on.solos;
console.log(`solos ${solos}; default unchanged ${same}/${total}; same seed same notes ${solos - hash}/${solos}; the plot unchanged ${plotSame}/${plots}`);
for (const k of ['off', 'on', 'notes', 'both'] as const) {
  const a = A[k];
  console.log(`${k.padEnd(5)} (${k === 'off' ? 'as before' : k === 'on' ? 'tension notes' : k === 'notes' ? 'notes follow chords' : 'notes + tension notes'}): notes that want to move: over a chord that wants to move ${pc(a.tenseU, a.tenseN)}% of ${a.tenseN}, over home or an arrival ${pc(a.restU, a.restN)}% of ${a.restN}; pull against such notes r ${mean(a.r).toFixed(2)}; the leading note goes up or steps down ${pc(a.leadOk, a.leadN)}% of ${a.leadN}; tune ${(a.score / a.solos).toFixed(2)}, ${pc(a.tunes, a.solos)}% pass`);
}
if (hash) fail('same seed gave other notes');
for (const [base, on, name] of [[A.off, A.on, 'alone'], [A.notes, A.both, 'with notes']] as [Acc, Acc, string][]) {
  const gap = (a: Acc) => a.tenseU / Math.max(1, a.tenseN) - a.restU / Math.max(1, a.restN);
  if (gap(on) < gap(base) + 0.08) fail(`notes that want to move do not follow the chord's pull more (${name}): gap ${Math.round(100 * gap(on))} against ${Math.round(100 * gap(base))} points`);
  if (on.tenseU / on.tenseN < base.tenseU / base.tenseN + 0.04) fail(`not more notes that want to move over a chord that wants to move (${name})`);
  if (on.restU / on.restN > base.restU / base.restN) fail(`more notes that want to move over home (${name})`);
  if (mean(on.r) < mean(base.r) + 0.03) fail(`the bars' pull does not show more in the notes (${name})`);
  if (on.leadN >= 20 && on.leadOk / on.leadN < base.leadOk / base.leadN) fail(`the leading note resolves less often (${name})`);
  if (on.tunes / on.solos < base.tunes / base.solos - 0.04) fail(`fewer solos pass as a tune (${name})`);
  if (on.score / on.solos < base.score / base.solos - 0.03) fail(`the tune score fell (${name})`);
}
if (plotSame !== plots) fail('the plot changed');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
