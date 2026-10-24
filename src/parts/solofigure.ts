// The solo player's figure composer (docs/SOLO-PLAYER.md, section 15): turns a long note into a short expression that keeps the note's
// mood going: the note struck, a figure of 1 to 7 notes (hammer-ons, pull-offs, picked notes, 16ths, 8ths, triplets) and, for a return,
// back on the note. A bridge starts on the note and builds toward the next one. Many candidates are made (a place in time, a rhythm, a
// shape, a path of notes found by a search that uses the mood's own interval costs, a way of playing each step); the director draws one
// by weight and the checker has the last word.
//
//   place in time:  head (the note, struck) | motion (the figure) | tail (back on the note, held)
//   rhythm:         cells of 16ths, 8ths, triplets (a third of the beat), sextuplets and 32nds when the tempo allows
//   shape:          neighbour, turn, arch, dip, stairs, wave, arpeggio, pedal, enclosure, leap and fill, zigzag; climbs for a bridge
//   path:           scale notes near the note, scored by `intervalCost` (src/verse/intervals.ts), the shape, the chord, the key
//   playing:        pick, hammer-on or pull-off (art: legato), slide; loudness follows the shape

import type { Feel, GuitarHit } from '../idea';
import type { Rng } from '../rng';
import { SCALES } from '../theory';
import { TUNINGS } from '../theory/fretboard';
import { type Profile, intervalCost } from '../verse/intervals';
import { chordTones } from './guitar2';
import type { Person } from './soloperson';
import { type PEvent, snap } from './soloevents';
import type { Span } from './solorules';
import { beatAt } from './soloverify';

export type Intent = 'stay' | 'return' | 'bridge' | 'flurry';

export interface FigureAsk {
  intent: 'return' | 'bridge';
  person: Person;
  /** What the moment wants (the read feel and the player's lean). */
  want: Feel;
  /** The mood's interval profile at this bar's tension. */
  profile: Profile;
  /** Contours to leave alone (the last ones played). */
  avoid?: string[];
  /** A figure to play again moved to this note (a copy of a phrase): its contour and rhythm cell. */
  prefer?: { contour?: string; cell?: string };
}

export interface Figure {
  events: PEvent[];
  intent: 'return' | 'bridge';
  contour: string;
  cell: string;
  layout: string;
  /** Its chance of being drawn. */
  w: number;
  /** The intervals it moves by, as arrows: `up 2 down 3`. */
  label: string;
  /** How many notes the figure has between the head and the landing. */
  m: number;
}

const feel = (agitation: number, roughness: number, ornament: number, weight: number, looseness: number): Feel => ({ agitation, roughness, ornament, weight, looseness });
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------------------------------------------------------------- the song's scale and chords

const scaleMemo = new WeakMap<object, { notes: number[]; pcs: Set<number> }>();
function scaleOf(song: Span['ctx']['song']) {
  let s = scaleMemo.get(song);
  if (!s) {
    const pcs = new Set((SCALES[song.mode] as readonly number[]).map((p) => (p + song.key) % 12));
    const notes: number[] = [];
    for (let m = 24; m <= 110; m++) if (pcs.has(m % 12)) notes.push(m);
    s = { notes, pcs };
    scaleMemo.set(song, s);
  }
  return s;
}

/** The notes of the chord under a time (as pitch classes). */
function chordPcsAt(s: Span, t: number): Set<number> {
  const tl = s.ctx.chords?.timeline ?? [];
  let k = -1;
  for (let i = 0; i < tl.length; i++) if (tl[i].step <= t + 1e-6) k = i;
  return new Set(k >= 0 ? chordTones(s.ctx.song.key, tl[k].chord) : []);
}

/** Whether a time is the start of a beat of its bar. */
function onBeat(s: Span, t: number): boolean {
  const song = s.ctx.song;
  const bar = song.bars.find((b) => t >= b.start - 1e-6 && t < b.start + b.len - 1e-6);
  if (!bar) return false;
  let g = bar.start;
  for (const grp of bar.groups) { if (Math.abs(t - g) < 1e-6) return true; g += grp; }
  return false;
}

// ---------------------------------------------------------------- shapes

interface Shape {
  name: string;
  feel: Feel;
  /** Which way it leans: 1 up, -1 down, 0 neither (how well it suits a mood that rises or falls). */
  dir: number;
  /** How common it is before the mood, the player and the time there is count (1 when missing). */
  base?: number;
  /** How many figure notes it can have. */
  m: [number, number];
  /** Where each figure note aims, in scale steps from the note (`X`: how far the mood reaches, or for a climb how far it goes; `r`: a draw from 0 to 1). */
  targets(m: number, X: number, r: number): number[];
}

const sine = (m: number, A: number, sign: number) => Array.from({ length: m }, (_, i) => sign * Math.max(1, Math.round(A * Math.sin((Math.PI * (i + 1)) / (m + 1)))));

const CONTOURS: Shape[] = [
  { name: 'neighbour-up', feel: feel(0, -0.2, 0.2, 0, 0), dir: 0.4, base: 0.55, m: [1, 5], targets: (m) => Array.from({ length: m }, (_, i) => (i % 2 === 0 ? 1 : 0)) },
  { name: 'neighbour-down', feel: feel(-0.1, -0.1, 0.2, 0, 0.1), dir: -0.4, base: 0.55, m: [1, 5], targets: (m) => Array.from({ length: m }, (_, i) => (i % 2 === 0 ? -1 : 0)) },
  { name: 'turn', feel: feel(0, -0.2, 0.5, -0.1, 0.2), dir: 0, base: 0.9, m: [3, 5], targets: (m) => Array.from({ length: m }, (_, i) => [1, 0, -1, 0][i % 4]) },
  { name: 'arch', feel: feel(0.1, -0.1, 0.3, 0, 0.1), dir: 0.2, m: [3, 7], targets: (m, A) => sine(m, A, 1) },
  { name: 'dip', feel: feel(-0.2, 0, 0.2, 0.1, 0.2), dir: -0.4, m: [3, 7], targets: (m, A) => sine(m, A, -1) },
  { name: 'stair-up', feel: feel(0.4, -0.1, 0.4, 0, -0.1), dir: 1, m: [2, 6], targets: (m) => Array.from({ length: m }, (_, i) => i + 1) },
  { name: 'stair-down', feel: feel(0.2, 0, 0.3, 0.1, 0), dir: -1, m: [2, 6], targets: (m) => Array.from({ length: m }, (_, i) => -(i + 1)) },
  { name: 'wave', feel: feel(0.3, 0, 0.5, 0, 0.2), dir: 0, m: [4, 7], targets: (m, A) => Array.from({ length: m }, (_, i) => Math.round(A * Math.sin((2 * Math.PI * (i + 1)) / (m + 1)))) },
  { name: 'arpeggio-up', feel: feel(0.2, -0.3, 0.3, 0.2, 0), dir: 0.8, m: [2, 5], targets: (m, A) => sine(m, Math.max(2, A), 1).map((x) => 2 * Math.max(1, Math.round(x / 1.5))) },
  { name: 'arpeggio-down', feel: feel(0, -0.2, 0.3, 0.2, 0.1), dir: -0.8, m: [2, 5], targets: (m, A) => sine(m, Math.max(2, A), -1).map((x) => 2 * Math.min(-1, Math.round(x / 1.5))) },
  { name: 'pedal', feel: feel(0.4, 0.3, 0.1, 0.3, -0.3), dir: 0.2, m: [3, 6], targets: (m) => Array.from({ length: m }, (_, i) => (i % 2 === 0 ? 1 + Math.floor(i / 2) : 0)) },
  { name: 'enclosure', feel: feel(0.1, 0.2, 0.6, -0.1, 0.1), dir: 0, m: [2, 2], targets: (_m, _A, r) => (r < 0.5 ? [1, -1] : [-1, 1]) },
  { name: 'leap-fill', feel: feel(0.3, 0.1, 0.2, 0.3, 0), dir: 0.3, m: [3, 5], targets: (m) => Array.from({ length: m }, (_, i) => m - i) },
  { name: 'zigzag', feel: feel(0.4, 0.2, 0.5, 0, 0), dir: 0.3, m: [3, 7], targets: (m) => Array.from({ length: m }, (_, i) => (i % 2 === 0 ? 1 + Math.floor(i / 2) : -(1 + Math.floor(i / 2)))) },
];
export const RETURN_CONTOURS = CONTOURS.map((c) => c.name);

/** The shapes of a bridge: they climb (or fall) `D` scale steps toward the next note. */
const CLIMBS: Shape[] = [
  { name: 'climb', feel: feel(0.3, 0, 0.3, 0.1, 0), dir: 0, m: [2, 7], targets: (m, D) => Array.from({ length: m }, (_, i) => Math.round((D * (i + 1)) / m)) },
  { name: 'climb-zigzag', feel: feel(0.4, 0.2, 0.5, 0, 0.1), dir: 0, m: [2, 7], targets: (m, D) => Array.from({ length: m }, (_, i) => Math.round((D * (i + 1)) / m) + (i % 2 === 1 && i < m - 1 ? -Math.sign(D) : 0)) },
  { name: 'climb-thirds', feel: feel(0.2, -0.2, 0.4, 0.3, 0), dir: 0, m: [2, 7], targets: (m, D) => Array.from({ length: m }, (_, i) => (i === m - 1 ? D : clamp(2 * (i + 1) * Math.sign(D), -Math.abs(D), Math.abs(D)))) },
  { name: 'climb-late', feel: feel(0.5, 0.1, 0.2, 0.1, -0.1), dir: 0, m: [2, 7], targets: (m, D) => { const h = Math.floor(m / 2); return Array.from({ length: m }, (_, i) => (i < h ? Math.sign(D) * (i % 2) : Math.round((D * (i + 1 - h)) / (m - h)))); } },
];
export const BRIDGE_CONTOURS = CLIMBS.map((c) => c.name);

// ---------------------------------------------------------------- rhythm

/** Cells of lengths (times the unit) cycled over the figure's notes. */
const CELLS: Record<string, number[]> = {
  even: [1],
  'long-short': [2, 1, 1],
  'short-long': [1, 1, 2],
  dotted: [1.5, 0.5],
  syncopated: [1, 2, 1],
  build: [2, 2, 1, 1, 1, 1, 1],
};
export const CELL_NAMES = Object.keys(CELLS);

const msStep = (s: Span) => 15000 / s.ctx.song.bpm;

// ---------------------------------------------------------------- the path of notes

interface Pos { t: number; dur: number; target: number }
interface Path { pitches: number[]; out: boolean[]; cost: number }

/** The best few paths through the scale notes near each target (a beam search), scored by the mood's intervals, the shape, the chord and the key. */
function searchPath(s: Span, ask: FigureAsk, pos: Pos[], mainIdx: number, notes: number[], main: number, end: { pitch: number } | null, canOut: boolean): Path[] {
  const P = ask.profile;
  const lo = (s.ctx.song.tuning ?? TUNINGS.standard).strings[0], hi = (s.ctx.song.tuning ?? TUNINGS.standard).strings[5] + 24;
  const pcs = scaleOf(s.ctx.song).pcs;
  interface St { p: number[]; out: boolean[]; cost: number; pending: boolean; usedOut: boolean }
  let beam: St[] = [{ p: [main], out: [], cost: 0, pending: false, usedOut: false }];
  pos.forEach((q, i) => {
    const last = i === pos.length - 1;
    const strong = onBeat(s, q.t) || q.dur >= 2;
    const cpcs = chordPcsAt(s, q.t);
    const cands: { m: number; dev: number; out: boolean }[] = [];
    if (last && end) cands.push({ m: end.pitch, dev: 0, out: false });
    else {
      for (let d = -2; d <= 2; d++) {
        const k = mainIdx + q.target + d;
        if (k < 0 || k >= notes.length) continue;
        cands.push({ m: notes[k], dev: Math.abs(d), out: false });
      }
      // a passing note outside the key (bluesy and funky players): one a figure, on a weak spot, stepped away from
      if (canOut && !last && !strong) {
        const k = mainIdx + q.target;
        if (k >= 0 && k < notes.length) for (const e of [-1, 1]) if (!pcs.has(mod(notes[k] + e, 12))) cands.push({ m: notes[k] + e, dev: 0.5, out: true });
      }
    }
    const next: St[] = [];
    for (const b of beam) {
      const prev = b.p[b.p.length - 1];
      const lastMove = b.p.length > 1 ? prev - b.p[b.p.length - 2] : 0;
      for (const c of cands) {
        if (c.m < lo || c.m > hi || Math.abs(c.m - main) > 14) continue;
        if (c.out && (b.usedOut || b.pending)) continue;
        if (b.pending && (Math.abs(c.m - prev) > 2 || c.out)) continue;
        // (a figure moves: the same pitch twice running would only be the note struck again, which a flurry is for)
        if (c.m === prev) continue;
        let cost = b.cost + 0.9 * c.dev + intervalCost(P, prev, c.m, lastMove, false);
        // (a figure that is meant to move does not sit on the note)
        if (c.m === main && q.target !== 0) cost += 2;
        const pc = mod(c.m, 12);
        if (!c.out) cost += strong ? (cpcs.has(pc) ? -0.5 : 0.25) : 0;
        if (c.out) cost += 1.2;
        next.push({ p: [...b.p, c.m], out: [...b.out, c.out], cost, pending: c.out, usedOut: b.usedOut || c.out });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, 8);
  });
  const out: Path[] = [];
  for (const b of beam) {
    // a return comes home to the note: the way in costs what the mood says it does
    let cost = b.cost;
    // (the way back to the note is the other half of the way out: it costs what the mood says of its size, not of its direction)
    if (!end) { const p = b.p; cost += intervalCost({ ...P, up: 0.5, fill: 0 }, p[p.length - 1], main, p.length > 1 ? p[p.length - 1] - p[p.length - 2] : 0, false); }
    out.push({ pitches: b.p.slice(1), out: b.out, cost });
    if (out.length >= 3) break;
  }
  return out;
}

// ---------------------------------------------------------------- composing

/** A head the figure can follow: one picked note, not let down, not trilled, not a rake or a swell. */
export function figureHead(h: GuitarHit): boolean {
  return !h.mute && h.notes.length === 1 && !h.unbend && !h.lateBend && !h.trill && !h.tremolo && !h.rake && !h.swell && !h.letRing && (h.art === undefined || h.art === 'pick');
}

/** The hit as the held note after the head: what the head was reached by (a bend, a slide in) is not played again. */
function landingHit(h: GuitarHit): GuitarHit {
  const { bend: _b, slide: _s, rake: _r, ...rest } = h;
  return rest;
}

const wpick = <T>(rng: Rng, items: { v: T; w: number }[]): T | null => {
  const tot = items.reduce((a, x) => a + x.w, 0);
  if (tot <= 0) return null;
  let r = rng.next() * tot;
  for (const x of items) if ((r -= x.w) < 0) return x.v;
  return items[items.length - 1].v;
};

/** How much of a note's time stays on the note itself (head and landing). */
const homeShare = (want: Feel) => clamp(0.5 - 0.15 * want.agitation + 0.1 * want.weight - 0.05 * want.ornament, 0.4, 0.72);

/**
 * Candidate figures for a long note. Empty when the note cannot take one (too short, not a plain picked note, not a note of the scale).
 * `tries` is how many (shape, rhythm, place) draws are made; each gives its best path or two.
 */
export function composeFigures(s: Span, ask: FigureAsk, rng: Rng, tries = 28): Figure[] {
  const n = s.note, h = s.event.hit, L = n.len, song = s.ctx.song;
  if (!figureHead(h) || L < 4) return [];
  const { notes } = scaleOf(song);
  const mainIdx = notes.indexOf(n.midi);
  if (mainIdx < 0) return [];
  const ms = msStep(s);
  const dMin = Math.max(0.5, Math.ceil((62 / ms) * 12) / 12);
  const beat = beatAt(song, n.t);
  const want = ask.want, P = ask.profile, person = ask.person;
  const shuffle = s.read.tags.some((t) => t.id === 'shuffle-groove' && t.w >= 0.5);
  const canOut = person.kind === 'bluesy' || person.kind === 'funky';
  const home = homeShare(want);
  const bridge = ask.intent === 'bridge';

  // a bridge aims at a note next to the next note of the melody
  let D = 0, endPitch: number | null = null;
  if (bridge) {
    const nx = s.next;
    if (!nx || s.after > 2 || n.anchor === 'all') return [];
    const N = nx.midi, up = N > n.midi;
    const nIdx = notes.indexOf(N);
    if (nIdx < 0) return [];
    // (adjacent: the scale note on this side of it; or a third away)
    const step = rng.chance(0.7) ? 1 : 2;
    let aIdx = nIdx + (up ? -step : step);
    if (aIdx === mainIdx) aIdx = nIdx + (up ? -(step + 1) : step + 1);
    D = clamp(aIdx - mainIdx, -7, 7);
    if (D === 0 || (N === n.midi)) return [];
    endPitch = notes[mainIdx + D];
  }

  const out: Figure[] = [];
  for (let attempt = 0; attempt < tries; attempt++) {
    // ---- the rhythm: a unit of time, a cell, how many notes
    const isBridge = bridge;
    const units: { v: number; w: number }[] = [];
    if (shuffle) units.push({ v: beat / 3, w: 3 }, { v: beat / 6, w: want.agitation > 0.3 ? 1 : 0.2 }, { v: beat / 2, w: 0.5 });
    else {
      units.push({ v: 2, w: clamp(1.2 - want.agitation, 0.3, 2) }, { v: 1, w: clamp(0.5 + want.agitation, 0.2, 2) });
      units.push({ v: beat / 3, w: person.kind === 'bluesy' ? 0.5 : 0.2 }, { v: beat, w: clamp(0.5 - 0.6 * want.agitation, 0.05, 0.9) });
      if (want.agitation > 0.6) units.push({ v: 0.5, w: 0.4 });
    }
    const u = wpick(rng, units) ?? 1;
    const cellName = ask.prefer?.cell && CELLS[ask.prefer.cell] && rng.chance(0.8)
      ? ask.prefer.cell
      : wpick(rng, CELL_NAMES.map((c) => ({ v: c, w: c === 'even' ? 3 : c === 'dotted' ? (u >= 2 ? 1.2 : 0) : c === 'build' ? (isBridge ? 3 : 0.3) : 1 })))!;
    const cell = CELLS[cellName];
    const minHome = Math.max(2, L * home);
    const unitMin = Math.min(...cell) * u;
    if (unitMin < dMin - 1e-6) continue;
    const mFit = Math.min(7, Math.floor((L - (isBridge ? Math.max(2, L * 0.36) : minHome)) / unitMin));
    // ---- the shape (among those that fit in the time there is)
    const defs = bridge ? CLIMBS : CONTOURS;
    const def = wpick(rng, defs.filter((d) => d.m[0] <= mFit).map((d) => {
      const f = d.feel;
      const d2 = (Object.keys(f) as (keyof Feel)[]).reduce((a, k) => a + (f[k] - want[k]) ** 2, 0);
      let w = Math.exp(-d2 / 1.5) * (d.base ?? 1) * (person.figures[d.name] ?? 1) ** 2.5;
      w *= 1 + 0.6 * (P.up - 0.5) * 2 * d.dir;
      if (ask.avoid?.includes(d.name)) w *= 0.3;
      if (ask.prefer?.contour === d.name) w *= 8;
      return { v: d, w };
    }));
    if (!def) continue;
    const range = def.m;
    const mMax = Math.min(range[1], mFit);
    if (mMax < range[0]) continue;
    const mw: { v: number; w: number }[] = [];
    for (let m = range[0]; m <= mMax; m++) mw.push({ v: m, w: Math.exp(-((m - (3.2 + 2 * want.ornament + 1.5 * want.agitation + 0.15 * clamp(L - 8, -4, 8))) ** 2) / 4) });
    const m = wpick(rng, mw)!;
    let durs = Array.from({ length: m }, (_, i) => snap(cell[i % cell.length] * u));
    // ---- the place in time
    let layout: string, head: number, tail: number;
    if (isBridge) {
      // the figure is the cell as it is; the note is struck for the rest of the time and is the pitch heard most
      const M = durs.reduce((a, b) => a + b, 0);
      head = snap(L - M);
      if (head < Math.max(2, L * 0.36, Math.max(...durs) + 1 / 12) - 1e-6) continue;
      tail = 0;
      layout = 'head-climb';
    } else {
      const M = durs.reduce((a, b) => a + b, 0);
      const rest = snap(L - M);
      if (rest < minHome - 1e-6 || rest < 2 * dMin) continue;
      const lay = wpick(rng, [
        { v: 'hold-fig-hold', w: 0.5 + 0.3 * (s.read.tags.find((t) => t.id === 'long-before-rest')?.w ?? 0) },
        { v: 'fig-first', w: 0.2 + 0.4 * Math.max(0, want.agitation) },
        { v: 'fig-end', w: 0.3 + 0.3 * Math.max(0, want.looseness) },
      ])!;
      layout = lay;
      // (the figure starts on the grid of its own unit, counted from the note: on the beat or the 8th, or in the triplet)
      const g = u < 1 ? 1 : u === 1 && rng.chance(0.5) ? 2 : u;
      const onGrid = (x: number) => Math.max(g, Math.round(x / g) * g);
      if (lay === 'hold-fig-hold') { head = snap(onGrid(rest * (0.4 + 0.2 * rng.next()))); tail = snap(rest - head); }
      else if (lay === 'fig-first') { head = snap(onGrid(rng.pick([1, 1, 2]))); tail = snap(rest - head); }
      else { tail = snap(Math.min(rng.pick([1, 2]), rest - dMin)); head = snap(rest - tail); }
      if (head < dMin - 1e-6 || tail < dMin - 1e-6) continue;
    }

    // ---- the path of notes
    const A = clamp(Math.round(P.size / 1.8 + 0.6 * want.agitation + (rng.next() - 0.5)), 1, 4);
    const targets = def.targets(m, isBridge ? D : A, rng.next());
    let t = n.t + head;
    const pos: Pos[] = targets.map((target, i) => { const q = { t, dur: durs[i], target }; t += durs[i]; return q; });
    const paths = searchPath(s, ask, pos, mainIdx, notes, n.midi, isBridge ? { pitch: endPitch! } : null, canOut);
    for (const path of paths.slice(0, 2)) {
      const events = playPath(s, ask, { head, durs, tail, path, isBridge, ms, pos });
      if (!events || !heardMost(events, n.midi)) continue;
      const moves = path.pitches.map((p, i) => p - (i ? path.pitches[i - 1] : n.midi)).filter((d) => d !== 0);
      const label = moves.map((d) => `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}`).join(', ');
      const cost = path.cost / (m + 1);
      out.push({ events, intent: ask.intent, contour: def.name, cell: cellName, layout, w: Math.exp(-cost / 1.2), label, m });
    }
  }
  return out;
}

/** The note's pitch is heard for at least as long as any other pitch of the figure (and for a third of the note). */
function heardMost(events: PEvent[], midi: number): boolean {
  const time = new Map<number, number>();
  for (const e of events) time.set(e.hit.notes[0], (time.get(e.hit.notes[0]) ?? 0) + e.len);
  const mine = time.get(midi) ?? 0;
  return [...time.values()].every((x) => x <= mine + 1e-6);
}

/** The path as events: the head, the figure's notes (how each is played), the landing. Null if two notes in a row are the same and not a pedal. */
function playPath(s: Span, ask: FigureAsk, p: { head: number; durs: number[]; tail: number; path: Path; isBridge: boolean; ms: number; pos: Pos[] }): PEvent[] | null {
  const n = s.note, h = s.event.hit, person = ask.person;
  const hands = s.ctx.hands;
  const events: PEvent[] = [];
  // the head: the note as it was, cut short
  events.push({ t: n.t, len: snap(p.head), base: n.i, hit: { ...h, len: p.head } });
  let prevPitch = n.midi;
  let t = n.t + p.head;
  const rng = (k: number) => { const x = Math.sin((n.t * 131 + n.midi * 17 + k * 7.31 + p.durs.length) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const play = (pitch: number, dur: number, k: number, out: boolean, vel: number) => {
    const d = pitch - prevPitch;
    const msDur = dur * p.ms;
    let art: GuitarHit['art'] = 'pick';
    if (d !== 0 && Math.abs(d) <= 4 && msDur >= 42) {
      const pLeg = clamp(0.25 + 0.6 * hands.legato + person.legato * 0.4 + (msDur < 100 ? 0.3 : 0), 0, 0.95);
      if (rng(k) < pLeg) art = 'legato';
    }
    if (art === 'pick' && Math.abs(d) >= 2 && Math.abs(d) <= 5 && dur >= 2 && rng(k + 50) < hands.slide * 0.25) art = 'slide';
    const { vib: _v, ...base } = landingHit(h);
    const hit: GuitarHit = { ...base, step: Math.floor(t), len: dur, notes: [pitch], vel: clamp(vel * (art === 'legato' ? 0.92 : 1) * (onBeat(s, t) ? 1.06 : 1), 0.2, 1.2), exact: true, art };
    delete hit.shift;
    const e: PEvent = { t: snap(t), len: snap(dur), base: n.i, hit };
    if (out) { e.out = true; hit.out = true; }
    events.push(e);
    prevPitch = pitch;
    t += dur;
  };
  const m = p.path.pitches.length;
  p.path.pitches.forEach((pitch, i) => {
    const last = i === m - 1;
    // (the last figure note of a return that is the note itself is the landing: it takes the tail's time too)
    if (!p.isBridge && last && pitch === n.midi) return;
    play(pitch, p.durs[i], i, p.path.out[i], h.vel * (0.78 + 0.2 * ((i + 1) / m)));
  });
  if (!p.isBridge) {
    const lastLen = p.path.pitches[m - 1] === n.midi ? p.durs[m - 1] + p.tail : p.tail;
    const d = n.midi - prevPitch;
    const pLeg = clamp(0.2 + 0.6 * hands.legato + person.legato * 0.4, 0, 0.9);
    const art: GuitarHit['art'] = d !== 0 && Math.abs(d) <= 4 && rng(99) < pLeg ? 'legato' : 'pick';
    const land = landingHit(h);
    events.push({ t: snap(t), len: snap(lastLen), base: n.i, hit: { ...land, step: Math.floor(t), len: lastLen, art, vel: h.vel * 0.94 } });
    t += lastLen;
  }
  return Math.abs(t - (n.t + n.len)) < 0.05 ? events : null;
}
