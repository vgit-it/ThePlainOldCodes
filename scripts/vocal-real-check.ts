// Checks "Walk between chord notes" and "Tune pick judges real songs too" (docs/VOCAL-REAL.md: `withWalk` in src/verse/walk.ts, the real parts in src/verse/tune.ts):
//  - off is the default and changes nothing; same seed, same notes;
//  - Walk: only pitches change (the phrases, every phrase's first and last note stay; the rhythm stays in most songs: the repeated-shape rule reads the pitches, so it sometimes finds other stretches), fewer repeated notes (nearer real songs' 29%),
//    fewer chord notes on strong beats (nearer 69%, never under 60%), still in the key or on the chord, no more notes leaping, still a tune;
//  - Real-song pick (Tune pick on): nearer real songs on the three figures than the same pick without it, and still a tune by the ordinary score;
//  - the choruses of a song are still one melody.
//   npm run vocal-real-check        (N=60 songs, verse and chorus of each)
import { MAIN_METHOD, generate } from '../src/generator';
import { chordTones } from '../src/parts/guitar2';
import { SCALES } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { VOCAL_TUNE_PASS, vocalTune, REAL } from '../src/verse/tune';
import { chordsKey, chordsOf, songGrid } from '../src/verse/section';
import { voiceOf } from '../src/verse/sing';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const pc = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], s = `vr-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_METHOD, ...extra } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), keyChange: 'off' } as never).sections as any[] };
};
const sung = (secs: any[]) => secs.filter((x) => ['verse', 'chorus'].includes(x.section?.kind) && voiceOf(x));
const key = (secs: any[]) => sung(secs).map((x) => voiceOf(x)!.built.notes.map((n) => `${n.step}:${n.midi}`).join(',')).join('|');
const rhythm = (secs: any[]) => sung(secs).map((x) => voiceOf(x)!.built.notes.map((n) => `${n.step}:${n.len}`).join(',')).join('|');

interface Acc { sections: number; moves: number; same: number; leaps: number; strong: number; strongCt: number; phrases: number; early: number; offKey: number; notes: number; tune: number; pass: number }
const acc = (): Acc => ({ sections: 0, moves: 0, same: 0, leaps: 0, strong: 0, strongCt: 0, phrases: 0, early: 0, offKey: 0, notes: 0, tune: 0, pass: 0 });
function measure(a: Acc, x: any) {
  const v = voiceOf(x)!, notes = v.built.notes, phr = v.built.phrases, song = x.song, sc = SCALES[song.mode as keyof typeof SCALES] as readonly number[];
  a.sections++;
  const onChord = (n: any) => {
    const c = x.chords.timeline[x.chords.chordIdx[Math.min(song.total - 1, Math.floor(n.step))]].chord, own = chordTones(song.key, c), rootPc = mod(song.key + c.root, 12);
    return own.includes(mod(n.midi, 12)) || (new Set(own).size <= 2 && [3, 4].includes(mod(n.midi - rootPc, 12)) && sc.includes(mod(n.midi - song.key, 12)));
  };
  const grid = songGrid(x);
  for (const g of phr) {
    const p = notes.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6);
    for (let i = 1; i < p.length; i++) { a.moves++; if (p[i].midi === p[i - 1].midi) a.same++; if (Math.abs(p[i].midi - p[i - 1].midi) >= 5) a.leaps++; }
    if (p.length) { a.phrases++; const hi = Math.max(...p.map((n) => n.midi)), s0 = p[0].step, z = p[p.length - 1].step + p[p.length - 1].len; if (p.find((n) => n.midi === hi)!.step - s0 < (z - s0) / 2) a.early++; }
  }
  for (const n of notes) {
    a.notes++;
    const ct = onChord(n);
    if (!ct && !sc.includes(mod(n.midi - song.key, 12))) a.offKey++;
    if (grid.isStrong(n.step)) { a.strong++; if (ct) a.strongCt++; }
  }
  const t = vocalTune(notes, phr, { key: song.key, grid, chordAt: chordsOf(x) }).score;
  a.tune += t; if (t >= VOCAL_TUNE_PASS) a.pass++;
}
const same = (a: Acc) => a.same / Math.max(1, a.moves), chord = (a: Acc) => a.strongCt / Math.max(1, a.strong), early = (a: Acc) => a.early / Math.max(1, a.phrases);
const dist = (a: Acc) => Math.abs(same(a) - REAL.same) + Math.abs(chord(a) - REAL.chord) + Math.abs(early(a) - REAL.peak);
const describe = (name: string, a: Acc) => console.log(`${name.padEnd(22)} same note ${pc(a.same, a.moves)}% | chord notes on strong beats ${pc(a.strongCt, a.strong)}% | phrase peaks early ${pc(a.early, a.phrases)}% | leaps ${pc(a.leaps, a.moves)}% | off the key and chords ${(100 * a.offKey / Math.max(1, a.notes)).toFixed(1)}% | tune ${(a.tune / a.sections).toFixed(2)}, ${pc(a.pass, a.sections)}% pass | distance to real ${dist(a).toFixed(2)}`);

const T12 = { vocalTune: 12 };
const A = { off: acc(), walk: acc(), pick: acc(), real: acc(), both: acc() };
let defaultSame = 0, seedSame = 0, rhythmSame = 0, endsSame = 0, endsTotal = 0, chorusOk = 0, chorusTotal = 0, tot = 0;
for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { vocalWalk: undefined, vocalRealPick: undefined }), walk = build(j, { vocalWalk: true }), again = build(j, { vocalWalk: true });
  const pick = build(j, T12), real = build(j, { ...T12, vocalRealPick: true }), both = build(j, { ...T12, vocalRealPick: true, vocalWalk: true });
  tot++;
  if (key(off.secs) === key(offTrue.secs)) defaultSame++; else fail(`${off.s}: off is not the default`);
  if (key(walk.secs) === key(again.secs)) seedSame++; else fail(`${walk.s}: same seed, other notes`);
  if (rhythm(off.secs) === rhythm(walk.secs)) rhythmSame++;
  if (sung(off.secs).some((x, i) => voiceOf(x)!.built.phrases.map((g) => `${g.step}:${g.len}`).join() !== voiceOf(sung(walk.secs)[i])!.built.phrases.map((g) => `${g.step}:${g.len}`).join())) fail(`${walk.s}: Walk changed the phrases`);
  sung(walk.secs).forEach((x, i) => {
    const b = voiceOf(sung(off.secs)[i])!.built, w = voiceOf(x)!.built;
    for (const g of w.phrases) {
      const pa = b.notes.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6), pb = w.notes.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6);
      if (pa.length && pa.length === pb.length) { endsTotal++; if (pa[0].midi === pb[0].midi && pa[pa.length - 1].midi === pb[pb.length - 1].midi) endsSame++; }
    }
    // (the choruses of a song: one melody, as before)
    const cs = sung(walk.secs).filter((y) => y.section?.kind === 'chorus');
    if (x === cs[cs.length - 1] && cs.length > 1) { chorusTotal++; const m = (y: any) => voiceOf(y)!.built.notes.map((n) => `${n.step}:${n.len}`).join(','); if (cs.every((y) => chordsKey(y) !== chordsKey(x) || m(y) === m(x))) chorusOk++; }
    measure(A.walk, x); measure(A.off, sung(off.secs)[i]); measure(A.pick, sung(pick.secs)[i]); measure(A.real, sung(real.secs)[i]); measure(A.both, sung(both.secs)[i]);
  });
}
console.log(`songs ${tot}; sections ${A.off.sections}; default unchanged ${defaultSame}/${tot}; same seed same notes ${seedSame}/${tot}; Walk keeps the rhythm ${rhythmSame}/${tot} (the phrases always); phrase first and last notes kept ${pc(endsSame, endsTotal)}%; choruses alike ${chorusOk}/${chorusTotal}`);
describe('as before', A.off); describe('Walk', A.walk); describe('Tune pick (12)', A.pick); describe('Pick + real songs', A.real); describe('Pick + real + Walk', A.both);
console.log(`real songs              same note ${Math.round(100 * REAL.same)}% | chord notes on strong beats ${Math.round(100 * REAL.chord)}% | phrase peaks early ${Math.round(100 * REAL.peak)}%`);
if (defaultSame !== tot) fail('off is not the default');
if (seedSame !== tot) fail('same seed gave other notes');
if (rhythmSame < 0.75 * tot) fail('Walk changed the rhythm in too many songs');
if (endsSame !== endsTotal) fail('Walk changed a phrase\'s first or last note');
if (chorusOk !== chorusTotal) fail('the choruses are not one melody');
// Walk
if (same(A.walk) > same(A.off) - 0.06) fail('Walk: the same note again is not rarer');
if (same(A.walk) < 0.2) fail('Walk: too few repeated notes');
if (chord(A.walk) > chord(A.off) - 0.04) fail('Walk: fewer chord notes on strong beats not seen');
if (chord(A.walk) < 0.6) fail('Walk: too few chord notes on strong beats');
if (A.walk.offKey / A.walk.notes > A.off.offKey / A.off.notes + 0.01) fail('Walk: more notes off the key and chords');
if (A.walk.leaps / A.walk.moves > A.off.leaps / A.off.moves + 0.01) fail('Walk: more leaps');
if (A.walk.tune / A.walk.sections < A.off.tune / A.off.sections - 0.03) fail('Walk: the tune score fell');
if (A.walk.pass / A.walk.sections < A.off.pass / A.off.sections - 0.06) fail('Walk: fewer sections pass as a tune');
// Real-song pick
if (dist(A.real) > dist(A.pick) - 0.03) fail('Real pick: not nearer to real songs than the plain pick');
if (A.real.tune / A.real.sections < A.pick.tune / A.pick.sections - 0.03) fail('Real pick: the tune score fell');
if (A.real.pass / A.real.sections < A.pick.pass / A.pick.sections - 0.06) fail('Real pick: fewer sections pass as a tune');
if (dist(A.both) > dist(A.off) - 0.15) fail('Walk and the real pick together are not nearer to real songs');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
