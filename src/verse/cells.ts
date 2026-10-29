// The vocal's cells (docs/VOCAL-TUNE.md, step C): the tune-first solo's way of making a phrase out of a small motif, turned to a singer.
// It runs last, on the line as it will sound, in the place of rule 39's copies (shapes.ts), and only rewrites pitches: the rhythm,
// the breaths, the long notes and every mood note stay as the rules before it made them.
// - A phrase's first cell (3 or 4 notes) is the line as written: the motif is stated.
// - A later stretch of the phrase with the same rhythm is sung to the motif's shape in scale steps: moved up or down the scale, or the
//   same again, or changed at its last note, or turned upside down (a contrast). The first one is moved or the same, the next one changed.
// - The notes just before a phrase's held ending run up to it by scale steps (the cadence), so the held note is arrived at.
// - An answer (a leaf that answers another) plays its call's cells again, wherever its rhythm has them, and runs up to its own ending.
// A cell is only placed where its long notes on strong beats stay on the chord's notes and every note stays in the voice's range;
// otherwise the notes stay as they were. Pure: the same input gives the same notes.

import { Rng } from '../rng';
import type { Chord } from '../theory';
import type { BarGrid } from './grid';
import { moverOf } from './shapes';
import type { BandNote, Gap, Range } from './verse';

const EPS = 1e-6;
/** The kinds of section that get cells. */
export const CELL_KINDS = new Set(['verse', 'chorus']);

export type CellKind = 'a' | 'seq' | 'same' | 'var' | 'contrast' | 'replay';
/** One cell placed: the phrase, where it starts (steps from the leaf's start), its notes, how it relates to the motif, how far it moved (scale steps). */
export interface CellInfo { phrase: number; step: number; n: number; kind: CellKind; d: number }
/** What a cell was: where in the phrase (note number), the rhythm classes, the shape (scale steps from its first note) and where it started on the scale. */
interface Placed { at: number; n: number; classes: number[]; deltas: number[]; anchor: number }
/** Every phrase's cells, for the leaves that answer this one. */
export interface CellMemo { phrases: Placed[][] }

export interface CellCtx {
  key: number;
  /** The pitch classes the line is in (the key's scale, or the pentatonic). */
  scale: ReadonlySet<number>;
  /** The chord on each step of the leaf. */
  chordAt: Chord[];
  range: Range;
  /** How often the mood's moves rise (0-1, intervals.ts): a moved cell leans that way. */
  up: number;
  /** The mood's size of move (intervals.ts): a big-move mood runs up to its endings less often, so its leaps stay. */
  size: number;
  seed: string;
}
export interface CellsOut { notes: BandNote[]; info: CellInfo[]; memo: CellMemo; runUps: number }

/** Rewrites that would change what a note is (a mood note, a bend, a long hold, a lead-in, a phrase end) are left alone. */
const isFixed = (x: BandNote): boolean =>
  x.colour !== undefined || x.inner !== undefined || x.bendTo !== undefined || x.surprise !== undefined || !!x.lead || !!x.longHold || !!x.end || x.endRole !== undefined || !!x.third || !!x.more || !!x.opener;

export function withCells(notes: BandNote[], phrases: Gap[], G: BarGrid, ctx: CellCtx, src?: CellMemo): CellsOut {
  const out = notes.map((n) => ({ ...n }));
  const info: CellInfo[] = [];
  const memo: CellMemo = { phrases: phrases.map(() => []) };
  const mv = moverOf(ctx), L = mv.scale.length;
  if (!L) return { notes: out, info, memo, runUps: 0 };
  const beat = G.beat;
  const lo = ctx.range.lo - 2, hi = ctx.range.hi + 2;
  const fixed = isFixed;
  // the scale as a ladder: a pitch's number is its octave and its step in the scale (a pitch off the scale has none)
  const lad = (m: number): number | undefined => {
    const pc = ((m % 12) + 12) % 12, j = mv.scale.indexOf(pc);
    return j < 0 ? undefined : Math.floor(m / 12) * L + j;
  };
  const unlad = (i: number) => Math.floor(i / L) * 12 + mv.scale[((i % L) + L) % L];
  // (the rhythm of a cell: its notes a beat or less, or longer; a phrase of this writer has few notes, so a finer split finds no repeat)
  const lenClass = (len: number) => (len <= beat + EPS ? 0 : 1);
  // (the tune score's finer split: a stretch with exactly the motif's rhythm is looked for first)
  const fineClass = (len: number) => (len <= beat / 2 + EPS ? 0 : len <= beat + EPS ? 1 : len <= beat * 2 + EPS ? 2 : 3);
  const rng = new Rng(ctx.seed + '|cells');
  let runUps = 0;

  phrases.forEach((g, pi) => {
    // the phrase's notes (their numbers in the line), the last one is the held ending
    const all: number[] = [];
    for (let i = 0; i < out.length; i++) if (out[i].step >= g.step - EPS && out[i].step < g.step + g.len - EPS) all.push(i);
    if (all.length < 4) return;
    const body = all.slice(0, -1), goalIx = all[all.length - 1];
    const goalL = lad(out[goalIx].midi);
    const free = (q: number) => !fixed(out[body[q]]) && lad(out[body[q]].midi) !== undefined;
    const classOf = (q: number) => lenClass(out[body[q]].len);
    const fineOf = (q: number) => fineClass(out[body[q]].len);
    const taken = new Set<number>();
    const prevMidi = (q: number) => (q > 0 ? out[body[q - 1]].midi : undefined);
    /** The window of `n` notes from body note `at` is free, and has these rhythm classes (the last note's may differ). */
    const fits = (at: number, n: number, classes: number[]) => {
      if (at < 0 || at + n > body.length) return false;
      for (let q = at; q < at + n; q++) if (!free(q) || taken.has(q)) return false;
      return classes.slice(0, n - 1).every((c, k) => classOf(at + k) === c);
    };
    /** Place a cell on the scale: its first note at ladder `anchor`, the others by the shape; the cost of it, or null when it can't be. */
    const place = (at: number, deltas: number[], anchor: number, pen: number) => {
      const mids: number[] = [];
      let viol = 0;
      for (let k = 0; k < deltas.length; k++) {
        const m = unlad(anchor + deltas[k]);
        if (m < lo || m > hi) return null;
        const x = out[body[at + k]];
        // (a long note on a strong beat sits on the chord's notes)
        if (x.len >= 2 - EPS && G.isStrong(x.step) && !mv.ct(m, x.step)) viol++;
        mids.push(m);
      }
      if (viol > 1) return null;
      const pm = prevMidi(at);
      const leap = pm === undefined ? 0 : Math.abs(mids[0] - pm);
      const inner = Math.max(0, ...mids.slice(1).map((m, k) => Math.abs(m - mids[k])));
      if (inner > 9) return null;
      return { mids, cost: viol * 2.5 + leap / 3 + pen + rng.next() * 0.4 };
    };
    const apply = (at: number, mids: number[]) => { mids.forEach((m, k) => { out[body[at + k]] = { ...out[body[at + k]], midi: m }; taken.add(at + k); }); };
    const record = (at: number, n: number, deltas: number[], anchor: number, kind: CellKind, d: number) => {
      memo.phrases[pi].push({ at, n, classes: Array.from({ length: n }, (_, k) => classOf(at + k)), deltas, anchor });
      info.push({ phrase: pi, step: out[body[at]].step, n, kind, d });
    };
    const shapeOf = (at: number, n: number): { deltas: number[]; anchor: number } | null => {
      const a = lad(out[body[at]].midi);
      if (a === undefined) return null;
      const deltas: number[] = [];
      for (let k = 0; k < n; k++) { const l = lad(out[body[at + k]].midi); if (l === undefined) return null; deltas.push(l - a); }
      return { deltas, anchor: a };
    };

    const mine = src && src.phrases.length === phrases.length ? src.phrases[pi] : [];
    if (mine.length) {
      // an answer: the call's cells again, where this phrase's rhythm has them (the anchor kept when its chords allow)
      for (const c of mine) {
        if (!fits(c.at, c.n, c.classes)) continue;
        let best: { mids: number[]; cost: number; s: number } | null = null;
        for (const s of [0, 1, -1, 2, -2]) {
          const r = place(c.at, c.deltas, c.anchor + s, Math.abs(s) * 1.2);
          if (r && (!best || r.cost < best.cost)) best = { ...r, s };
        }
        if (!best) continue;
        apply(c.at, best.mids);
        record(c.at, c.n, c.deltas, c.anchor + best.s, 'replay', best.s);
      }
    } else if (body.length >= 6) {
      // a fresh phrase: the motif stated at the start, then the later stretches that have its rhythm
      let first = 0;
      while (first < body.length && !free(first)) first++;
      for (const n of [4, 3]) {
        if (first + 2 * n > body.length) continue;
        const a = shapeOf(first, n);
        if (!a) continue;
        const classes = Array.from({ length: n }, (_, k) => classOf(first + k));
        if (!fits(first, n, classes)) continue;
        // where the later stretches are: the next two that fit, not touching the motif
        const spots: number[] = [];
        const fine = Array.from({ length: n }, (_, k) => fineOf(first + k));
        // (the exact rhythm first, then the rough one)
        for (const exact of [true, false]) {
          for (let q = first + n; q + n <= body.length && spots.length < 2; q++) {
            if (spots.includes(q) || spots.some((s) => q < s + n && s < q + n)) continue;
            if (fits(q, n, classes) && (!exact || fine.slice(0, n - 1).every((c, k) => fineOf(q + k) === c))) spots.push(q);
          }
        }
        spots.sort((x, y) => x - y);
        if (!spots.length) continue;
        taken.clear();
        for (let q = first; q < first + n; q++) taken.add(q);
        record(first, n, a.deltas, a.anchor, 'a', 0);
        const heading = goalL === undefined ? 0 : Math.sign(goalL - a.anchor);
        spots.forEach((at, si) => {
          const kind = rng.weighted<CellKind>(si === 0 ? [['seq', 5], ['same', 2], ['var', 3]] : [['seq', 2], ['var', 3], ['contrast', 2], ['same', 1]]);
          const base = kind === 'contrast' ? a.deltas.map((x) => -x) : a.deltas.slice();
          const shifts = kind === 'same' ? [0] : kind === 'contrast' ? [0, 1, -1, 2, -2] : [1, -1, 2, -2, 3, -3];
          const prevA = si === 0 ? a.anchor : memo.phrases[pi][memo.phrases[pi].length - 1].anchor;
          let best: { mids: number[]; cost: number; s: number; deltas: number[] } | null = null;
          for (const s of shifts) {
            // (moved toward where the phrase is going, and the way the mood rises or falls)
            const lean = (heading !== 0 && Math.sign(s) === heading ? -0.6 : 0) + (Math.sign(s) === (ctx.up >= 0.5 ? 1 : -1) ? -0.3 * Math.abs(ctx.up - 0.5) * 2 : 0);
            // (changed: the last move of the cell is a scale step more or less)
            const variants = kind === 'var' ? [1, -1].map((v) => base.map((x, k) => (k === base.length - 1 ? x + v : x))) : [base];
            for (const deltas of variants) {
              const r = place(at, deltas, prevA + s, lean + (kind === 'contrast' ? 0.4 : 0));
              if (r && (!best || r.cost < best.cost)) best = { ...r, s, deltas };
            }
          }
          if (!best) return;
          apply(at, best.mids);
          record(at, n, best.deltas, prevA + best.s, kind, best.s);
        });
        break;
      }
    }

    // the cadence: the short notes just before the held ending run up to it by scale steps
    if (goalL !== undefined && body.length >= 2 && rng.chance(Math.max(0.3, Math.min(0.85, 1.25 - 0.22 * ctx.size)))) {
      let r = rng.chance(0.2) ? 3 : 2;
      const run: number[] = [];
      for (let q = body.length - 1; q >= 0 && run.length < r; q--) {
        const x = out[body[q]];
        if (taken.has(q) || fixed(x) || lad(x.midi) === undefined || x.len > beat + EPS) break;
        run.unshift(q);
      }
      r = run.length;
      if (r >= 1) {
        const before = run[0] > 0 ? lad(out[body[run[0] - 1]].midi) : undefined;
        const approach = before === undefined || before === goalL ? (ctx.up >= 0.5 ? -1 : 1) : Math.sign(before - goalL);
        const mids = run.map((_, k) => unlad(goalL + approach * (r - k)));
        if (mids.every((m) => m >= lo && m <= hi) && mids.some((m, k) => m !== out[body[run[k]]].midi)) {
          // (no new lurch into the run: a leap in from the note before it stays under an octave)
          const pm = run[0] > 0 ? out[body[run[0] - 1]].midi : undefined;
          if (pm === undefined || Math.abs(mids[0] - pm) <= 9) {
            run.forEach((q, k) => { out[body[q]] = { ...out[body[q]], midi: mids[k] }; });
            runUps++;
          }
        }
      }
    }
  });
  return { notes: out, info, memo, runUps };
}
