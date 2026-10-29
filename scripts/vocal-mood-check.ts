// Checks that the vocal's Tune pick and Strong notes keep the song's mood in the melody (docs/VOCAL-TUNE.md, "Mood").
// For four moods (melancholic, tense, angry, triumphant) and four ways (off, tune pick, strong notes, both) on real songs it measures
// how the line moves: the mean size of a move, the share of leaps (5+ semitones), the share of rising moves, and the mood-aware tune
// score (the mood's table of intervals, its size of move, its lean). A mood should sound like itself in every way: sad small and
// falling, triumphant wide and rising.
//   npm run vocal-mood-check        (N=40 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { EMO_IDS } from '../src/verse/emotion';
import { songOptions, writeSong } from '../src/verse/sing';
import { chordsOf, songGrid } from '../src/verse/section';
import { aimFor, vocalTune } from '../src/verse/tune';
import type { Mood } from '../src/tension';

const N = Number(process.env.N ?? 40);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS: Mood[] = ['melancholic', 'tense', 'angry', 'triumphant'];
const WAYS: [string, boolean, number][] = [['Off', false, 0], ['Tune pick', false, 12], ['Strong notes', true, 0], ['Both', true, 12]];
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
let bad = 0;

interface Acc { size: number[]; leap: number[]; up: number[]; score: number[]; fit: number[] }
const T: Record<string, Record<string, Acc>> = {};
for (const [w] of WAYS) { T[w] = {}; for (const m of MOODS) T[w][m] = { size: [], leap: [], up: [], score: [], fit: [] }; }

for (let i = 0; i < N; i++) {
  const genre = GENRES[i % 7], s = `vm-${i}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b' } as never);
  const list = buildTrack(idea, { ...defaultTrackOptions(idea) } as never).sections;
  for (const mood of MOODS) for (const [way, skeleton, tune] of WAYS) {
    const w = writeSong(list, songOptions(s + 'v', 0, { mood, on: new Set(EMO_IDS), climax: list[0], maxSets: 4, ...(skeleton ? { skeleton } : {}), ...(tune ? { tune } : {}) } as never, 0));
    for (const k of ['verse', 'chorus']) {
      const sec = list.find((x) => (x.section?.kind ?? 'verse') === k);
      const v = sec && w.get(sec);
      if (!sec || !v?.built.notes.length) continue;
      // the moves inside phrases
      const mv: number[] = [];
      for (const g of v.built.phrases) {
        const ns = v.built.notes.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6);
        for (let j = 1; j < ns.length; j++) mv.push(ns[j].midi - ns[j - 1].midi);
      }
      const moving = mv.filter((x) => x !== 0);
      if (!moving.length) continue;
      const a = T[way][mood];
      a.size.push(mean(moving.map(Math.abs)));
      a.leap.push(moving.filter((x) => Math.abs(x) >= 5).length / moving.length);
      a.up.push(moving.filter((x) => x > 0).length / moving.length);
      const tn = vocalTune(v.built.notes, v.built.phrases, { key: sec.song.key, grid: songGrid(sec), chordAt: chordsOf(sec), aim: aimFor(mood, k) });
      a.score.push(tn.score); a.fit.push(tn.parts.moodFit ?? 0);
    }
  }
}
console.log('way'.padEnd(13) + MOODS.map((m) => m.padEnd(30)).join(''));
for (const [way] of WAYS) {
  console.log(way.padEnd(13) + MOODS.map((m) => { const a = T[way][m]; return `size ${mean(a.size).toFixed(1)} leap ${Math.round(100 * mean(a.leap))}% up ${Math.round(100 * mean(a.up))}% fit ${mean(a.fit).toFixed(2)}`.padEnd(30); }).join(''));
}
console.log('\nmood-aware tune score, mean');
for (const [way] of WAYS) console.log(way.padEnd(13) + MOODS.map((m) => mean(T[way][m].score).toFixed(3).padEnd(26)).join(''));
// a mood must still sound like itself: wide moods wider than narrow ones, rising ones more upward, in every way
for (const [way] of WAYS) {
  const sz = (m: Mood) => mean(T[way][m].size), up = (m: Mood) => mean(T[way][m].up);
  if (!(sz('triumphant') > sz('melancholic') + 0.3)) { bad++; console.log(`FAIL ${way}: triumphant moves are not wider than melancholic's`); }
  if (!(up('triumphant') > up('melancholic') + 0.03)) { bad++; console.log(`FAIL ${way}: triumphant moves do not rise more than melancholic's`); }
}
console.log(bad ? `${bad} problems` : `ok: ${N} songs, no problems`);
process.exit(bad ? 1 : 0);
