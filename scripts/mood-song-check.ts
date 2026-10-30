// Checks Mood song (docs/MOOD-SONG.md): the mood chooses the song's mode, tempo and drum feel.
//  - Bright moods get brighter modes than dark ones, slow moods slower tempos than angry ones, in every genre that has the choice.
//  - The genre's own modes only; a chosen tempo or mode wins; Auto and a wrong value change nothing; the switch off is the song as it was.
//  - A whole track builds for every genre and mood, and plays at the mood's tempo; the same seeds give the same song.
//   npm run mood-song-check        (N=30 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { GENRES, GENRE_LIST } from '../src/genres';
import { moodSongOf, buildTrack, defaultTrackOptions } from '../src/track';
import type { MoodSong } from '../src/moodsong';
import type { Mode } from '../src/theory';

const N = Number(process.env.N ?? 30);
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const BRIGHT: Record<Mode, number> = { phrygian: 1, minor: 2, dorian: 3, mixolydian: 4, major: 5, lydian: 6 };
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, d = 2) => x.toFixed(d);

const seeds = (s: string) => ({ song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
const make = (g: string, j: number, extra: Record<string, unknown>) => generate({ genre: g, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS, ...extra } as never, seeds(`mo-${j}-${g}`));
const sig = (i: any) => `${i.song.key}|${i.song.mode}|${i.song.bpm}|${!!i.song.forceHalf}|${i.chords.timeline.map((e: any) => e.chord.root + e.chord.q).join(',')}`;

// the song as the switch off writes it is the song as it was
for (const g of GENRE_LIST) for (let j = 0; j < 4; j++) {
  const was = sig(make(g, j, {}));
  if (sig(make(g, j, { moodSong: undefined })) !== was) fail(`${g} ${j}: undefined is not the same song`);
}
// the track options: Auto, off and a wrong value ask for nothing
const t0 = { ...defaultTrackOptions(make('rock', 0, {})) };
for (const v of ['off', undefined, 'nonsense', 'both']) if (v !== 'both' && moodSongOf({ ...t0, mood: 'dark', moodSong: v as never })) fail(`moodSongOf(${v}) asks for something`);
if (moodSongOf({ ...t0, mood: 'auto', moodSong: 'both' })) fail('Auto mood asks for a mood song');
if (moodSongOf({ ...t0, mood: 'nonsense' as never, moodSong: 'both' })) fail('a wrong mood asks for a mood song');
const ask = moodSongOf({ ...t0, mood: 'dark', moodSong: 'mode' });
if (!ask || !ask.mode || ask.tempo) fail('"mode" does not ask for the mode only');

// per genre and mood
type R = { bright: number[]; bpm: number[]; half: number; n: number };
const tab: Record<string, Record<string, R>> = {};
const base: Record<string, number[]> = {};
for (const g of GENRE_LIST) {
  tab[g] = {}; base[g] = [];
  const pool = new Set<string>(GENRES[g].modes);
  for (const m of MOODS) tab[g][m] = { bright: [], bpm: [], half: 0, n: 0 };
  for (let j = 0; j < N; j++) {
    const off = make(g, j, {});
    base[g].push(off.song.bpm);
    for (const m of MOODS) {
      const ms: MoodSong = { mood: m, tempo: true, mode: true };
      const on = make(g, j, { moodSong: ms }), again = make(g, j, { moodSong: ms });
      if (sig(on) !== sig(again)) fail(`${g} ${j} ${m}: not the same twice`);
      const r = tab[g][m];
      r.n++; r.bright.push(BRIGHT[on.song.mode]); r.bpm.push(on.song.bpm / off.song.bpm); if (on.song.forceHalf) r.half++;
      if (!pool.has(on.song.mode) && !(off.song.mode === on.song.mode)) fail(`${g} ${j} ${m}: mode ${on.song.mode} is not one of the genre's`);
      // the key and the meter do not move; the rest of the draws stay
      if (on.song.key !== off.song.key || on.song.bars.length !== off.song.bars.length) fail(`${g} ${j} ${m}: the key or the bars moved`);
      // a chosen tempo or mode wins
      const fixed = make(g, j, { moodSong: ms, bpm: 123, mode: 'dorian' });
      if (fixed.song.bpm !== 123 || fixed.song.mode !== 'dorian' || fixed.song.forceHalf) fail(`${g} ${j} ${m}: a chosen tempo or mode did not win`);
      // each part alone
      const modeOnly = make(g, j, { moodSong: { mood: m, mode: true } }), tempoOnly = make(g, j, { moodSong: { mood: m, tempo: true } });
      if (modeOnly.song.bpm !== off.song.bpm || modeOnly.song.forceHalf) fail(`${g} ${j} ${m}: mode only moved the tempo`);
      if (tempoOnly.song.mode !== off.song.mode) fail(`${g} ${j} ${m}: tempo only moved the mode`);
    }
  }
}

console.log('genre      brightness of the mode (1 dark .. 6 bright)        tempo against the genre\'s own           half-time');
console.log(''.padEnd(10) + MOODS.map((m) => m.slice(0, 5).padStart(6)).join('') + '     ' + MOODS.map((m) => m.slice(0, 5).padStart(6)).join('') + '     ' + MOODS.map((m) => m.slice(0, 4).padStart(5)).join(''));
let gaps = 0, withChoice = 0;
for (const g of GENRE_LIST) {
  const row = tab[g];
  console.log(g.padEnd(10) + MOODS.map((m) => f(mean(row[m].bright), 1).padStart(6)).join('') + '     ' + MOODS.map((m) => f(mean(row[m].bpm)).padStart(6)).join('') + '     ' + MOODS.map((m) => `${Math.round((100 * row[m].half) / row[m].n)}%`.padStart(5)).join(''));
  const bright = mean(['happy', 'triumphant'].map((m) => mean(row[m].bright))), dark = mean(['melancholic', 'dark', 'tense'].map((m) => mean(row[m].bright)));
  if (new Set(GENRES[g].modes).size > 1) { withChoice++; gaps += bright - dark; if (!(bright > dark + 0.2)) fail(`${g}: bright moods (${f(bright, 1)}) are not brighter than dark ones (${f(dark, 1)})`); }
  if (!(mean(row.melancholic.bpm) < 0.9 && mean(row.dreamy.bpm) < 0.9 && mean(row.angry.bpm) > 1.03)) fail(`${g}: the tempos do not follow the moods`);
}
console.log(`genres with a choice of mode: ${withChoice}; brighter by ${f(gaps / Math.max(1, withChoice), 1)} on average (bright moods over melancholic, dark, tense)`);

// a whole track, every genre and mood: it builds, plays at the mood's tempo, the sections agree
for (const g of GENRE_LIST) for (const m of MOODS) {
  const idea = make(g, 1, {});
  const opts = { ...defaultTrackOptions(idea), solo: 'on', mood: m, moodSong: 'both', soloPlan: 'tune' } as never;
  const t = buildTrack(idea, opts);
  const want = make(g, 1, { moodSong: moodSongOf(opts) });
  if (t.source.song.bpm !== want.song.bpm || t.source.song.mode !== want.song.mode) fail(`${g} ${m}: the track is not the mood song`);
  if (t.sections.some((s) => s.song.bpm !== want.song.bpm)) fail(`${g} ${m}: a section plays at another tempo`);
  if (idea.song.mode !== make(g, 1, {}).song.mode) fail(`${g} ${m}: the page's idea was changed`);
  // the switch off (or Auto) gives the track as it was
  const was = buildTrack(idea, { ...opts, moodSong: 'off' } as never), plain = buildTrack(idea, { ...opts, moodSong: undefined } as never);
  if (was.sections.map((s) => s.guitar2.length + ':' + s.song.bpm).join() !== plain.sections.map((s) => s.guitar2.length + ':' + s.song.bpm).join()) fail(`${g} ${m}: off is not as it was`);
  if (buildTrack(idea, { ...opts, mood: 'auto' } as never).source.song.bpm !== idea.song.bpm) fail(`${g}: Auto changed the tempo`);
}
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
