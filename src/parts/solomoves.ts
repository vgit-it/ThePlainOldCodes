// Moves between the core notes (docs/SOLO-CORE.md, step 2). The cores are picked as in step 1 (src/parts/solocore.ts); the gaps between
// them are filled with moves: a lick, a shape, a run, a rest. Every move can show up in every genre; the genre, the mood and the place
// in the solo only change how likely each one is. A rare move (weight 1 in the genre) shows up once per solo at most, and the same move
// never comes twice in a row. One short idea, the signature lick, is stated early and comes back changed.
// Played plain (no player on top yet), so the plan can be heard cleanly. Step 3 (the player) will add the techniques.

import type { ChordPart, Song, TravelMove } from '../idea';
import { Rng } from '../rng';
import type { Mood } from '../tension';
import { NOTE_NAMES, chordPc } from '../theory';
import { type Profile, intervalCost } from '../verse/intervals';
import { groupStarts } from '../rhythm';
import { MINORISH, chordTones } from './guitar2';
import type { LickFit, PlacedNote } from './licks';
import type { Core } from './solocore';
import { scaleOf } from './solofigure';

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export type MoveName =
  | 'repeat' | 'repeat-over-change' | 'answer' | 'sequence' | 'wave' | 'dive-climb' | 'stairs' | 'arch' | 'zigzag' | 'leap-fill' | 'run'
  | 'trill' | 'arpeggio' | 'pedal' | 'neighbour' | 'enclosure' | 'double-stop' | 'bend-release' | 'slide-in' | 'stab' | 'space';
/** A move, or a single grace note into a core after a gap shorter than a beat. */
export type PlannedMove = MoveName | 'grace';

/** The shortest gap each move fits (16ths). */
export const MIN_GAP: Record<MoveName, number> = {
  repeat: 8, 'repeat-over-change': 8, answer: 8, sequence: 8, wave: 6, 'dive-climb': 8, stairs: 4, arch: 6, zigzag: 6, 'leap-fill': 4, run: 4,
  trill: 4, arpeggio: 4, pedal: 6, neighbour: 2, enclosure: 2, 'double-stop': 4, 'bend-release': 4, 'slide-in': 2, stab: 2, space: 0,
};

export const GENRE_ORDER = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
/** How much each genre leans on each move: 3 leans in, 2 normal, 1 rare (once per solo at most). Columns as GENRE_ORDER. */
export const MOVE_LEAN: Record<MoveName, number[]> = {
  repeat:               [3, 2, 3, 3, 2, 3, 2],
  'repeat-over-change': [3, 2, 2, 3, 1, 2, 2],
  answer:               [2, 3, 2, 2, 2, 2, 2],
  sequence:             [2, 2, 1, 2, 3, 1, 2],
  wave:                 [3, 2, 2, 2, 2, 2, 2],
  'dive-climb':         [2, 2, 1, 2, 3, 2, 2],
  stairs:               [2, 3, 1, 2, 2, 2, 2],
  arch:                 [2, 3, 1, 2, 2, 2, 2],
  zigzag:               [1, 1, 2, 2, 3, 1, 3],
  'leap-fill':          [2, 2, 1, 2, 2, 2, 2],
  run:                  [2, 1, 1, 3, 3, 1, 2],
  trill:                [1, 1, 1, 2, 3, 1, 3],
  arpeggio:             [1, 2, 1, 2, 3, 1, 2],
  pedal:                [2, 1, 1, 3, 3, 1, 2],
  neighbour:            [2, 3, 2, 2, 1, 2, 2],
  enclosure:            [2, 2, 3, 2, 2, 1, 2],
  'double-stop':        [3, 1, 2, 3, 1, 2, 2],
  'bend-release':       [3, 2, 1, 3, 2, 3, 2],
  'slide-in':           [2, 3, 2, 2, 1, 3, 2],
  stab:                 [1, 1, 3, 1, 1, 1, 2],
  space:                [3, 3, 3, 2, 1, 3, 2],
};
export const MOVE_NAMES = Object.keys(MOVE_LEAN) as MoveName[];
/** 3 leans in, 2 is normal, 1 is rare. */
const weightOf = (n: number) => (n >= 3 ? 2.5 : n === 2 ? 1 : 0.3);
/** A move that is rare in a genre appears once per solo at most. */
export const isRare = (m: MoveName, genre: string) => MOVE_LEAN[m][Math.max(0, GENRE_ORDER.indexOf(genre))] === 1;

/** The moves each mood leans toward (x1.6). */
const MOOD_LEAN: Record<Mood, MoveName[]> = {
  happy: ['stairs', 'arch', 'answer', 'neighbour', 'slide-in'],
  triumphant: ['sequence', 'dive-climb', 'run', 'double-stop'],
  nostalgic: ['bend-release', 'slide-in', 'answer', 'space'],
  melancholic: ['wave', 'bend-release', 'stairs', 'space'],
  dreamy: ['slide-in', 'space', 'arpeggio', 'neighbour'],
  tense: ['trill', 'zigzag', 'enclosure', 'pedal'],
  angry: ['stab', 'run', 'double-stop', 'pedal', 'zigzag'],
  dark: ['dive-climb', 'pedal', 'trill', 'bend-release'],
};
/** Which way a mood likes a move to go (+1 up, -1 down; a wave goes down first). */
const MOOD_DIR: Partial<Record<Mood, Partial<Record<MoveName, 1 | -1>>>> = {
  happy: { stairs: 1 }, triumphant: { sequence: 1 }, melancholic: { wave: -1, stairs: -1 },
};
/** Where in the solo a move is more likely (x1.5): early on, into the climax core, after the climax. */
const PLACE_EARLY: MoveName[] = ['space', 'repeat', 'answer', 'bend-release', 'slide-in'];
const PLACE_INTO: MoveName[] = ['run', 'sequence', 'dive-climb', 'stairs', 'trill'];
const PLACE_AFTER: MoveName[] = ['wave', 'stairs', 'bend-release', 'space'];
/** Busy moves are x1.3 where the energy is high, sparse ones where it is low. */
const BUSY: MoveName[] = ['run', 'trill', 'arpeggio', 'zigzag', 'sequence', 'pedal'];
const SPARSE: MoveName[] = ['space', 'bend-release', 'slide-in', 'neighbour'];

/** A short idea, its rhythm and its shape in scale steps: the signature lick, or the cell a repeat plays. */
export interface Cell { lens: number[]; shape: number[]; pent: boolean }

export interface MovePlan {
  /** The room the move has (16ths): from the end of the core before (or the start) to the start of the core it leads into. */
  from: number; to: number;
  gap: number; into: number;
  move: PlannedMove;
  label?: 'signature' | 'return';
  /** What a return changes: an extra note, higher, a bend on the top note. */
  change?: 'extra note' | 'higher' | 'bend';
  /** The cell of a signature or a return. */
  sig?: Cell;
  /** The chance the shape goes up. */
  up: number;
  /** Where in the solo it is. */
  phase: 'early' | 'into' | 'after' | 'mid';
  /** Its own dice, so the same plan is written the same way every time. */
  seed: string;
}

export interface MoveCtx {
  rng: Rng; song: Song; chords: ChordPart; fit: LickFit; mood: Mood;
  E: (g: number) => number;
  window: (g: number) => [number, number];
  profile: (g: number) => Profile;
  /** The velocity of a note at a step. */
  vel: (g: number) => number;
  drums?: { kick: number[]; snare: number[] };
}

export interface MoveOut { notes: PlacedNote[]; rec: TravelMove }

// ---------------------------------------------------------------- the key's notes

interface Env {
  full: number[]; pent: number[]; start: number;
  barOf: (g: number) => Song['bars'][number];
  isBeat: (g: number) => boolean;
}
const envs = new WeakMap<MoveCtx, Env>();
function envOf(c: MoveCtx): Env {
  let e = envs.get(c);
  if (e) return e;
  const { song } = c;
  const full = scaleOf(song).notes;
  const minor = MINORISH.includes(song.mode);
  const want = new Set((minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]).map((x) => (x + song.key) % 12));
  const pent = full.filter((m) => want.has(mod(m, 12)));
  const barOf = (g: number) => { for (let i = song.bars.length - 1; i >= 0; i--) if (g >= song.bars[i].start) return song.bars[i]; return song.bars[0]; };
  const [lo, hi] = c.window(0);
  e = {
    full, pent: pent.length >= 4 ? pent : full, start: Math.round((lo + hi) / 2), barOf,
    isBeat: (g) => { const b = barOf(g); return groupStarts(b.groups).includes(g - b.start); },
  };
  envs.set(c, e);
  return e;
}
const nearest = (list: number[], m: number) => { let b = 0, bd = Infinity; for (let i = 0; i < list.length; i++) { const d = Math.abs(list[i] - m); if (d < bd) { bd = d; b = i; } } return b; };

/** How many scale steps from `a` to `b` (the scale notes above the lower one, up to the higher one). */
export function scaleSteps(song: Song, a: number, b: number): number {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return scaleOf(song).notes.filter((s) => s > lo && s <= hi).length;
}

// ---------------------------------------------------------------- the planner

interface Slot { from: number; to: number; gap: number; into: number; rest?: boolean; grace?: boolean; plan?: MovePlan }

/** A cell of 2 to 4 notes (8ths and quarters) that fits in `maxSpan` 16ths. */
function makeCell(rng: Rng, maxSpan: number, fits: (span: number) => boolean = () => true): Cell | null {
  const T = [[2, 2], [4, 2], [2, 4], [4, 4], [2, 2, 2], [4, 2, 2], [2, 2, 4], [2, 4, 2], [2, 2, 2, 2]].filter((l) => l.reduce((a, b) => a + b, 0) <= maxSpan && fits(l.reduce((a, b) => a + b, 0)));
  if (!T.length) return null;
  const lens = rng.pick(T), pent = rng.chance(0.6);
  return { lens, shape: randomShape(rng, lens.length, pent), pent };
}
function randomShape(rng: Rng, n: number, pent: boolean): number[] {
  for (let g = 0; g < 20; g++) {
    const s = [0];
    for (let i = 1; i < n; i++) s.push(s[i - 1] + rng.pick([-2, -1, 1, 2]));
    // (not wider than about a 5th, or it will not fit the window beside a core near its edge)
    if (new Set(s).size >= Math.min(n, 2) + (n > 2 ? 1 : 0) && Math.max(...s) - Math.min(...s) <= (pent ? 2 : 3)) return s;
  }
  return Array.from({ length: n }, (_, i) => i % 2);
}
const cellSpan = (cell: Cell) => cell.lens.reduce((a, b) => a + b, 0);

/**
 * Which move goes in each gap between the cores (and the stretch before the first core). A gap shorter than a beat gets nothing, or a
 * grace note; one longer than a bar and a half gets two moves, or a rest and a move. The signature lick goes in the first gap of 8
 * 16ths or more that is not the climax's, and comes back in later ones. Every move is checked to be writable before it is picked.
 */
export function planMoves(c: MoveCtx, cores: Core[]): MovePlan[] {
  const { rng, song, mood, chords } = c;
  const env = envOf(c);
  const genre = song.partGenres.strum;
  const gi = Math.max(0, GENRE_ORDER.indexOf(genre));
  const ci = cores.findIndex((k) => k.role === 'climax');

  // ---- the gaps, cut into slots
  const slots: Slot[] = [];
  let gapN = 0;
  cores.forEach((k, into) => {
    const from = into ? cores[into - 1].step + cores[into - 1].len : 0, to = k.step, len = to - from;
    if (len <= 0) return;
    const bar = env.barOf(from), beat = Math.min(...bar.groups);
    if (len < beat) {
      if (len >= 2 && rng.chance(0.5)) slots.push({ from: to - 2, to, gap: gapN, into, grace: true });
      gapN++;
      return;
    }
    const gap = gapN++;
    if (len > 1.5 * bar.len) {
      // (cut on a beat near the middle; or the rest first and one move, which leads into the core)
      const restFirst = rng.chance(0.35) && (!isRare('space', genre) || !slots.some((x) => x.rest));
      const aim = from + len * (restFirst ? 0.4 : 0.5);
      let cut = -1, best = Infinity;
      for (let s = Math.ceil((from + 8) / 2) * 2; s <= to - 8; s += 2) {
        if (!env.isBeat(s)) continue;
        if (Math.abs(s - aim) < best) { best = Math.abs(s - aim); cut = s; }
      }
      if (cut > 0) {
        slots.push({ from, to: cut, gap, into, rest: restFirst }, { from: cut, to, gap, into });
        return;
      }
    }
    slots.push({ from, to, gap, into });
  });

  // ---- the signature lick: stated in the first gap of 8 or more (not the climax's), back in later ones
  const prevOf = (into: number) => (into > 0 ? cores[into - 1].midi : env.start);
  const mk = (s: Slot, move: PlannedMove, extra: Partial<MovePlan> = {}): MovePlan => {
    const core = cores[s.into], mid = (s.from + s.to) / 2;
    const phase: MovePlan['phase'] = s.into === ci ? 'into' : ci >= 0 && s.from >= cores[ci].step + cores[ci].len ? 'after'
      : (ci >= 0 ? mid < cores[ci].step / 2 : mid < song.total / 2) ? 'early' : 'mid';
    let up = prevOf(s.into) < core.midi ? 0.65 : 0.35;
    if (phase === 'into') up = 0.85; else if (phase === 'after') up = 0.2;
    const d = move === 'grace' ? undefined : MOOD_DIR[mood]?.[move];
    if (d) up = clamp(up + 0.3 * d, 0.1, 0.9);
    return { from: s.from, to: s.to, gap: s.gap, into: s.into, move, up, phase, seed: 'mv-' + rng.next(), ...extra };
  };
  const placeable = (s: Slot) => !s.rest && !s.grace;
  const works = (s: Slot, move: PlannedMove, extra: Partial<MovePlan>) => {
    const p = mk(s, move, extra);
    return writeMove(c, p, cores, prevOf(s.into)).rec.notes > 0 ? p : null;
  };
  let sigAt = -1;
  const sigGapOk = (s: Slot) => placeable(s) && s.to - s.from >= 8 && s.into !== ci;
  /** The returns for a signature stated in slot `at`: the most that fit, side by side as little as can be, each changing something else. */
  const findReturns = (at: number, sig: Cell, kind: 'repeat' | 'answer', want: number): [number, MovePlan][] => {
    const elig = slots.map((_, i) => i).filter((i) => i > at && placeable(slots[i]) && slots[i].to - slots[i].from >= cellSpan(sig) + 2);
    const changes = rng.shuffle(['extra note', 'higher', 'bend'] as const);
    let best: [number, MovePlan][] = [];
    const touching = (set: [number, MovePlan][]) => set.filter(([i]) => set.some(([j]) => j === i - 1)).length;
    for (let t = 0; t < 8 && best.length < want; t++) {
      const set: [number, MovePlan][] = [];
      for (const i of rng.shuffle(elig)) {
        if (set.length >= want) break;
        for (const change of changes.filter((ch) => !set.some(([, q]) => q.change === ch))) {
          const p = works(slots[i], kind, { label: 'return', sig, change });
          if (p) { set.push([i, p]); break; }
        }
      }
      if (set.length > best.length || (set.length === best.length && touching(set) < touching(best))) best = set;
    }
    return best;
  };
  for (let i = 0; i < slots.length && sigAt < 0; i++) {
    const s = slots[i];
    if (!sigGapOk(s)) continue;
    // (a cell that the later gaps can hold too: no longer than the room for the returns it needs, down to 4)
    const later = slots.slice(i + 1).filter(placeable).map((x) => x.to - x.from).sort((a, b) => b - a);
    const need = Math.min(song.bars.length >= 6 ? 2 : 1, later.length);
    const want = song.bars.length >= 6 ? rng.int(2, 3) : rng.int(1, 2);
    const weight = (m: MoveName) => weightOf(MOVE_LEAN[m][gi]) * (MOOD_LEAN[mood].includes(m) ? 1.6 : 1);
    let best: { plan: MovePlan; set: [number, MovePlan][] } | null = null;
    // (a few cells: the first that comes back as often as it should, or the one that comes back most)
    for (let t = 0; t < 6 && (!best || best.set.length < need); t++) {
      const cell = makeCell(rng, Math.min(8, Math.floor((s.to - s.from) / 2), need ? Math.max(4, later[need - 1] - 2) : 8));
      if (!cell) break;
      const kinds = rng.chance(weight('repeat') / (weight('repeat') + weight('answer'))) ? (['repeat', 'answer'] as const) : (['answer', 'repeat'] as const);
      for (const kind of kinds) {
        const plan = works(s, kind, { label: 'signature', sig: cell });
        if (!plan) continue;
        const set = findReturns(i, cell, kind, want);
        if (!best || set.length > best.set.length) best = { plan, set };
        break;
      }
    }
    if (!best) continue;
    sigAt = i;
    s.plan = best.plan;
    best.set.sort((a, b) => a[0] - b[0]).forEach(([k, p]) => {
      // (a return is a repeat or an answer, whichever the move beside it is not; it is written the same either way)
      const side = slots.slice(0, k).reverse().find((x) => !x.grace)?.plan;
      p.move = side ? (side.move === 'repeat' ? 'answer' : 'repeat') : (best!.plan.move as 'repeat' | 'answer');
      slots[k].plan = p;
    });
  }

  // ---- the rest of the slots, in order: no move twice in a row, a rare one once
  const plans: MovePlan[] = [];
  const usedRare = new Set<MoveName>();
  let before: PlannedMove | null = null;
  let prev = prevOf(0), lastInto = -1;
  slots.forEach((s, si) => {
    if (s.into !== lastInto) { prev = prevOf(s.into); lastInto = s.into; }
    let plan: MovePlan | null = null;
    if (s.grace) plan = mk(s, 'grace');
    else if (s.rest) plan = mk(s, 'space');
    else if (s.plan) plan = s.plan;
    else {
      const len = s.to - s.from, mid = (s.from + s.to) / 2;
      const nx = slots.slice(si + 1).find((x) => !x.grace), nextFixed = nx?.rest ? 'space' : nx?.plan?.move;
      const crosses = chords.timeline.some((e) => e.step > s.from && e.step < s.to);
      const e = c.E(mid);
      const base = mk(s, 'space');
      const cand: [MoveName, number][] = [];
      for (const m of MOVE_NAMES) {
        if (MIN_GAP[m] > len || m === before || m === nextFixed) continue;
        if (m === 'repeat-over-change' && !crosses) continue;
        if (isRare(m, genre) && usedRare.has(m)) continue;
        let w = weightOf(MOVE_LEAN[m][gi]);
        if (MOOD_LEAN[mood].includes(m)) w *= 1.6;
        if ((base.phase === 'into' && PLACE_INTO.includes(m)) || (base.phase === 'early' && PLACE_EARLY.includes(m)) || (base.phase === 'after' && PLACE_AFTER.includes(m))) w *= 1.5;
        if (e > 0.3 && BUSY.includes(m)) w *= 1.3;
        if (e < -0.3 && SPARSE.includes(m)) w *= 1.3;
        cand.push([m, w]);
      }
      while (cand.length && !plan) {
        const m = rng.weighted(cand);
        cand.splice(cand.findIndex((x) => x[0] === m), 1);
        const p = mk(s, m);
        if (m === 'space' || writeMove(c, p, cores, prev).rec.notes > 0) plan = p;
      }
      // (nothing fits: the smallest moves, then a rest, as the last resort)
      for (const m of ['neighbour', 'enclosure', 'slide-in', 'stairs'] as const) {
        if (plan || m === before || m === nextFixed || MIN_GAP[m] > len) continue;
        const p = mk(s, m);
        if (writeMove(c, p, cores, prev).rec.notes > 0) plan = p;
      }
      plan ??= mk(s, 'space');
    }
    if (plan.move !== 'grace') {
      before = plan.move;
      if (isRare(plan.move, genre)) usedRare.add(plan.move);
    }
    plans.push(plan);
    const out = writeMove(c, plan, cores, prev);
    if (out.rec.notes > 0) prev = out.rec.last;
  });
  return plans;
}

/** Writes every plan in order (each leads on from the note before). */
export function writeMoves(c: MoveCtx, plans: MovePlan[], cores: Core[]): MoveOut[] {
  const env = envOf(c);
  const outs: MoveOut[] = [];
  let prev = env.start, lastInto = -1;
  for (const p of plans) {
    if (p.into !== lastInto) { prev = p.into > 0 ? cores[p.into - 1].midi : env.start; lastInto = p.into; }
    const out = writeMove(c, p, cores, prev);
    if (out.rec.notes > 0) prev = out.rec.last;
    outs.push(out);
  }
  return outs;
}

// ---------------------------------------------------------------- the writers

/** A note on its way out (the player's marks in `o`; `chrom`: a chromatic passing note, allowed in an enclosure only). */
interface N { step: number; len: number; midi: number; o?: Partial<PlacedNote>; chrom?: boolean }
interface Made { notes: N[]; tap?: boolean; fast?: boolean }

/**
 * The notes of one move. The same plan and the same previous note always give the same notes. It tries a few ways (the end note, the
 * direction, the length) and keeps those that fit: inside the playable window, in the key, on the grid, ending within 2 scale steps of
 * the core. The mood's interval liking picks among them. Notes: none for a rest or when nothing fits.
 */
export function writeMove(c: MoveCtx, p: MovePlan, cores: Core[], prev: number): MoveOut {
  const seen = written.get(p);
  if (seen && seen.prev === prev && seen.move === p.move) return seen.out;
  const out = writeMoveOnce(c, p, cores, prev);
  written.set(p, { prev, move: p.move, out });
  return out;
}
/** What a plan was written as the last time (the planner tries a move before it picks it). */
const written = new WeakMap<MovePlan, { prev: number; move: PlannedMove; out: MoveOut }>();

function writeMoveOnce(c: MoveCtx, p: MovePlan, cores: Core[], prev: number): MoveOut {
  const env = envOf(c), core = cores[p.into];
  const rec = (notes: N[], extra: Partial<TravelMove> = {}): TravelMove => ({
    move: p.move, from: p.from, to: p.to, gap: p.gap, into: p.into, label: p.label, change: p.label === 'return' ? p.change : undefined,
    notes: notes.length, last: notes.length ? notes[notes.length - 1].midi : 0, core: core.midi, ...extra,
  });
  const empty = (): MoveOut => ({ notes: [], rec: rec([]) });
  if (p.move === 'space') return empty();
  const P = c.profile(p.to);
  const done = new Rng(p.seed + ':pick');
  const cands: { made: Made; dir: 1 | -1; cost: number }[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const rng = new Rng(p.seed + ':' + attempt);
    const first = rng.chance(p.up) ? 1 : -1;
    const dir = (attempt % 4 < 2 ? first : -first) as 1 | -1;
    const made = make(c, env, p, core, prev, dir, rng);
    if (!made) continue;
    if (!valid(c, made, p, core)) continue;
    const ns = made.notes.slice().sort((a, b) => a.step - b.step), a = ns[0], z = ns[ns.length - 1];
    const cost = intervalCost(P, prev, a.midi, 0, false) + intervalCost(P, z.midi, core.midi, ns.length > 1 ? z.midi - ns[ns.length - 2].midi : 0, false);
    cands.push({ made: { ...made, notes: ns }, dir, cost });
  }
  if (!cands.length) return empty();
  const lo = Math.min(...cands.map((x) => x.cost));
  const pick = done.weighted(cands.map((x) => [x, Math.exp(-(x.cost - lo) / 1.5)] as [typeof x, number]));
  const notes: PlacedNote[] = pick.made.notes.map((n) => ({
    step: n.step, midi: n.midi, len: n.len, vel: clamp(c.vel(n.step), 0.3, 1), bend: 0, art: 'pick', ...n.o,
  }));
  const first = pick.made.notes[0];
  return {
    notes,
    rec: rec(pick.made.notes, { dir: pick.dir, ...(pick.made.tap || (p.move === 'leap-fill' && Math.abs(first.midi - prev) >= 9) ? { tap: true } : {}) }),
  };
}

/**
 * The playable range of a move: the window at the core it leads into (so the lead-in sits in the core's register, even where the energy
 * is climbing), widened a little where the core itself sits at the edge of its window.
 */
export function moveWindow(c: MoveCtx, core: { step: number; midi: number }): [number, number] {
  const [lo, hi] = c.window(core.step);
  return [Math.min(lo, core.midi - 3), Math.max(hi, core.midi + 3)];
}

/** Whether the notes fit: the window, the key, the grid, no overlap, and the last note leading into the core. */
function valid(c: MoveCtx, made: Made, p: MovePlan, core: Core): boolean {
  const ns = made.notes.slice().sort((a, b) => a.step - b.step);
  if (!ns.length) return false;
  let end = p.from, chrom = 0;
  const [lo, hi] = moveWindow(c, core);
  for (const n of ns) {
    if (n.step < end || n.step + n.len > p.to || n.len < 1) return false;
    end = n.step + n.len;
    if (!made.fast && n.step % 2) return false;
    const ps = [n.midi, n.midi + (n.o?.trill ?? 0), n.midi - (n.o?.dyad ?? 0)];
    if (ps.some((m) => m < lo || m > hi)) return false;
    for (const m of ps) if (!c.fit.inKey(m)) { if (!n.chrom) return false; chrom++; }
  }
  if (chrom > 1) return false;
  if (p.move === 'stab') return true;
  const z = ns[ns.length - 1];
  return scaleSteps(c.song, z.midi, core.midi) <= 2 || z.o?.art === 'slide' || (z.o?.bend ?? 0) > 0;
}

/** The notes one move would play (not yet checked). */
function make(c: MoveCtx, env: Env, p: MovePlan, core: Core, prev: number, dir: 1 | -1, rng: Rng): Made | null {
  const { full } = env, { fit, song } = c;
  const L = p.to - p.from;
  const ci = nearest(full, core.midi);
  const mid = (p.from + p.to) / 2;
  const move = p.move;

  /** The index the move ends on: a step or two from the core, on the side it comes from. */
  const endIdx = () => {
    const mag = rng.weighted([[1, 6], [2, 3], [0, 1]] as [number, number][]);
    return clamp(ci + mag * (rng.chance(0.8) ? -dir : dir), 0, full.length - 1);
  };
  /** The notes sit right up to the core: `n` of them, `u` long, as many as the room holds (in [nmin, nmax]). */
  const lay = (nmin: number, nmax: number, units: number[]) => {
    const whole = units.every((u) => u >= 2);
    const end = whole ? p.to - (p.to % 2) : p.to, room = end - (whole ? p.from + (p.from % 2) : p.from);
    let best: { u: number; n: number } | null = null;
    for (const u of units) {
      const n = Math.min(nmax, Math.floor(room / u));
      if (n >= nmin && (!best || n * u > best.n * best.u)) best = { u, n };
    }
    if (!best) return null;
    let n = best.n;
    if (n > nmin && rng.chance(0.3)) n = rng.int(nmin, n);
    return { u: best.u, n, starts: Array.from({ length: n }, (_, i) => end - (n - i) * best!.u) };
  };
  const busyE = c.E(mid) > 0.3;
  const slowUnits = () => (busyE ? [2] : [2, 4]);
  const chordTone = (i: number, step: number, list: number[]) => fit.isTone(list[clamp(i, 0, list.length - 1)], step);
  /** Notes from steps in a list, with the strong beats leaning to chord notes (without breaking the shape). */
  const fromIdx = (idx: number[], starts: number[], lens: number[], list: number[] = full): N[] => {
    const at = idx.slice();
    for (let i = 0; i < at.length - 1; i++) {
      if (!env.isBeat(starts[i]) || chordTone(at[i], starts[i], list) || at.filter((x) => x === at[i]).length > 1 || !rng.chance(0.7)) continue;
      for (const d of rng.shuffle([-1, 1])) {
        const v = at[i] + d;
        if (v < 0 || v >= list.length || !chordTone(v, starts[i], list)) continue;
        const same = (j: number) => j < 0 || j >= at.length || Math.sign(at[i] - at[j]) === Math.sign(v - at[j]);
        if (same(i - 1) && same(i + 1)) { at[i] = v; break; }
      }
    }
    return at.map((x, i) => ({ step: starts[i], len: lens[i], midi: list[clamp(x, 0, list.length - 1)] }));
  };
  /** A shape given as steps from the end note. */
  const shaped = (rel: number[], units: number[], nmin = 2): Made | null => {
    const l = lay(nmin, rel.length, units);
    if (!l) return null;
    const r = rel.slice(rel.length - l.n), t = endIdx();
    return { notes: fromIdx(r.map((x) => t + x), l.starts, l.starts.map(() => l.u)) };
  };
  /** Rhythm first, then the number of notes the room holds. */
  const shapedN = (make: (n: number) => number[], nmin: number, nmax: number, units: number[]): Made | null => {
    const l = lay(nmin, nmax, units);
    if (!l) return null;
    const t = endIdx();
    return { notes: fromIdx(make(l.n).map((x) => t + x), l.starts, l.starts.map(() => l.u)) };
  };
  const stairsRel = (n: number) => Array.from({ length: n }, (_, i) => -dir * (n - 1 - i));
  const bendOf = (m: number) => { const below = [...full].reverse().find((s) => s < m); return clamp(below === undefined ? 1 : m - below, 1, 2); };
  const dips = (n: number, depth: number, sign: number) => Array.from({ length: n }, (_, i) => sign * Math.round(depth * Math.sin((Math.PI * i) / Math.max(1, n - 1))));

  switch (move) {
    case 'grace': {
      const i = clamp(ci + (rng.chance(0.5) ? 1 : -1), 0, full.length - 1);
      return { notes: [{ step: p.to - 2, len: 2, midi: full[i] }] };
    }
    case 'stairs': return shapedN(stairsRel, 2, 6, slowUnits());
    case 'run': {
      const quick = rng.chance(0.7);
      const made = shapedN(stairsRel, 4, 8, quick ? [1] : [2]) ?? shapedN(stairsRel, 4, 8, quick ? [2] : [1]);
      return made && { ...made, fast: true };
    }
    case 'wave': return shapedN((n) => dips(n, rng.int(1, Math.min(3, n - 1)), dir), 3, 7, slowUnits());
    case 'arch': return shapedN((n) => dips(n, rng.int(1, Math.min(3, n - 1)), 1), 3, 7, slowUnits());
    case 'dive-climb': return shapedN((n) => {
      const f = n >= 7 ? 3 : n >= 5 ? 2 : 1, climb = n - f, bottom = -(climb - 1);
      return [...Array.from({ length: f }, (_, i) => bottom + 2 * (f - i) + (i === 0 ? 1 : 0)), ...Array.from({ length: climb }, (_, j) => bottom + j)];
    }, 4, 8, [2]);
    case 'zigzag': return shapedN((n) => {
      const w = rng.int(2, 3), sg = rng.chance(0.5) ? 1 : -1;
      return Array.from({ length: n }, (_, i) => { const k = n - 1 - i; return k === 0 ? 0 : (k % 2 ? -sg : sg) * clamp(w + 1 - Math.floor((k - 1) / 3), 2, 4); });
    }, 3, 7, [2]);
    case 'leap-fill': {
      const sgn = rng.chance(0.8) ? (prev <= core.midi ? 1 : -1) : -(prev <= core.midi ? 1 : -1);
      return shapedN((n) => Array.from({ length: n }, (_, i) => sgn * (n - 1 - i)), 2, 5, slowUnits());
    }
    case 'pedal': return shapedN((n) => Array.from({ length: n }, (_, i) => ((n - 1 - i) % 2 === 0 ? 0 : dir * (1 + Math.floor(i / 2)))), 3, 7, [2]);
    case 'neighbour': {
      const pats = [[0, 1, 0], [0, -1, 0], [1, 0, -1, 0], [0, 1, 0, -1, 0], [1, 0], [-1, 0]];
      const pat = rng.pick(pats);
      return shaped(pat, [2]);
    }
    case 'sequence': {
      const l0 = lay(4, 9, [2]);
      if (!l0) return null;
      const shapes = [[0, 1, 2], [0, 2, 1], [0, 1, 0], [0, 2, 0], [0, 1, 2, 1], [2, 1, 0]];
      const opts: [number, number][] = [];
      for (const k of [2, 3, 4]) for (const m of [2, 3]) if (k * m <= l0.n && k * m >= 4) opts.push([k, m]);
      if (!opts.length) return null;
      const [k, m] = opts.reduce((a, b) => (b[0] * b[1] > a[0] * a[1] ? b : a));
      const shape = rng.pick(shapes.filter((s) => s.length >= k)).slice(0, k), s = rng.chance(0.7) ? 1 : 2;
      const rel: number[] = [];
      for (let j = 0; j < m; j++) for (const x of shape) rel.push(x - shape[k - 1] - dir * s * (m - 1 - j));
      return shaped(rel, [2], rel.length);
    }
    case 'enclosure': {
      const below = rng.chance(0.65) ? core.midi - 1 : full[clamp(ci - 1, 0, full.length - 1)];
      const above = !fit.inKey(below) || rng.chance(0.7) ? full[clamp(ci + 1, 0, full.length - 1)] : core.midi + 1;
      const end = p.to - (p.to % 2), seq = rng.chance(0.5) ? [above, below] : [below, above];
      if (end - p.from < 4) return { notes: [{ step: end - 2, len: 2, midi: seq[1], chrom: !fit.inKey(seq[1]) }] };
      return { notes: seq.map((m, i) => ({ step: end - 4 + 2 * i, len: 2, midi: m, chrom: !fit.inKey(m) })) };
    }
    case 'trill': {
      const H = Math.min(L - (L % 2), rng.pick([4, 6, 8]));
      if (H < 4) return null;
      const m = full[endIdx()], up = full.find((s) => s > m);
      if (up === undefined) return null;
      const end = p.to - (p.to % 2);
      return { notes: [{ step: end - H, len: H, midi: m, o: rng.chance(0.35) ? { tremolo: true } : { trill: clamp(up - m, 1, 2) } }], fast: true };
    }
    case 'bend-release': {
      const H = Math.min(L - (L % 2), rng.pick([4, 6, 8])), end = p.to - (p.to % 2);
      if (H < 4) return null;
      const t = endIdx(), m = full[t], b = bendOf(m);
      const notes: N[] = [{ step: end - H, len: H, midi: m, o: { bend: b, unbend: b } }];
      if (end - H - 2 >= p.from && rng.chance(0.5)) notes.unshift({ step: end - H - 2, len: 2, midi: full[clamp(t - dir, 0, full.length - 1)] });
      return { notes };
    }
    case 'slide-in': {
      const H = Math.min(L - (L % 2), rng.pick([4, 6, 8])), end = p.to - (p.to % 2);
      if (H < 2) return null;
      const t = endIdx(), m = full[t];
      if (H < 4) return { notes: [{ step: end - H, len: H, midi: m, o: { art: 'slide' } }] };
      const from = full[clamp(t - dir * rng.int(3, 5), 0, full.length - 1)];
      return { notes: [{ step: end - H, len: 2, midi: from }, { step: end - H + 2, len: H - 2, midi: m, o: { art: 'slide' } }] };
    }
    case 'double-stop': {
      const types = [[3, 4], [8, 9], [5], [12]];
      const type = rng.weighted(types.map((t, i) => [t, [4, 3, 2, 0.5][i]] as [number[], number]));
      const l = lay(1, 3, rng.chance(0.5) ? [4] : [2]);
      if (!l) return null;
      const t = endIdx(), rel = l.n === 1 ? [0] : l.n === 2 ? [-dir, 0] : [-2 * dir, -dir, 0];
      const notes: N[] = [];
      for (let i = 0; i < l.n; i++) {
        const m = full[clamp(t + rel[i], 0, full.length - 1)], d = type.find((x) => fit.inKey(m - x));
        if (d === undefined) return null;
        notes.push({ step: l.starts[i], len: l.u, midi: m, o: { dyad: d } });
      }
      return { notes };
    }
    case 'arpeggio': {
      const fast = rng.chance(0.25 + 0.4 * Math.max(0, c.E(mid)));
      const l = lay(3, fast ? 8 : 6, fast ? [1] : slowUnits());
      if (!l) return null;
      const tones = (g: number) => { const pcs = new Set(chordTones(song.key, fit.chordAt(g))); return full.filter((m) => pcs.has(mod(m, 12))); };
      const near = tones(l.starts[l.n - 1]).filter((m) => scaleSteps(song, m, core.midi) <= 2);
      // (it comes from the side it climbs or falls from, when it can)
      const last = near.filter((m) => (dir > 0 ? m <= core.midi : m >= core.midi));
      if (!near.length) return null;
      let cur = rng.pick(last.length ? last : near);
      const ms = [cur], [lo, hi] = moveWindow(c, core);
      // (back from the last note, a chord note at a time, as far as the window lets it go)
      for (let i = l.n - 2; i >= 0; i--) {
        const t = tones(l.starts[i]), nx = dir > 0 ? [...t].reverse().find((m) => m < cur) : t.find((m) => m > cur);
        if (nx === undefined || nx < lo || nx > hi) break;
        ms.unshift(nx); cur = nx;
      }
      if (ms.length < 3) return null;
      l.starts = l.starts.slice(l.n - ms.length);
      return { notes: ms.map((m, i) => ({ step: l.starts[i], len: l.u, midi: m })), fast };
    }
    case 'stab': {
      const ds = c.drums;
      const all: number[] = [];
      for (let s = Math.ceil(p.from / 2) * 2; s < p.to; s += 2) all.push(s);
      const hit = ds ? all.filter((s) => (ds.kick[s] ?? 0) > 0 || (ds.snare[s] ?? 0) > 0) : [];
      const pool = hit.length >= 2 ? hit : all.filter((s) => env.isBeat(s));
      if (pool.length < 2) return null;
      const n = Math.min(pool.length, rng.int(2, 4)), at = pool.slice(pool.length - n);
      const [lo, hi] = c.window(at[0]);
      const pcs = new Set(chordTones(song.key, fit.chordAt(at[0])));
      const ok = full.filter((m) => m >= lo && m <= hi && pcs.has(mod(m, 12)) && at.every((s) => fit.isTone(m, s)));
      if (!ok.length) return null;
      const m = ok.reduce((a, b) => (Math.abs(b - core.midi) < Math.abs(a - core.midi) ? b : a));
      return { notes: at.map((s) => ({ step: s, len: 1, midi: m })) };
    }
    case 'repeat': case 'repeat-over-change': case 'answer': return cellMove();
    case 'space': return null;
  }

  /** The moves that play a cell: repeated, repeated over a chord change, answered, or the signature's return. */
  function cellMove(): Made | null {
    const end = p.to - (p.to % 2);
    // (over a change: a cell short enough to be played 4 times at most, and still start before the last chord change)
    const last = c.chords.timeline.filter((e) => e.step > p.from && e.step < end).map((e) => e.step).pop();
    const fits = move === 'repeat-over-change' && last !== undefined
      ? (sp: number) => Math.floor((end - last) / sp) + 1 <= Math.min(4, Math.floor((end - p.from) / sp)) : undefined;
    const cell = p.sig ?? makeCell(rng, Math.min(8, Math.floor(L / 2)), fits);
    if (!cell) return null;
    const list = cell.pent ? env.pent : full, span = cellSpan(cell), n = cell.lens.length;
    const t = nearest(list, full[endIdx()]);
    const rel = cell.shape.map((x) => x - cell.shape[n - 1]);
    /** One play of the cell, ending at `to`. */
    const play = (to: number, shape: number[], base: number): N[] => {
      const starts: number[] = [];
      let at = to - span;
      for (const len of cell.lens) { starts.push(at); at += len; }
      return fromIdx(shape.map((x) => base + x), starts, cell.lens, list);
    };
    if (p.label === 'return') {
      let notes = play(end, rel, t);
      if (p.change === 'higher') { const up = rng.int(1, 2); notes = notes.map((x, i) => (i < n - 1 ? { ...x, midi: list[clamp(nearest(list, x.midi) + up, 0, list.length - 1)] } : x)); }
      else if (p.change === 'extra note') {
        const f = notes[0];
        notes.unshift({ step: f.step - 2, len: 2, midi: list[clamp(nearest(list, f.midi) + (rng.chance(0.5) ? 1 : -1), 0, list.length - 1)] });
      } else {
        const top = notes.reduce((a, b) => (b.midi > a.midi ? b : a));
        top.o = { ...top.o, bend: bendOf(top.midi) };
      }
      return { notes };
    }
    if (move === 'answer') {
      if (2 * span > L) return null;
      let other = randomShape(rng, n, cell.pent);
      for (let g = 0; g < 10 && other.join() === cell.shape.join(); g++) other = randomShape(rng, n, cell.pent);
      const q = rng.pick([-2, -1, 1, 2]);
      const call = play(end - span, cell.shape.map((x) => x - cell.shape[n - 1]), clamp(t + q, 0, list.length - 1));
      const reply = play(end, other.map((x) => x - other[n - 1]), t);
      return { notes: [...call, ...reply] };
    }
    const room = Math.floor((end - p.from) / span);
    if (room < 2) return null;
    let r = clamp(room, 2, 4);
    if (move === 'repeat-over-change') {
      // (the cell goes on past the last chord change inside the room, and starts before it)
      const ch = c.chords.timeline.filter((e) => e.step > p.from && e.step < end).map((e) => e.step).pop();
      if (ch === undefined) return null;
      const least = Math.floor((end - ch) / span) + 1;
      if (least > Math.min(4, room)) return null;
      r = clamp(least + rng.int(0, 1), least, Math.min(4, room));
    }
    const notes: N[] = [];
    for (let j = 0; j < r; j++) notes.push(...play(end - span * (r - 1 - j), rel, t));
    return { notes };
  }
}

// ---------------------------------------------------------------- the card

const WORDS: Record<PlannedMove, string> = {
  repeat: 'repeat (a short cell, again)',
  'repeat-over-change': 'repeat over the change (same cell, new chord)',
  answer: 'answer (a phrase, then a reply)',
  sequence: 'sequence (a shape stepped along)',
  wave: 'wave',
  'dive-climb': 'dive and climb (low, then a long climb)',
  stairs: 'stairs',
  arch: 'arch (up and over)',
  zigzag: 'zigzag (wide back and forth)',
  'leap-fill': 'leap and fill (a jump, then steps back)',
  run: 'run (a fast scale burst)',
  trill: 'trill',
  arpeggio: 'arpeggio',
  pedal: 'pedal (back to one note)',
  neighbour: 'neighbour notes (circling a note)',
  enclosure: 'enclosure (above, below, then in)',
  'double-stop': 'double-stops (two strings)',
  'bend-release': 'bend and release',
  'slide-in': 'slide in and hold',
  stab: 'stabs (short, on the groove)',
  space: 'rest',
  grace: 'grace note',
};

/** The move in words for the card. */
function words(r: TravelMove): string {
  const m = r.move as PlannedMove, d = r.dir;
  if (r.label === 'signature') return `signature ${WORDS[m]}`;
  if (r.label === 'return') return `the signature again (${r.change ?? 'changed'})`;
  if (m === 'wave') return d === 1 ? 'wave (up and back down)' : 'wave (down and back up)';
  if (m === 'stairs') return d === 1 ? 'stairs (climbing)' : 'stairs (falling)';
  if (m === 'sequence') return d === 1 ? 'sequence (stepping up)' : 'sequence (stepping down)';
  if (m === 'arpeggio') return r.notes > 5 && r.to - r.from < r.notes * 2 ? 'arpeggio (a sweep)' : WORDS[m];
  return WORDS[m];
}

/** One line for a gap: "bars 3-4: wave (down and back up) into the 3rd of Bb". */
export function moveLine(song: Song, fit: LickFit, core: Core, recs: TravelMove[]): string {
  const first = recs[0], barOf = (g: number) => { for (let i = song.bars.length - 1; i >= 0; i--) if (g >= song.bars[i].start) return i; return 0; };
  const a = barOf(first.from) + 1, b = barOf(Math.max(first.from, recs[recs.length - 1].to - 1)) + 1;
  const ch = fit.chordAt(core.step), deg = ['root', '3rd', '5th', '7th'].find((w) => core.noteWhy.includes(w));
  const into = deg ? `the ${deg} of ${NOTE_NAMES[chordPc(song.key, ch)]}` : NOTE_NAMES[mod(core.midi, 12)];
  return `${a === b ? 'bar ' + a : `bars ${a}-${b}`}: ${recs.map(words).join(', then ')} into ${into}`;
}
