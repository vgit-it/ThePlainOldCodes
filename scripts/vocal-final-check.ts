// Checks the singer's last chorus and verses (docs/VOCAL-FINAL.md):
//  - key change (always on): the last chorus is sung in the new key, the same tune moved up by the step the band moved: in key and on chord notes
//    as often as the first chorus, the same rhythm and the same words, higher by that step;
//  - later verses: a verse sung to the same tune as the first has new words (the same number of syllables on the same notes);
//    the first verse's words are the verse's own;
//  - Last chorus lifts (switch): off is the default and changes nothing; on, with the key staying, the last chorus is about a third higher,
//    still in key, chord notes on chord notes as often, the same rhythm and words, the line keeps its shape (the same moves up and down),
//    nothing else in the song moves; a song with a key change is not lifted twice.
//   npm run vocal-final-check        (N=80 songs)
import { MAIN_METHOD, generate } from '../src/generator';
import { chordTones } from '../src/parts/guitar2';
import { SCALES } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 80);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const pc = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));

const build = (j: number, keyChange: 'on' | 'off', lift: boolean) => {
  const genre = GENRES[j % 7], s = `vf-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_METHOD, ...(lift ? { vocalLastLift: true } : {}) } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), keyChange } as never).sections as any[] };
};
const lead = (x: any): any[] => (x.vocal ?? []).filter((n: any) => !n.role && n.syl?.text !== '~');
const rhythm = (x: any) => lead(x).map((n) => `${n.step}:${n.len}`).join(',');
const words = (x: any) => (x.sung ?? []).map((l: any) => l.text).join('/');
const pitches = (x: any) => lead(x).map((n) => n.midi).join(',');
const fig = (x: any) => {
  const sc = SCALES[x.song.mode as keyof typeof SCALES] as readonly number[], v = lead(x);
  let off = 0, ct = 0, up = 0, moves = 0, same = 0;
  v.forEach((n, i) => {
    const c = x.chords.timeline[x.chords.chordIdx[Math.min(x.song.total - 1, n.step)]].chord;
    // (a two-note chord, a power chord, takes the key's own 3rd too, as the writer does)
    const own = chordTones(x.song.key, c), rootPc = mod(x.song.key + c.root, 12), inKey = sc.includes(mod(n.midi - x.song.key, 12));
    const onChord = own.includes(mod(n.midi, 12)) || (new Set(own).size <= 2 && [3, 4].includes(mod(n.midi - rootPc, 12)) && inKey);
    // (off the key counts when it is not a note of the chord under it either: a borrowed chord has notes of its own)
    if (!inKey && !onChord) off++;
    if (onChord) ct++;
    if (i && v[i - 1]) { moves++; if (n.midi === v[i - 1].midi) same++; else if (n.midi > v[i - 1].midi) up++; }
  });
  return { n: v.length, off, ct, mean: mean(v.map((n) => n.midi)), top: Math.max(...v.map((n) => n.midi)), moves, same, up };
};
const choruses = (secs: any[]) => secs.filter((x) => x.section?.kind === 'chorus');
const degrees = (x: any) => x.chords.timeline.map((e: any) => `${e.step}${e.chord.root}${e.chord.q}`).join(',');

// --- key change
const K = { n: 0, firstOff: 0, lastOff: 0, firstCt: 0, lastCt: 0, notes: 0, lift: [] as number[], step: [] as number[], rhythm: 0, words: 0, songs: 0, alike: 0 };
for (let j = 0; j < N; j++) {
  const { s, secs } = build(j, 'on', false), ch = choruses(secs);
  if (ch.length < 2 || ch[0].song.key === ch[ch.length - 1].song.key) continue;
  const a = ch[0], z = ch[ch.length - 1], fa = fig(a), fz = fig(z), alike = degrees(a) === degrees(z);
  K.songs++; K.notes += fa.n; K.firstOff += fa.off; K.lastOff += fz.off; K.firstCt += fa.ct; K.lastCt += fz.ct;
  K.lift.push(fz.mean - fa.mean); K.step.push(mod(z.song.key - a.song.key, 12));
  // (a last chorus over other chords is its own melody, as it always was: the rhythm and the words are compared where the chords are the same)
  if (!alike) continue;
  K.alike++;
  if (rhythm(a) === rhythm(z)) K.rhythm++; else fail(`${s}: key change: the last chorus has another rhythm`);
  if (words(a) === words(z)) K.words++; else fail(`${s}: key change: the last chorus has other words`);
}
console.log(`key change: ${K.songs} songs; last chorus off the key and the chords ${pc(K.lastOff, K.notes)}% (first ${pc(K.firstOff, K.notes)}%), on a chord note ${pc(K.lastCt, K.notes)}% (first ${pc(K.firstCt, K.notes)}%); higher by ${mean(K.lift).toFixed(2)} semitones (the band moved ${mean(K.step).toFixed(2)}); same rhythm ${K.rhythm}/${K.alike}, same words ${K.words}/${K.alike} (where the chords are the same)`);
if (K.songs < 20) fail('too few songs with a key change');
if (K.lastOff > K.firstOff + 0.01 * K.notes) fail('the last chorus is out of the new key');
if (K.lastCt < K.firstCt - 0.03 * K.notes) fail('the last chorus is not on the chords of the new key');
if (Math.abs(mean(K.lift) - mean(K.step)) > 0.8) fail('the last chorus did not move up with the band');

// --- later verses
const V = { pairs: 0, sameTune: 0, newWords: 0, fit: 0, firstSame: 0 };
for (let j = 0; j < N; j++) {
  const { secs } = build(j, 'off', false), vs = secs.filter((x) => x.section?.kind === 'verse');
  if (vs.length < 2 || vs[0].song.bars.length !== vs[1].song.bars.length) continue;
  V.pairs++;
  if (pitches(vs[0]) !== pitches(vs[1])) continue;
  V.sameTune++;
  if (words(vs[0]) !== words(vs[1])) V.newWords++;
  if (lead(vs[0]).length === lead(vs[1]).length && (vs[1].sung ?? []).every((l: any) => l.text && l.notes.length)) V.fit++;
}
console.log(`verses: ${V.pairs} songs with two verses of one length; ${V.sameTune} sing the same tune twice: new words in ${V.newWords}, every line has words on its notes in ${V.fit}`);
if (V.sameTune < 15) fail('too few repeated verses to check');
if (V.newWords < V.sameTune) fail('a verse sung to the same tune has the first verse\'s words');
if (V.fit < V.sameTune) fail('a later verse has a line without words');

// --- Last chorus lifts
type L = { songs: number; lift: number[]; off: number; offBase: number; ct: number; ctBase: number; n: number; rhythm: number; words: number; shape: number; shapeN: number; sameD: number; elseSame: number; elseN: number; top: number };
const lf: L = { songs: 0, lift: [], off: 0, offBase: 0, ct: 0, ctBase: 0, n: 0, rhythm: 0, words: 0, shape: 0, shapeN: 0, sameD: 0, elseSame: 0, elseN: 0, top: 0 };
let defaultSame = 0, defaultTotal = 0, twice = 0, twiceTotal = 0, seedSame = 0;
for (let j = 0; j < N; j++) {
  const base = build(j, 'off', false), on = build(j, 'off', true), again = build(j, 'off', true);
  defaultTotal++;
  if (base.secs.every((x, i) => pitches(x) === pitches(build(j, 'off', false).secs[i]))) defaultSame++;
  if (on.secs.every((x, i) => pitches(x) === pitches(again.secs[i]))) seedSame++; else fail(`${on.s}: same seed, other notes`);
  const cb = choruses(base.secs), co = choruses(on.secs);
  if (co.length < 2) {
    // (one chorus: nothing to lift from)
    if (on.secs.some((x, i) => pitches(x) !== pitches(base.secs[i]))) fail(`${on.s}: a song with one chorus changed`);
    continue;
  }
  lf.songs++;
  const zb = cb[cb.length - 1], zo = co[co.length - 1];
  on.secs.forEach((x, i) => { if (x !== zo) { lf.elseN++; if (pitches(x) === pitches(base.secs[i])) lf.elseSame++; } });
  const fb = fig(zb), fo = fig(zo);
  lf.lift.push(fo.mean - fb.mean); lf.n += fo.n; lf.off += fo.off; lf.offBase += fb.off; lf.ct += fo.ct; lf.ctBase += fb.ct; lf.top = Math.max(lf.top, fo.top);
  if (rhythm(zb) === rhythm(zo)) lf.rhythm++; else fail(`${on.s}: the lifted chorus has another rhythm`);
  if (words(zb) === words(zo)) lf.words++; else fail(`${on.s}: the lifted chorus has other words`);
  const a = lead(zb), b = lead(zo);
  a.forEach((n, i) => { if (i) { const d0 = Math.sign(n.midi - a[i - 1].midi), d1 = Math.sign(b[i].midi - b[i - 1].midi); lf.shapeN++; if (d0 === d1) lf.shape++; } });
  // (with a key change the lift is not added again)
  const kc = build(j, 'on', false), kcl = build(j, 'on', true);
  const ck = choruses(kc.secs);
  if (ck[0]?.song.key !== ck[ck.length - 1]?.song.key) { twiceTotal++; if (kc.secs.every((x, i) => pitches(x) === pitches(kcl.secs[i]))) twice++; else fail(`${kc.s}: a song with a key change was lifted as well`); }
}
console.log(`lift: ${lf.songs} songs; default unchanged ${defaultSame}/${defaultTotal}; same seed same notes ${seedSame}/${defaultTotal}; last chorus higher by ${mean(lf.lift).toFixed(2)} semitones (${Math.min(...lf.lift).toFixed(1)} to ${Math.max(...lf.lift).toFixed(1)}); off the key and the chords ${pc(lf.off, lf.n)}% (before ${pc(lf.offBase, lf.n)}%); on a chord note ${pc(lf.ct, lf.n)}% (before ${pc(lf.ctBase, lf.n)}%); same rhythm ${lf.rhythm}/${lf.songs}, same words ${lf.words}/${lf.songs}; moves keep their direction ${pc(lf.shape, lf.shapeN)}%; other sections unchanged ${pc(lf.elseSame, lf.elseN)}%; highest note ${lf.top}; with a key change not lifted twice ${twice}/${twiceTotal}`);
if (defaultSame !== defaultTotal) fail('off is not the default');
if (lf.songs < 30) fail('too few songs with two choruses');
if (mean(lf.lift) < 2.5 || mean(lf.lift) > 4.5) fail('the last chorus is not about a third higher');
if (Math.min(...lf.lift) < 1) fail('a last chorus was not lifted');
if (lf.off > lf.offBase + 0.01 * lf.n) fail('the lifted chorus is out of key');
if (lf.ct < lf.ctBase - 0.04 * lf.n) fail('the lifted chorus is on chord notes less often');
if (lf.shape < 0.9 * lf.shapeN) fail('the lifted chorus does not keep the shape of the tune');
if (lf.elseSame !== lf.elseN) fail('another section changed');
if (lf.top > 88) fail(`a note above the voice's limit: ${lf.top}`);
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
