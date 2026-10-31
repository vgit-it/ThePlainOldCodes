// Checks "Last note leads into the next section" (docs/SOLO-HARMONY.md, step 3b: `hand` in src/parts/solotunefirst.ts, `handFor` in src/track.ts), Solo story on:
//  - off is the default and changes nothing; same seed, same notes;
//  - the solo's last note (the tune's own pitch, before the bend at the bar line) is a note of the next section's first chord, or a semitone from one,
//    more often than before; at most 5% are three semitones or more away;
//  - it is still a note of the chord it is played over (as often as before), the solo is still a tune, and the story's plot is unchanged (phrases, peak);
//  - runs on its own and together with Notes follow the chords.
//   npm run solo-hand-check        (N=96 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { chordTones } from '../src/parts/guitar2';
import { TUNE_PASS, tuneScore } from '../src/parts/solotune';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mod = (n: number, m: number) => ((n % m) + m) % m;
const pc = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `sn-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on', soloStory: 'on', ...extra } as never).sections as any[] };
};
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

type Acc = { solos: number; ends: number; onTone: number; semi: number; whole: number; far: number; own: number; rootOwn: number; tunes: number; score: number };
const acc = (): Acc => ({ solos: 0, ends: 0, onTone: 0, semi: 0, whole: 0, far: 0, own: 0, rootOwn: 0, tunes: 0, score: 0 });
const A = { off: acc(), on: acc(), notes: acc(), both: acc() };
let same = 0, total = 0, hash = 0, plotSame = 0, plots = 0, solos = 0;

function measure(a: Acc, secs: any[], si: number) {
  const sec = secs[si], next = secs[si + 1];
  a.solos++;
  const song = sec.song, T = song.total;
  const t = tuneScore(sec.guitar2, { bars: song.bars, key: song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(T - 1, g)]].chord }).score;
  a.score += t; if (t >= TUNE_PASS) a.tunes++;
  const fin = [...(sec.soloCurve?.landings ?? [])].reverse().find((l: any) => l.role !== 'waypoint');
  if (!next || !fin) return;
  a.ends++;
  const tones = chordTones(next.song.key, next.chords.timeline[0].chord);
  const near = Math.min(...tones.map((x: number) => { const d = mod(fin.midi - x, 12); return Math.min(d, 12 - d); }));
  if (near === 0) a.onTone++; else if (near === 1) a.semi++; else if (near === 2) a.whole++; else a.far++;
  // (still a note of the chord it is played over)
  // (over a two-note chord, a power chord, the key's own 3rd counts too, as in the writer)
  const oc = sec.chords.timeline[sec.chords.chordIdx[Math.min(T - 1, fin.step + Math.max(0, fin.len - 1))]].chord;
  const own = chordTones(song.key, oc), rootPc = mod(song.key + oc.root, 12);
  if (own.includes(mod(fin.midi, 12)) || (new Set(own).size <= 2 && [3, 4].includes(mod(fin.midi - rootPc, 12)))) a.own++;
}

for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { soloStoryHand: 'off' }), on = build(j, { soloStoryHand: 'on' }), again = build(j, { soloStoryHand: 'on' });
  const notes = build(j, { soloStoryNotes: 'on' }), both = build(j, { soloStoryNotes: 'on', soloStoryHand: 'on' });
  total++;
  if (off.secs.every((sec, si) => JSON.stringify(sec.guitar2) === JSON.stringify(offTrue.secs[si].guitar2))) same++; else fail(`${off.s}: 'off' is not the default`);
  on.secs.forEach((sec, si) => {
    if (!sec.section?.solo || !sec.soloCurve?.landings) return;
    solos++;
    measure(A.on, on.secs, si); measure(A.off, off.secs, si); measure(A.notes, notes.secs, si); measure(A.both, both.secs, si);
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) hash++;
    const plotOf = (s: any) => (s.notes ?? []).filter((n: string) => n.startsWith('plot (')).join('');
    plots++; if (plotOf(sec) === plotOf(off.secs[si]) && plotOf(both.secs[si]) === plotOf(notes.secs[si])) plotSame++;
  });
}
console.log(`solos ${solos}; default unchanged ${same}/${total}; same seed same notes ${solos - hash}/${solos}; the plot unchanged ${plotSame}/${plots}`);
for (const k of ['off', 'on', 'notes', 'both'] as const) {
  const a = A[k];
  console.log(`${k.padEnd(5)} (${k === 'off' ? 'as before' : k === 'on' ? 'hand-over' : k === 'notes' ? 'notes follow chords' : 'notes + hand-over'}): ${a.ends} ends: on a note of the next chord ${pc(a.onTone, a.ends)}%, a semitone off ${pc(a.semi, a.ends)}%, a whole step ${pc(a.whole, a.ends)}%, further ${pc(a.far, a.ends)}%; a note of its own chord ${pc(a.own, a.ends)}%; sounds like a tune: mean ${(a.score / a.solos).toFixed(2)}, ${pc(a.tunes, a.solos)}% pass`);
}
if (hash) fail('same seed gave other notes');
const close = (a: Acc) => (a.onTone + a.semi) / Math.max(1, a.ends);
for (const [base, hand, name] of [[A.off, A.on, 'alone'], [A.notes, A.both, 'with notes']] as [Acc, Acc, string][]) {
  if (hand.ends >= 30 && close(hand) < close(base) + 0.12) fail(`the last note is not close to the next chord more often (${name})`);
  if (hand.far / Math.max(1, hand.ends) > 0.05) fail(`a last note is three semitones or more from the next chord too often (${name}): ${pc(hand.far, hand.ends)}%`);
  if (hand.own / hand.ends < base.own / base.ends - 0.03) fail(`the last note is less often a note of its own chord (${name}): ${pc(hand.own, hand.ends)}% against ${pc(base.own, base.ends)}%`);
  if (hand.tunes / hand.solos < base.tunes / base.solos - 0.04) fail(`fewer solos pass as a tune (${name})`);
  if (hand.score / hand.solos < base.score / base.solos - 0.03) fail(`the tune score fell (${name})`);
}
if (plotSame !== plots) fail('the plot changed');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
