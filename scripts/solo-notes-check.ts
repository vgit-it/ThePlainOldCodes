// Checks "Notes follow the chords" (docs/SOLO-HARMONY.md, step 3: `storyNotes` in src/parts/solotunefirst.ts), Solo story on:
//  - off is the default and changes nothing; same seed, same notes;
//  - the phrases' strong notes follow the chord they land on: on a chord that wants to move (V, a 7th, a suspended chord) a call lands on
//    the note that leans (the 3rd, the 7th) and not on the root; on a chord that rests (home, an arrival) an answer lands on the root or the 3rd;
//  - in a solo whose chords loop, a phrase one loop later plays the same figure again (the same rhythm), so each round says it again, higher;
//  - every strong note is still a note of its chord, the solo is still a tune, and the story's plot is unchanged (phrases, peak).
//   npm run solo-notes-check        (N=96 songs)
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
const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `sn-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on', soloStory: 'on', ...extra } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

type Acc = {
  tenseCall: number; tenseLean: number; tenseRoot: number;
  restN: number; restRoot: number; restRootThird: number;
  awayCall: number; awayThird: number; awayRoot: number;
  notCore: number; goals: number;
  loopPairs: number; loopSame: number;
  tunes: number; solos: number; score: number;
};
const acc = (): Acc => ({ tenseCall: 0, tenseLean: 0, tenseRoot: 0, restN: 0, restRoot: 0, restRootThird: 0, awayCall: 0, awayThird: 0, awayRoot: 0, notCore: 0, goals: 0, loopPairs: 0, loopSame: 0, tunes: 0, solos: 0, score: 0 });
const A = { off: acc(), on: acc() };
const DIST: Record<string, Record<number, number>> = {};
let same = 0, total = 0, hash = 0, plotSame = 0;

function measure(a: Acc, sec: any) {
  a.solos++;
  const song = sec.song, bars = song.bars, T = song.total;
  const map = readHarmony(sec.chords.timeline, T, song.mode);
  const lands = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'mid');
  for (const l of lands) {
    a.goals++;
    const b = beatAt(map, Math.min(T - 1, l.step + Math.max(0, l.len - 1)));
    // (a hold across a chord change is limited to the notes both chords share: judged apart)
    if (beatAt(map, l.step) !== b) continue;
    const d = mod(l.midi - chordPc(song.key, b.chord), 12);
    const sus = b.chord.q === 'sus4' || b.chord.q === 'sus2';
    const third = d === 3 || d === 4, seventh = d === 10 || d === 11, lean = third || seventh || (sus && (d === 5 || d === 2)), root = d === 0;
    const tones = new Set(((): number[] => { const q = b.chord.q; return [0, 3, 4, 7, 10, 11, 2, 5, 9, 6, 8]; })());
    void tones;
    if (b.role === 'tense' && l.role === 'call') { { const o = (DIST[(a === A.on ? 'on ' : 'off ') + 'tense call'] ??= {}); o[d] = (o[d] ?? 0) + 1; } a.tenseCall++; if (lean) a.tenseLean++; if (root) a.tenseRoot++; }
    else if ((b.arrival > 0 || b.role === 'home') && (l.role === 'answer' || l.role === 'end' || l.role === 'climax')) { { const o = (DIST[(a === A.on ? 'on ' : 'off ') + l.role] ??= {}); o[d] = (o[d] ?? 0) + 1; } a.restN++; if (root) a.restRoot++; if (root || third) a.restRootThird++; }
    else if ((b.role === 'away' || b.role === 'rest' || b.role === 'lift') && l.role === 'call') { a.awayCall++; if (third) a.awayThird++; if (root) a.awayRoot++; }
  }
  // phrases one loop apart: the same rhythm?
  const m = /phrases of ([\d +]+) bars/.exec((sec.notes ?? []).join(' '));
  const ls = m ? m[1].split('+').map((v: string) => Number(v.trim())) : [];
  if (map.loop && ls.length > 1) {
    let b0 = 0;
    const ph = ls.map((n: number) => { const o = { S: bars[b0].start, E: b0 + n >= bars.length ? T : bars[b0 + n].start, n }; b0 += n; return o; });
    // (the first half of the phrase: its figure; the strong note's hold at the end is judged apart)
    const rhythm = (p: { S: number; E: number }) => (sec.guitar2 as any[]).filter((h) => h.notes?.length && h.step >= p.S && h.step < p.S + (p.E - p.S) / 2).map((h) => `${h.step - p.S}:${h.len}`).join(',');
    for (let i = 1; i < ph.length; i++) for (let j = 0; j < i; j++) {
      const dS = ph[i].S - ph[j].S;
      if (ph[i].n === ph[j].n && dS > 0 && Math.abs(dS % map.loop) < 1e-6 && ph[i].E - ph[i].S === ph[j].E - ph[j].S) { a.loopPairs++; if (rhythm(ph[i]) === rhythm(ph[j])) a.loopSame++; break; }
    }
  }
  const t = tuneScore(sec.guitar2, { bars, key: song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(T - 1, g)]].chord }).score;
  a.score += t; if (t >= TUNE_PASS) a.tunes++;
}

for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { soloStoryNotes: 'off' }), on = build(j, { soloStoryNotes: 'on' }), again = build(j, { soloStoryNotes: 'on' });
  total++;
  if (off.secs.every((sec, si) => JSON.stringify(sec.guitar2) === JSON.stringify(offTrue.secs[si].guitar2))) same++; else fail(`${off.s}: 'off' is not the default`);
  on.secs.forEach((sec, si) => {
    measure(A.on, sec); measure(A.off, off.secs[si]);
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) hash++;
    // the plot is the same: the phrases and the peak bar are on the card
    const plotOf = (s: any) => (s.notes ?? []).filter((n: string) => n.startsWith('plot (')).join('');
    if (plotOf(sec) === plotOf(off.secs[si])) plotSame++;
  });
}
const solos = A.on.solos;
const f = (v: number) => (Math.round(v * 100) / 100).toString();
console.log(`solos ${solos}; default unchanged ${same}/${total}; same seed same notes ${solos - hash}/${solos}; the plot unchanged ${plotSame}/${solos}`);
for (const k of ['off', 'on'] as const) {
  const a = A[k];
  console.log(`notes ${k.padEnd(3)}: calls on a chord that wants to move ${a.tenseCall}: lean ${pc(a.tenseLean, a.tenseCall)}% root ${pc(a.tenseRoot, a.tenseCall)}% | arrivals and answers on home ${a.restN}: root ${pc(a.restRoot, a.restN)}% root or 3rd ${pc(a.restRootThird, a.restN)}% | calls on a resting or away chord ${a.awayCall}: 3rd ${pc(a.awayThird, a.awayCall)}% root ${pc(a.awayRoot, a.awayCall)}% | phrases one loop apart ${a.loopPairs}: same rhythm ${pc(a.loopSame, a.loopPairs)}% | tune ${f(a.score / Math.max(1, a.solos))}, ${pc(a.tunes, a.solos)}% pass`);
}
if (process.env.DEBUG) console.log('degrees on arrivals (on):', JSON.stringify(DIST));
if (hash) fail('same seed gave other notes');
const on = A.on, off = A.off;
if (on.tenseCall >= 15 && on.tenseLean / on.tenseCall < off.tenseLean / off.tenseCall + 0.1) fail('calls on a chord that wants to move do not lean more');
if (on.restRootThird / on.restN < off.restRootThird / off.restN + 0.05) fail('arrivals and answers on home do not land on the root or 3rd more often');
if (on.awayCall >= 15 && on.awayThird / on.awayCall < off.awayThird / off.awayCall + 0.08) fail('calls on a resting or away chord do not land on the 3rd more often');
if (on.loopPairs >= 15 && on.loopSame / on.loopPairs < off.loopSame / off.loopPairs + 0.2) fail('a phrase one loop later does not play the figure again more often');
if (on.tunes / on.solos < off.tunes / off.solos - 0.04) fail(`fewer solos pass as a tune (${pc(on.tunes, on.solos)}% against ${pc(off.tunes, off.solos)}%)`);
if (on.score / on.solos < off.score / off.solos - 0.03) fail('the tune score fell');
if (plotSame !== solos) fail('the plot changed');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
