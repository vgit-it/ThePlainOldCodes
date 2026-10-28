// "Does this solo sound like a tune?" as numbers (docs/SOLO-TUNE.md). Reads the finished notes only, so it
// scores any solo writer the same way. Pure: no chance, nothing written back.
// A tune, in these numbers: mostly steps with a few leaps that step back; phrases of 2 to 4 bars that end
// on a chord note, usually held; a cell of notes that comes back (same shape, same rhythm); chord notes on
// the bar's first beat; not the same note over and over; one top note.

import type { GuitarHit } from '../idea';
import type { Chord } from '../theory';
import { chordTones } from './guitar2';

export interface TuneBar { start: number; len: number; groups: number[] }
export interface TuneCtx { bars: TuneBar[]; key: number; chordAt: (step: number) => Chord }

/** Each part of the score, 0 (not a tune) to 1 (a tune); `score` is their weighted mean. */
export interface Tune {
  notes: number;
  phrases: number;
  score: number;
  /** Raw numbers behind the parts (shares 0 to 1, lengths in bars). */
  steps: number; leapBack: number; turns: number; repeat: number; echo: number;
  phraseBars: number; phraseOk: number; tight: number; endsChord: number; endsLong: number; beatChord: number; sameNote: number; topCount: number;
  parts: Record<string, number>;
}

/** Part weights: the repeated cell and the phrase shape count most (they are what the ear takes for a tune). */
export const TUNE_WEIGHTS: Record<string, number> = { repeat: 3, phrase: 2, steps: 2, ends: 2, leapBack: 1, smooth: 1, range: 1, beats: 1, same: 1, top: 1 };
/** A solo scoring this much or more counts as a tune. */
export const TUNE_PASS = 0.65;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** 1 between lo and hi, falling to 0 at lo0 and hi0. */
const band = (x: number, lo0: number, lo: number, hi: number, hi0: number) => (x < lo ? clamp01((x - lo0) / (lo - lo0)) : x > hi ? clamp01((hi0 - x) / (hi0 - hi)) : 1);
const share = (n: number, d: number, none = 1) => (d ? n / d : none);

/** The line's notes (a double-stop counts as its top note), in time order; mutes and empty hits are not notes. */
const lineOf = (hits: GuitarHit[]) => hits.filter((h) => !h.mute && h.notes.length).sort((a, b) => a.step - b.step);
const topOf = (h: GuitarHit) => h.notes[h.notes.length - 1];

/** A move as a shape: 0 same, 1 step (1-2 semitones), 2 third (3-4), 3 leap (5+); signed. */
const shapeOf = (d: number) => Math.sign(d) * (Math.abs(d) === 0 ? 0 : Math.abs(d) <= 2 ? 1 : Math.abs(d) <= 4 ? 2 : 3);
const lenClass = (len: number) => (len <= 2 ? 0 : len <= 4 ? 1 : len <= 8 ? 2 : 3);

export function tuneScore(hitsIn: GuitarHit[], ctx: TuneCtx): Tune {
  const line = lineOf(hitsIn);
  const n = line.length;
  const midi = line.map(topOf);
  const empty = (): Tune => ({ notes: n, phrases: 0, score: 0, steps: 0, leapBack: 0, turns: 0, repeat: 0, echo: 0, phraseBars: 0, phraseOk: 0, tight: 0, endsChord: 0, endsLong: 0, beatChord: 0, sameNote: 0, topCount: 0, parts: {} });
  if (n < 6) return empty();
  const barLen = ctx.bars.length ? ctx.bars.reduce((s, b) => s + b.len, 0) / ctx.bars.length : 16;
  const beat = barLen >= 16 ? 4 : Math.max(2, Math.round(barLen / 4));

  // moves
  const d: number[] = [];
  for (let i = 1; i < n; i++) d.push(midi[i] - midi[i - 1]);
  const moving = d.filter((x) => x !== 0);
  const steps = share(moving.filter((x) => Math.abs(x) <= 2).length, moving.length);
  const leaps = d.map((x, i) => ({ x, i })).filter((l) => Math.abs(l.x) >= 5 && l.i + 1 < d.length);
  const leapBack = share(leaps.filter((l) => Math.sign(d[l.i + 1]) === -Math.sign(l.x) && Math.abs(d[l.i + 1]) <= 4).length, leaps.length);
  let flips = 0;
  for (let i = 1; i < moving.length; i++) if (Math.sign(moving[i]) !== Math.sign(moving[i - 1])) flips++;
  const turns = share(flips, Math.max(1, moving.length - 1), 0);
  const sameNote = share(d.filter((x) => x === 0).length, d.length, 0);
  const top = Math.max(...midi);
  const topCount = midi.filter((m) => m === top).length;

  // phrases: a gap of 2+ steps, or a held note (a beat and a half or more) ends one
  const cuts: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const gap = line[i + 1].step - (line[i].step + line[i].len);
    if (gap >= 2 || line[i].len >= beat * 1.5) cuts.push(i);
  }
  const phrases: [number, number][] = [];
  let from = 0;
  for (const c of cuts) { phrases.push([from, c]); from = c + 1; }
  phrases.push([from, n - 1]);
  const bars = phrases.map(([a, b]) => (line[b].step + line[b].len - line[a].step) / barLen);
  const phraseOk = share(bars.filter((x) => x >= 1.5 && x <= 4.5).length, bars.length);
  const phraseBars = bars.reduce((s, x) => s + x, 0) / bars.length;
  const tight = share(phrases.filter(([a, b]) => Math.max(...midi.slice(a, b + 1)) - Math.min(...midi.slice(a, b + 1)) <= 14).length, phrases.length);
  const tones = (step: number) => chordTones(ctx.key, ctx.chordAt(step));
  const isTone = (h: GuitarHit) => tones(h.step).includes(((topOf(h) % 12) + 12) % 12);
  const ends = phrases.map(([, b]) => line[b]);
  const endsChord = share(ends.filter(isTone).length, ends.length);
  const endsLong = share(ends.filter((h) => h.len >= beat).length, ends.length);
  const onBar = line.filter((h) => ctx.bars.some((b) => b.start === h.step));
  const beatChord = share(onBar.filter(isTone).length, onBar.length);

  // a cell that comes back: 4 moves in a row (shape + length class), same twice or more, not a plain run or a repeated note
  const tok = (i: number) => shapeOf(d[i]) * 4 + lenClass(line[i].len);
  const N = 4;
  const seen = new Map<string, number[]>();
  const coverStrict = new Array(n).fill(false);
  const coverShape = new Array(n).fill(false);
  const plain = (i: number, f: (j: number) => number) => {
    const first = f(i);
    return d.slice(i, i + N).every((_, k) => f(i + k) === first) || d.slice(i, i + N).every((x) => x === 0);
  };
  const keyOf = (i: number, f: (j: number) => number) => Array.from({ length: N }, (_, k) => f(i + k)).join(',');
  const mark = (f: (j: number) => number, cover: boolean[]) => {
    seen.clear();
    for (let i = 0; i + N <= d.length; i++) {
      if (plain(i, f)) continue;
      const k = keyOf(i, f);
      const at = seen.get(k) ?? [];
      at.push(i);
      seen.set(k, at);
    }
    for (const at of seen.values()) {
      const far = at.filter((p, j) => j === 0 || p - at[j - 1] >= N);
      if (far.length < 2) continue;
      for (const p of far) for (let k = 0; k <= N; k++) cover[p + k] = true;
    }
  };
  mark(tok, coverStrict);
  mark((j) => shapeOf(d[j]), coverShape);
  const repeat = share(coverStrict.filter(Boolean).length, n, 0);
  const shapeCover = share(coverShape.filter(Boolean).length, n, 0);
  // phrases that start like an earlier one (the answer that repeats the call)
  const startKey = (a: number) => (a + N <= d.length ? keyOf(a, (j) => shapeOf(d[j])) : '');
  const keys = phrases.map(([a]) => startKey(a));
  const echo = share(keys.filter((k, i) => k && keys.slice(0, i).includes(k)).length, Math.max(1, phrases.length - 1), 0);

  const parts: Record<string, number> = {
    repeat: clamp01((0.7 * repeat + 0.3 * shapeCover) / 0.45) * 0.85 + 0.15 * clamp01(echo / 0.3),
    phrase: 0.6 * phraseOk + 0.4 * band(phraseBars, 0.5, 1.5, 4, 6),
    steps: band(steps, 0.1, 0.4, 0.75, 0.95),
    ends: 0.6 * endsChord + 0.4 * endsLong,
    leapBack,
    smooth: clamp01((0.62 - turns) / 0.2),
    range: tight,
    beats: beatChord,
    same: clamp01((0.3 - sameNote) / 0.22),
    top: topCount <= 2 ? 1 : topCount <= 4 ? 0.5 : 0,
  };
  let wsum = 0, ssum = 0;
  for (const k of Object.keys(TUNE_WEIGHTS)) { wsum += TUNE_WEIGHTS[k]; ssum += TUNE_WEIGHTS[k] * clamp01(parts[k]); }
  return { notes: n, phrases: phrases.length, score: ssum / wsum, steps, leapBack, turns, repeat, echo, phraseBars, phraseOk, tight, endsChord, endsLong, beatChord, sameNote, topCount, parts };
}
