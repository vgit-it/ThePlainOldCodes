// "Does this vocal line sound like a tune?" as numbers (docs/VOCAL-TUNE.md). The solo's tune score (src/parts/solotune.ts) turned to
// a singer: it reads the finished notes of a section and the phrases the writer cut, so any version of a section is scored the same way.
// Pure: no chance, nothing written back.
// A tune, in these numbers: mostly steps and repeated notes with a few leaps that step back; phrases that end on a chord note, held;
// a cell of notes that comes back (same shape, same rhythm); chord notes on the bar's first beat; arcs, not wiggles; a range a voice
// can sing (an octave a phrase); one high point, not the same note over and over.
// Differences from the solo's: the phrases are the writer's own (not found by gaps), a singer may repeat a note more, and a phrase
// spans an octave at most.

import { QUALITIES, chordPc, type Chord } from '../theory';
import type { BarGrid } from './grid';
import type { Mood } from '../tension';
import { profileFor } from './intervals';
import type { BandNote, Gap } from './verse';

/** Part weights: the cell that comes back and the phrase ends count most (what the ear takes for a tune). */
export const VOCAL_TUNE_WEIGHTS: Record<string, number> = { repeat: 3, steps: 2, ends: 2, leapBack: 1, smooth: 1, range: 1, beats: 1, same: 1, top: 1 };
/** A section scoring this much or more counts as a tune. */
export const VOCAL_TUNE_PASS = 0.65;
/** The sections the writer tries more than once (the others take the first version). */
export const TUNE_KINDS = new Set(['verse', 'chorus']);
/** Most versions of a section the switch can ask for. */
export const TUNE_MAX = 16;
/** The switch's choices (versions written; 0 is off). What the app stores (`vocalTune`): nothing = off. */
export const TUNE_CHOICES = [0, 4, 8, 12] as const;

/** A version's seed: version 0 is the section as it always was; another version rolls the pitch rules (PITCH_RULES, form.ts) again. */
export const withVariant = (seed: string, variant: number) => (variant > 0 ? `${seed}|vt${variant}` : seed);

/** The mood parts' weights: how well the moves fit the mood's table of intervals, its size of move, its share of leaps and of rising moves. */
export const VOCAL_MOOD_WEIGHTS: Record<string, number> = { moodFit: 2, size: 1.5, dir: 3 };

/** What a mood wants of a line (from its interval profile, intervals.ts): the share of steps, the share of leaps, the share of rising moves, the table of intervals, how often a leap is answered. */
export interface VocalAim { steps: number; leaps: number; up: number; w: readonly number[]; fill: number }
/** The aim of a mood in a kind of section: small moves want many steps and few leaps, big moves the other way. */
export function aimFor(mood: Mood, kind: string): VocalAim {
  const P = profileFor(mood, kind);
  return { steps: Math.max(0.35, Math.min(0.85, 1.05 - 0.14 * P.size)), leaps: Math.max(0.04, Math.min(0.3, 0.05 * (P.size - 1.5))), up: P.up, w: P.w, fill: P.fill };
}

/** The real-song parts' weights (docs/VOCAL-REAL.md): near the real share of repeated notes, of chord notes on strong beats, and of phrases peaking early. */
export const VOCAL_REAL_WEIGHTS: Record<string, number> = { realSame: 2, realChord: 2, realPeak: 1 };
/** What real vocal lines do (src/realism/targets.json, Lakh MIDI): repeated notes ~29% of moves, chord notes on ~69% of strong beats, ~59% of phrases peak in their first half. */
export const REAL = { same: 0.29, chord: 0.69, peak: 0.59 };

export interface VocalTuneCtx { key: number; grid: BarGrid; chordAt: Chord[]; /** Left out: the same tune for every mood. */ aim?: VocalAim; /** Also score how near the line is to real songs (VOCAL_REAL_WEIGHTS). */ real?: boolean }
/** Each part, 0 (not a tune) to 1 (a tune); `score` is their weighted mean. */
export interface VocalTune { notes: number; score: number; parts: Record<string, number> }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 1 between lo and hi, falling to 0 at lo0 and hi0. */
const band = (x: number, lo0: number, lo: number, hi: number, hi0: number) => (x < lo ? clamp01((x - lo0) / (lo - lo0)) : x > hi ? clamp01((hi0 - x) / (hi0 - hi)) : 1);
const share = (n: number, d: number, none = 1) => (d ? n / d : none);
/** A move as a shape: 0 same, 1 step (1-2 semitones), 2 third (3-4), 3 leap (5+); signed. */
const shapeOf = (d: number) => Math.sign(d) * (Math.abs(d) === 0 ? 0 : Math.abs(d) <= 2 ? 1 : Math.abs(d) <= 4 ? 2 : 3);

export function vocalTune(notes: BandNote[], phrases: Gap[], c: VocalTuneCtx): VocalTune {
  const line = notes.slice().sort((a, b) => a.step - b.step);
  const n = line.length;
  if (n < 6) return { notes: n, score: 0, parts: {} };
  const beat = c.grid.beat;
  // each phrase's notes (the ones starting inside it)
  const eps = 1e-6;
  const ph = phrases.map((g) => line.filter((x) => x.step >= g.step - eps && x.step < g.step + g.len - eps)).filter((p) => p.length);
  if (!ph.length) return { notes: n, score: 0, parts: {} };
  // moves inside phrases only (a jump across a breath is not a melodic move)
  const inside: { d: number; a: BandNote; b: BandNote }[] = [];
  for (const p of ph) for (let i = 1; i < p.length; i++) inside.push({ d: p[i].midi - p[i - 1].midi, a: p[i - 1], b: p[i] });
  const d = inside.map((m) => m.d);
  const moving = d.filter((x) => x !== 0);
  const steps = share(moving.filter((x) => Math.abs(x) <= 2).length, moving.length);
  const sameNote = share(d.filter((x) => x === 0).length, d.length, 0);
  let leaps = 0, back = 0;
  for (const p of ph) for (let i = 1; i + 1 < p.length; i++) {
    const m = p[i].midi - p[i - 1].midi;
    if (Math.abs(m) < 5) continue;
    leaps++;
    const next = p[i + 1].midi - p[i].midi;
    if (Math.sign(next) === -Math.sign(m) && Math.abs(next) <= 4) back++;
  }
  const leapBack = share(back, leaps);
  let flips = 0, turnsOf = 0;
  for (const p of ph) {
    const mv = p.slice(1).map((x, i) => x.midi - p[i].midi).filter((x) => x !== 0);
    for (let i = 1; i < mv.length; i++) if (Math.sign(mv[i]) !== Math.sign(mv[i - 1])) flips++;
    turnsOf += Math.max(0, mv.length - 1);
  }
  const turns = share(flips, turnsOf, 0);
  const top = Math.max(...line.map((x) => x.midi));
  const topPhrases = share(ph.filter((p) => p.some((x) => x.midi === top)).length, ph.length, 0);
  const tight = share(ph.filter((p) => Math.max(...p.map((x) => x.midi)) - Math.min(...p.map((x) => x.midi)) <= 12).length, ph.length);

  // phrase ends: a chord note, held
  const toneAt = (x: BandNote) => {
    const ch = c.chordAt[Math.min(c.chordAt.length - 1, Math.max(0, Math.floor(x.step)))];
    return (QUALITIES[ch.q] as readonly number[]).some((q) => (chordPc(c.key, ch) + q) % 12 === ((x.midi % 12) + 12) % 12);
  };
  const ends = ph.map((p) => p[p.length - 1]);
  const endsChord = share(ends.filter(toneAt).length, ends.length);
  const endsLong = share(ends.filter((x) => x.len >= beat).length, ends.length);
  const onBar = line.filter((x) => c.grid.isLine(x.step));
  const beatChord = share(onBar.filter(toneAt).length, onBar.length);

  // a cell that comes back: 3 moves in a row (shape + length class), the same twice or more, not a plain run or a repeated note
  const lenClass = (len: number) => (len <= beat / 2 ? 0 : len <= beat ? 1 : len <= beat * 2 ? 2 : 3);
  const N = 3;
  const covered = new Array(n).fill(false), coverShape = new Array(n).fill(false);
  const startKeys: string[] = [];
  const runs = ph.map((p) => p.map((x) => x));
  // (cells are looked for inside each phrase and between phrases: the moves of the whole line, with breaths between phrases cut out)
  const toks: { tok: number; shape: number; at: number[] }[][] = runs.map((p) => p.slice(1).map((x, i) => ({
    tok: shapeOf(x.midi - p[i].midi) * 4 + lenClass(p[i].len), shape: shapeOf(x.midi - p[i].midi), at: [line.indexOf(p[i]), line.indexOf(x)],
  })));
  const mark = (pick: (t: { tok: number; shape: number }) => number, cover: boolean[]) => {
    const seen = new Map<string, number[][]>();
    for (const t of toks) for (let i = 0; i + N <= t.length; i++) {
      const w = t.slice(i, i + N), f = w.map(pick);
      if (f.every((x) => x === f[0]) || w.every((x) => x.shape === 0)) continue;
      const k = f.join(',');
      const idx = [w[0].at[0], ...w.map((x) => x.at[1])];
      const at = seen.get(k) ?? [];
      at.push(idx);
      seen.set(k, at);
    }
    for (const at of seen.values()) {
      const far = at.filter((p, j) => j === 0 || p[0] >= at[j - 1][at[j - 1].length - 1]);
      if (far.length < 2) continue;
      for (const p of far) for (const q of p) cover[q] = true;
    }
  };
  mark((t) => t.tok, covered);
  mark((t) => t.shape, coverShape);
  const repeat = share(covered.filter(Boolean).length, n, 0);
  const shapeCover = share(coverShape.filter(Boolean).length, n, 0);
  // phrases that start like an earlier one (the answer that repeats the call)
  for (const t of toks) startKeys.push(t.length >= N ? t.slice(0, N).map((x) => x.shape).join(',') : '');
  const echo = share(startKeys.filter((k, i) => k && startKeys.slice(0, i).includes(k)).length, Math.max(1, ph.length - 1), 0);

  // the mood: how well the moves fit its table of intervals, the size of its moves, and the way it leans
  const aim = c.aim;
  const leapShare = share(moving.filter((x) => Math.abs(x) >= 5).length, moving.length, 0);
  const upShare = share(moving.filter((x) => x > 0).length, moving.length, 0.5);
  let logW = 0;
  if (aim) for (const x of d) logW += Math.log(Math.max(0.05, aim.w[Math.min(12, Math.abs(x))]));
  const moodFit = aim ? Math.exp(logW / Math.max(1, d.length)) : 1;
  const parts: Record<string, number> = {
    repeat: clamp01((0.7 * repeat + 0.3 * shapeCover) / 0.5) * 0.85 + 0.15 * clamp01(echo / 0.3),
    steps: aim ? band(steps, aim.steps - 0.35, aim.steps - 0.15, aim.steps + 0.15, aim.steps + 0.35) : band(steps, 0.1, 0.4, 0.8, 0.98),
    ends: 0.6 * endsChord + 0.4 * endsLong,
    leapBack: aim ? 1 - (1 - leapBack) * aim.fill : leapBack,
    smooth: clamp01((0.62 - turns) / 0.2),
    range: tight,
    beats: beatChord,
    same: clamp01((0.55 - sameNote) / 0.2),
    top: clamp01((1 - topPhrases) / 0.4),
  };
  if (c.real) {
    const strong = line.filter((x) => c.grid.isStrong(x.step));
    // (the phrase's top note in its first half: where the first note with the top pitch starts, against the phrase's span)
    const early = share(ph.filter((p) => { const hi = Math.max(...p.map((x) => x.midi)), a = p[0].step, z = p[p.length - 1].step + p[p.length - 1].len; return p.find((x) => x.midi === hi)!.step - a < (z - a) / 2; }).length, ph.length, REAL.peak);
    parts.realSame = band(sameNote, REAL.same - 0.22, REAL.same - 0.06, REAL.same + 0.06, REAL.same + 0.22);
    parts.realChord = band(share(strong.filter(toneAt).length, strong.length, REAL.chord), REAL.chord - 0.3, REAL.chord - 0.1, REAL.chord + 0.1, REAL.chord + 0.3);
    parts.realPeak = band(early, REAL.peak - 0.3, REAL.peak - 0.1, REAL.peak + 0.1, REAL.peak + 0.3);
  }
  if (aim) {
    parts.moodFit = clamp01((moodFit - 0.45) / 0.6);
    parts.size = band(leapShare, aim.leaps - 0.12, Math.max(0, aim.leaps - 0.05), aim.leaps + 0.05, aim.leaps + 0.14);
    parts.dir = band(upShare, aim.up - 0.25, aim.up - 0.1, aim.up + 0.1, aim.up + 0.25);
  }
  const weights = { ...VOCAL_TUNE_WEIGHTS, ...(aim ? VOCAL_MOOD_WEIGHTS : {}), ...(c.real ? VOCAL_REAL_WEIGHTS : {}) };
  let wsum = 0, ssum = 0;
  for (const k of Object.keys(weights)) { wsum += weights[k]; ssum += weights[k] * clamp01(parts[k]); }
  return { notes: n, score: ssum / wsum, parts };
}
