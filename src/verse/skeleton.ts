// The vocal's skeleton (docs/VOCAL-TUNE.md, step B): the strong note of every phrase planned first, as one path through the chords'
// notes, the way the Tune-first solo does (src/parts/solotunefirst.ts). The line is then written toward those notes.
// - Where each phrase ends is a height drawn from the section's spine: a verse falls slowly, a chorus peaks early (the hook) and
//   comes home. A call (the first phrase of a pair) ends a little higher, an answer a little lower; the section's last phrase is low.
// - Each phrase's note is a chord note of the chord under its end. The notes are picked together (a best path): near their height,
//   not the same note again, no big leaps, an answer or an ending on the root, a call off it.
// - One phrase is the peak; the others stay a little under it.
// It does not write notes. It gives the writer two leans: the register the line is pulled toward (`target`), and the chord note a
// bar sits on at the end of a phrase (`bias`). Pure: the same input gives the same plan.

import { Rng } from '../rng';
import { SCALES, type Chord, type Mode } from '../theory';
import type { Mood } from '../tension';
import { profileFor } from './intervals';
import type { BarGrid } from './grid';
import { fifth, third, type BandNote, type ChordNote, type Gap, type Range, type ToneBias } from './verse';

export type SkelRole = 'call' | 'response' | 'end';
export interface Goal { step: number; midi: number; role: SkelRole; peak: boolean }

/** The sections that get a skeleton, and how far their spine swings (0-1 of half the range). */
export const SKEL_KINDS: Record<string, number> = { verse: 0.45, chorus: 0.65 };

export interface SkelIn {
  phrases: Gap[];
  chordAt: Chord[];
  key: number;
  mode: Mode;
  range: Range;
  kind: string;
  /** The song's mood: it tilts the spine (a rising mood falls less across a section, a falling one more) and sizes the swing and the leaps (intervals.ts). */
  mood: Mood;
  seed: string;
  /** Where this stretch of the section starts and ends (0-1), and whether it holds the section's last phrase. */
  u0: number;
  u1: number;
  last: boolean;
  grid: BarGrid;
  pent?: ReadonlySet<number>;
}
export interface Skeleton {
  goals: Goal[];
  /** The height the line starts the stretch at (the first phrase leans from it). */
  startH: number;
  /** The pitch the line leans toward at a step (rising or falling to each phrase's note). */
  target: (step: number) => number | undefined;
  /** The weight of a chord note at a bar start: higher for the one that is the goal at the end of a phrase. */
  bias: ToneBias;
}

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** The spine of a section kind: the height (-1 low, 1 high) at a place in it (0-1). */
export function spine(kind: string, u: number, fall = 1): number {
  if (kind === 'chorus') return u < 0.3 ? 0.5 + (u / 0.3) * 0.5 : 1 - ((u - 0.3) / 0.7) * 1.1 * fall;
  return 0.15 - 0.7 * fall * u;
}

/**
 * `reuse`: the plan of the leaf this one answers (same phrasing). Its notes are kept, and so its start, so the answer is the call's line
 * again and only its last phrase (when it ends the section) is planned fresh: the choruses' hook repeats, as the rest of the writer repeats it.
 */
export function planSkeleton(inp: SkelIn, reuse?: Pick<Skeleton, 'goals' | 'startH'>): Skeleton | null {
  const swing = SKEL_KINDS[inp.kind];
  const ph = inp.phrases;
  if (swing === undefined || !ph.length) return null;
  const { key, range, chordAt } = inp;
  const rng = new Rng(inp.seed + '|skel');
  const P = profileFor(inp.mood, inp.kind);
  // (a calm mood swings less and leaps less, a big-move mood swings more; a rising mood leans up across the section, a falling one down)
  const tilt = (P.up - 0.5) * 2, fall = Math.max(0.3, Math.min(1.5, 1 - 1.6 * tilt)), leapMax = Math.round(4 + P.size);
  const mid = (range.lo + range.hi) / 2, half = ((range.hi - range.lo) / 2) * swing * Math.max(0.7, Math.min(1.3, P.size / 3.5));
  const scale = inp.pent ?? new Set(SCALES[inp.mode].map((i) => (key + i) % 12));
  const at = (g: Gap) => chordAt[Math.max(0, Math.min(chordAt.length - 1, Math.floor(g.step + g.len - 1 + 1e-6)))];
  const rootPc = (c: Chord) => mod12(key + c.root);
  /** The chord's notes (root, 3rd, 5th) in the key, up and down the range. */
  const cands = (c: Chord): number[] => {
    const pcs = [0, third(c), fifth(c)].map((x) => mod12(key + c.root + x));
    const inKey = pcs.filter((p) => scale.has(p));
    const use = inKey.length ? inKey : pcs;
    const out: number[] = [];
    for (let m = Math.ceil(range.lo - 2); m <= range.hi + 2; m++) if (use.includes(mod12(m))) out.push(m);
    return out;
  };
  const n = ph.length;
  const roles: SkelRole[] = ph.map((g, i) => (inp.last && i === n - 1 ? 'end' : g.role ?? (i % 2 ? 'response' : 'call')));
  // the height each phrase's note is drawn to: the spine, a call a little up and an answer a little down
  const target = ph.map((g, i) => {
    const u = inp.u0 + (inp.u1 - inp.u0) * ((g.step + g.len) / (ph[n - 1].step + ph[n - 1].len));
    const off = roles[i] === 'call' ? 0.18 : roles[i] === 'response' ? -0.18 : -0.45;
    return mid + Math.max(-1, Math.min(1, spine(inp.kind, u, fall) + off)) * half;
  });
  // the peak: the phrase drawn highest (not the section's end, unless it is the only phrase)
  let peakAt = -1;
  if (reuse && reuse.goals.length === n) peakAt = reuse.goals.findIndex((g) => g.peak);
  if (peakAt < 0) target.forEach((t, i) => { if (roles[i] !== 'end' || n === 1) if (peakAt < 0 || t > target[peakAt]) peakAt = i; });
  const sets = ph.map((g, i) => cands(at(g)).map((m) => ({ m, i })));
  // (a phrase that is not the peak stays 2 semitones under the peak's note; the peak is the note nearest its height)
  const peakNote = sets[peakAt].reduce((b, x) => (Math.abs(x.m - target[peakAt]) < Math.abs(b.m - target[peakAt]) ? x : b), sets[peakAt][0]).m;
  const allowed = sets.map((s, i) => (n > 1 && i !== peakAt ? s.filter((x) => x.m <= peakNote - 2) : i === peakAt ? s.filter((x) => x.m === peakNote) : s));
  const use0 = allowed.map((s, i) => (s.length ? s : sets[i]));
  // (an answering leaf keeps the call's notes wherever its chord has them, but its own ending)
  const use = use0.map((s, i) => {
    const keep = reuse && reuse.goals.length === n && !(inp.last && i === n - 1) ? s.filter((x) => x.m === reuse.goals[i].midi) : [];
    return keep.length ? keep : s;
  });
  // the best path (each phrase's note, the notes before it counted)
  const best: { c: number; from: number }[][] = [];
  use.forEach((set, i) => {
    best.push(set.map((x) => {
      const c = at(ph[i]);
      let local = 0.45 * Math.abs(x.m - target[i]) + rng.next() * 0.9;
      const isRoot = mod12(x.m) === rootPc(c);
      if (roles[i] === 'response' || roles[i] === 'end') local += isRoot ? 0 : 2.5; else if (isRoot) local += 1.8;
      if (i === 0) return { c: local, from: -1 };
      let lo = Infinity, k0 = 0;
      use[i - 1].forEach((p, k) => {
        const d = x.m - p.m;
        const tc = best[i - 1][k].c + (d === 0 ? 3 : 0) + (Math.abs(d) > leapMax ? 1.5 : 0) + (roles[i] === 'response' && d > 0 ? 2 : 0) + (roles[i] === 'call' && d < 0 && i > 1 ? 1 : 0);
        if (tc < lo) { lo = tc; k0 = k; }
      });
      return { c: lo + local, from: k0 };
    }));
  });
  let k = 0;
  const lastRow = best[n - 1];
  for (let q = 1; q < lastRow.length; q++) if (lastRow[q].c < lastRow[k].c) k = q;
  const goals: Goal[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    goals[i] = { step: ph[i].step + ph[i].len, midi: use[i][k].m, role: roles[i], peak: i === peakAt };
    k = best[i][k].from;
  }
  // the lean: each phrase's line goes from the note before (the section's height, for the first) to its own note
  const startH = reuse && reuse.goals.length === n ? reuse.startH : mid + Math.max(-1, Math.min(1, spine(inp.kind, inp.u0, fall))) * half;
  const lean = (step: number): number | undefined => {
    for (let i = 0; i < n; i++) {
      const a = ph[i].step, b = ph[i].step + ph[i].len;
      if (step < a - 1e-6) return i ? goals[i - 1].midi : startH;
      if (step < b - 1e-6) {
        const from = i ? goals[i - 1].midi : startH, f = (step - a) / Math.max(1, b - a);
        return from + (goals[i].midi - from) * f;
      }
    }
    return goals[n - 1].midi;
  };
  // the chord note at the bar where a phrase ends: the one whose note is the goal's
  const endBar = ph.map((g) => inp.grid.index(g.step + g.len - 1));
  const bias: ToneBias = (step, tone: ChordNote) => {
    const bi = inp.grid.index(step);
    const i = endBar.indexOf(bi);
    if (i < 0) return 1;
    const c = chordAt[Math.max(0, Math.min(chordAt.length - 1, Math.floor(step + 1e-6)))];
    const pc = mod12(key + c.root + (tone === 'root' ? 0 : tone === 'third' ? third(c) : fifth(c)));
    return pc === mod12(goals[i].midi) ? 4 : 1;
  };
  return { goals, startH, target: lean, bias };
}

/**
 * The last note of every phrase sings the plan's note, where the chord under it has that note (the pitch class); else it stays. The
 * rules before this one (the chord note of the bar, the ending's degree) decide the note's class from the chord and the phrase's job;
 * this one only picks the octave and the note among the chord's when the plan asks for another.
 */
export function withGoals(notes: BandNote[], phrases: Gap[], goals: Goal[], chordAt: Chord[], key: number): BandNote[] {
  const out = notes.slice();
  phrases.forEach((g, i) => {
    let last = -1;
    for (let j = 0; j < out.length; j++) if (out[j].step >= g.step - 1e-6 && out[j].step < g.step + g.len - 1e-6) last = j;
    if (last < 0 || !goals[i]) return;
    const n = out[last];
    // (a mood's hanging end (the 7th, the 2nd, the 4th) or colour note is its own: the plan leaves it)
    if (n.endRole === 'hang' || n.colour) return;
    const c = chordAt[Math.max(0, Math.min(chordAt.length - 1, Math.floor(n.step + 1e-6)))];
    const tones = [0, third(c), fifth(c)].map((x) => mod12(key + c.root + x));
    if (!tones.includes(mod12(goals[i].midi)) || n.midi === goals[i].midi) return;
    out[last] = { ...n, midi: goals[i].midi };
  });
  return out;
}
