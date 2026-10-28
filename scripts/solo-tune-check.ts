// Measures "does the solo sound like a tune" (docs/SOLO-TUNE.md, src/parts/solotune.ts) on every solo writer.
// Step 1 is the baseline: the score on the writers as they are. Checks: the score is a number between 0 and 1,
// the same twice, and a hand-made tune scores well above a hand-made random line.
//   npm run solo-tune-check        (N=70 songs a writer)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { TUNE_PASS, tuneScore, type Tune } from '../src/parts/solotune';

const N = Number(process.env.N ?? 70);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

/** The writers, by the track options that pick them (+ the writer names the page shows). */
export const WRITERS: [string, Record<string, unknown>][] = [
  ['As before', { soloPlan: 'off' }],
  ['Planned', { soloPlan: 'on' }],
  ['Melody + player', { soloPlan: 'perform', soloCores: 'off' }],
  ['Library story', { soloPlan: 'perform', soloCores: 'library', soloPolish: 'on', soloShape: 'on' }],
  ...(process.env.TUNE === '1' ? [['Tune first (1 try)', { soloPlan: 'tune', soloTuneTries: 1 }] as [string, Record<string, unknown>], ['Tune first', { soloPlan: 'tune' }] as [string, Record<string, unknown>]] : []),
];

const solosOf = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `tu-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, ...extra } as never).sections as any[]).filter((x) => x.section?.solo);
};
const tune = (sec: any): Tune => tuneScore(sec.guitar2, { bars: sec.song.bars, key: sec.song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(sec.song.total - 1, g)]].chord });
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, d = 2) => x.toFixed(d);

// the score itself: a hand-made tune against a hand-made random line, on the same chords
{
  const sec = solosOf(0, { soloPlan: 'off' })[0];
  const total = sec.song.total, bar = sec.song.bars[0].len;
  const mk = (pitches: number[], lens: number[]) => { let s = 0; return pitches.map((p, i) => { const h = { step: s, notes: [p], strings: [0], len: lens[i], vel: 0.8 }; s += lens[i]; return h; }); };
  // two 2-bar phrases, the second a step higher: stepwise, a cell that comes back, ends held
  const cell = [0, 2, 4, 2, 0, 2, 4, 5];
  const base = sec.song.key + 60;
  const p1 = cell.map((x) => base + [0, 2, 4, 5, 7, 9, 11][x % 7] + 12 * Math.floor(x / 7));
  const good = mk([...p1, base + 7, ...p1, base + 7].slice(0, 18), [2, 2, 2, 2, 2, 2, 2, 8, 8, 2, 2, 2, 2, 2, 2, 2, 8, 8].slice(0, 18));
  const rnd = mk([60, 71, 63, 66, 62, 70, 61, 69, 64, 72, 60, 68, 65, 59, 71, 62, 66, 70], [3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 1, 3]);
  const ctx = { bars: sec.song.bars, key: sec.song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(total - 1, g)]].chord };
  const a = tuneScore(good as never, ctx), b = tuneScore(rnd as never, ctx);
  console.log(`hand-made: tune ${f(a.score)}, random line ${f(b.score)} (bar ${bar})`);
  if (!(a.score > b.score + 0.15)) fail(`a hand-made tune (${f(a.score)}) does not beat a random line (${f(b.score)}) by enough`);
}

const KEYS = ['steps', 'leapBack', 'turns', 'repeat', 'echo', 'phraseBars', 'phraseOk', 'endsChord', 'endsLong', 'beatChord', 'sameNote'] as const;
console.log('writer'.padEnd(18) + 'solos  score  pass%  ' + KEYS.map((k) => k.padStart(9)).join(''));
for (const [name, extra] of WRITERS) {
  const all: Tune[] = [];
  for (let j = 0; j < N; j++) {
    const secs = solosOf(j, extra);
    secs.forEach((s) => {
      const t = tune(s);
      if (!Number.isFinite(t.score) || t.score < 0 || t.score > 1) fail(`${name}: song ${j}: score ${t.score}`);
      for (const k of Object.keys(t.parts)) if (!Number.isFinite(t.parts[k])) fail(`${name}: song ${j}: part ${k} is not a number`);
      all.push(t);
    });
    if (j % 17 === 0 && secs.length && tune(solosOf(j, extra)[0]).score !== tune(secs[0]).score) fail(`${name}: song ${j}: not the same twice`);
  }
  const real = all.filter((t) => t.notes >= 6);
  const pass = real.filter((t) => t.score >= TUNE_PASS).length;
  console.log(name.padEnd(18) + String(all.length).padStart(5) + f(mean(real.map((t) => t.score))).padStart(7) + String(Math.round((100 * pass) / Math.max(1, real.length))).padStart(6) + '%  ' + KEYS.map((k) => f(mean(real.map((t) => t[k] as number))).padStart(9)).join(''));
  const pk = Object.keys(real[0]?.parts ?? {});
  console.log('  parts (mean 0-1): ' + pk.map((k) => `${k} ${f(mean(real.map((t) => t.parts[k])))}`).join(', '));
}
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
