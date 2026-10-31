// Checks the Story score (docs/SOLO-HARMONY.md, step 4: `storyFit` in src/parts/solotunefirst.ts), Solo story on:
//  - off is the default and changes nothing; same seed, same notes; the plot is the same (the twelve versions are the same, only the pick differs);
//  - the picked version tells the plot better, measured on the notes that are played (not by the score itself):
//    the bars' mean height follows the plot's energy, the solo's highest note is in the peak phrase, the peak's strong note stands above the others (not less than before: the plot sets that gap),
//    the phrase ends fit their chords (a call on a chord that wants to move leans, an answer on home is the root or the 3rd);
//  - it is still a tune: the pass share and the mean tune score hold;
//  - runs with and without Notes follow the chords.
//   npm run solo-story-score-check        (N=96 songs; EXTRA='{"soloMood":"on"}' adds to the base options.
//   With Solo mood on the writer ranks its versions by a mood-aware tune score this check does not know, so the tune figures here drift a little more)
import { MAIN_GUITARS, generate } from '../src/generator';
import { beatAt, readHarmony } from '../src/parts/soloharmony';
import { TUNE_PASS, tuneScore } from '../src/parts/solotune';
import { chordPc } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
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

type Acc = { solos: number; r: number[]; topIn: number; topN: number; gap: number[]; callN: number; callLean: number; restN: number; restOk: number; tunes: number; score: number };
const acc = (): Acc => ({ solos: 0, r: [], topIn: 0, topN: 0, gap: [], callN: 0, callLean: 0, restN: 0, restOk: 0, tunes: 0, score: 0 });
const A = { off: acc(), on: acc(), notes: acc(), both: acc() };
let same = 0, total = 0, hash = 0, plotSame = 0, plots = 0;

function measure(a: Acc, sec: any) {
  a.solos++;
  const song = sec.song, bars = song.bars, T = song.total;
  const map = readHarmony(sec.chords.timeline, T, song.mode);
  const hits = (sec.guitar2 as any[]).filter((h) => h.notes?.length && !h.mute);
  const lands = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'mid' && l.role !== 'waypoint');
  // the build
  if (bars.length >= 6) {
    const eBar = bars.map((b: any) => mean(sec.soloCurve.energy.slice(b.start, b.start + b.len)));
    const played = bars.map((b: any) => mean(hits.filter((h) => h.step >= b.start && h.step < b.start + b.len).map((h) => h.notes[0])));
    const keep = played.map((v: number, q: number) => (Number.isNaN(v) ? -1 : q)).filter((q: number) => q >= 0);
    const c = corr(keep.map((q: number) => played[q]), keep.map((q: number) => eBar[q]));
    if (!Number.isNaN(c)) a.r.push(c);
  }
  // the peak: the highest note is in the peak phrase; the peak's strong note stands above the other phrases'
  const cl = lands.find((l: any) => l.role === 'climax');
  const m = /phrases of ([\d +]+) bars/.exec((sec.notes ?? []).join(' '));
  const ls = m ? m[1].split('+').map((v: string) => Number(v.trim())) : [];
  if (cl && ls.length > 1) {
    let b0 = 0, S = 0, E = T;
    for (const n of ls) { const s0 = bars[b0].start, e0 = b0 + n >= bars.length ? T : bars[b0 + n].start; if (cl.step >= s0 && cl.step < e0) { S = s0; E = e0; } b0 += n; }
    const top = Math.max(...hits.map((h) => h.notes[0])), at = hits.find((h) => h.notes[0] === top)!;
    a.topN++; if (at.step >= S && at.step < E) a.topIn++;
    const others = lands.filter((l: any) => l !== cl).map((l: any) => l.midi);
    if (others.length) a.gap.push(cl.midi - Math.max(...others));
  }
  // the ends
  for (const l of lands) {
    const b = beatAt(map, Math.min(T - 1, l.step + Math.max(0, l.len - 1)));
    if (beatAt(map, l.step) !== b) continue;
    const d = mod(l.midi - chordPc(song.key, b.chord), 12);
    const third = d === 3 || d === 4, lean = third || d === 10 || d === 11 || ((b.chord.q === 'sus4' || b.chord.q === 'sus2') && (d === 5 || d === 2));
    if (b.role === 'tense' && l.role === 'call') { a.callN++; if (lean) a.callLean++; }
    else if ((b.arrival > 0 || b.role === 'home') && (l.role === 'answer' || l.role === 'end')) { a.restN++; if (d === 0 || third) a.restOk++; }
  }
  const t = tuneScore(sec.guitar2, { bars, key: song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(T - 1, g)]].chord }).score;
  a.score += t; if (t >= TUNE_PASS) a.tunes++;
}

for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { soloStoryScore: 'off' }), on = build(j, { soloStoryScore: 'on' }), again = build(j, { soloStoryScore: 'on' });
  const notes = build(j, { soloStoryNotes: 'on' }), both = build(j, { soloStoryNotes: 'on', soloStoryScore: 'on' });
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
  console.log(`${k.padEnd(5)} (${k === 'off' ? 'as before' : k === 'on' ? 'story score' : k === 'notes' ? 'notes follow chords' : 'notes + story score'}): height follows the plot r ${mean(a.r).toFixed(2)} (${a.r.length}) | highest note in the peak phrase ${pc(a.topIn, a.topN)}% of ${a.topN}; peak above the others by ${mean(a.gap).toFixed(1)} semitones | calls on a chord that wants to move lean ${pc(a.callLean, a.callN)}% of ${a.callN}; answers on home root or 3rd ${pc(a.restOk, a.restN)}% of ${a.restN} | tune ${(a.score / a.solos).toFixed(2)}, ${pc(a.tunes, a.solos)}% pass`);
}
if (hash) fail('same seed gave other notes');
for (const [base, on, name] of [[A.off, A.on, 'alone'], [A.notes, A.both, 'with notes']] as [Acc, Acc, string][]) {
  if (mean(on.r) < mean(base.r) + 0.02) fail(`the height does not follow the plot more (${name})`);
  if (on.topN >= 30 && on.topIn / on.topN < base.topIn / base.topN + 0.03) fail(`the highest note is not in the peak phrase more often (${name})`);
  if (mean(on.gap) < mean(base.gap) - 0.5) fail(`the peak does not stand out more (${name})`);
  if (on.restN >= 30 && on.restOk / on.restN < base.restOk / base.restN - 0.02) fail(`answers on home fit their chord less (${name})`);
  if (on.callN >= 15 && on.callLean / on.callN < base.callLean / base.callN - 0.02) fail(`calls on a chord that wants to move lean less (${name})`);
  if (on.tunes / on.solos < base.tunes / base.solos - 0.04) fail(`fewer solos pass as a tune (${name})`);
  if (on.score / on.solos < base.score / base.solos - 0.03) fail(`the tune score fell (${name})`);
}
if (plotSame !== plots) fail('the plot changed');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
