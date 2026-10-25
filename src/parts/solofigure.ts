// The solo player's figure composer (docs/SOLO-PLAYER.md, section 15): turns a long note into a short expression that keeps the note's
// mood going: the note struck, a figure of 1 to 7 notes (hammer-ons, pull-offs, picked notes, 16ths, 8ths, triplets) and, for a return,
// back on the note. A bridge starts on the note and builds toward the next one. A return can also open with a quick bend into the note and
// run on at once in a flourish of uneven lengths with now and then a 16th of air (docs/SOLO-PLAYER.md, section 17), or be a trill written
// as notes at a speed that suits the tempo. Many candidates are made (a place in time, a rhythm, a
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
import type { Mood } from '../tension';
import type { Person } from './soloperson';
import { type PEvent, snap } from './soloevents';
import type { Span } from './solorules';
import { beatAt } from './soloverify';

export type Intent = 'stay' | 'return' | 'bridge';

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
  /** The mood (the size of a bend into the note). */
  mood: Mood;
  /** The chance of a draw opening with a quick bend (0: none; a return only). */
  bend?: number;
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
  /** For a bend and run: the lengths of the flourish (`16 16 8t . 16`: a dot is a 16th of air). */
  lens?: string;
}

const feel = (agitation: number, roughness: number, ornament: number, weight: number, looseness: number): Feel => ({ agitation, roughness, ornament, weight, looseness });
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const mod = (n: number, m: number) => ((n % m) + m) % m;

// ---------------------------------------------------------------- the song's scale and chords

const scaleMemo = new WeakMap<object, { notes: number[]; pcs: Set<number> }>();
export function scaleOf(song: Span['ctx']['song']) {
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
export function onBeat(s: Span, t: number): boolean {
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

export const msStep = (s: Span) => 15000 / s.ctx.song.bpm;

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
export function landingHit(h: GuitarHit): GuitarHit {
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
  const preferBend = !!ask.prefer?.contour?.startsWith('bend-');
  const bendP = bridge || h.bend || h.slide ? 0 : preferBend ? 1 : ask.bend ?? 0;
  for (let attempt = 0; attempt < tries; attempt++) {
    // ---- a quick bend into the note, then a flourish
    if (bendP > 0 && rng.chance(bendP)) {
      out.push(...bendFlourish(s, ask, rng, { notes, mainIdx, ms, dMin, beat, shuffle, canOut, home, only: preferBend ? ask.prefer!.contour!.slice(5) : undefined }));
      continue;
    }
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
      const events = playPath(s, ask, { head, tail, path, isBridge, ms, pos });
      if (!events || !heardMost(events, n.midi)) continue;
      const moves = path.pitches.map((p, i) => p - (i ? path.pitches[i - 1] : n.midi)).filter((d) => d !== 0);
      const label = moves.map((d) => `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}`).join(', ');
      const cost = path.cost / (m + 1);
      out.push({ events, intent: ask.intent, contour: def.name, cell: cellName, layout, w: Math.exp(-cost / 1.2), label, m });
    }
  }
  return out;
}

// ---------------------------------------------------------------- a quick bend, then a flourish

interface FlourishK { notes: number[]; mainIdx: number; ms: number; dMin: number; beat: number; shuffle: boolean; canOut: boolean; home: number; only?: string }

/** How the shapes suit a flourish run (the quick ones). */
const FLOURISH_SHAPE: Record<string, number> = { turn: 1.5, 'stair-down': 1.6, 'stair-up': 1.2, wave: 1.3, arch: 1.2, zigzag: 1.2, 'arpeggio-down': 1.1, 'arpeggio-up': 1.1, dip: 1, pedal: 0.7, 'neighbour-up': 0.5, 'neighbour-down': 0.5, enclosure: 0.8, 'leap-fill': 0.8 };
/** How much the player lets a flourish breathe (a 16th of air). */
const AIR: Record<string, number> = { melodic: 0.8, bluesy: 1.2, shredder: 0.4, raw: 1.2, funky: 1.3 };

/** The name of a length in 16ths, for the roll: 16, 8, 8t (an 8th triplet), 16t, 16. (dotted); a dot is a 16th of air. */
function lenName(v: number, beat: number): string {
  const near = (a: number) => Math.abs(v - a) < 0.02;
  if (near(1)) return '16'; if (near(2)) return '8'; if (near(beat / 3)) return '8t'; if (near(beat / 6)) return '16t'; if (near(1.5)) return '16.'; if (near(0.5)) return '32';
  return String(+v.toFixed(2));
}

/** A run of lengths for a flourish: random, but a run quick-to-slow or slow-to-quick now and then, never more than three equal in a row, and the last not the shortest. */
function drawLengths(rng: Rng, m: number, units: { v: number; w: number }[]): number[] | null {
  for (let tries = 0; tries < 14; tries++) {
    const durs = Array.from({ length: m }, () => wpick(rng, units)!);
    const r = rng.next();
    if (r < 0.25) durs.sort((a, b) => a - b); else if (r < 0.4) durs.sort((a, b) => b - a);
    let run = 1, ok = true;
    for (let i = 1; i < m; i++) { run = Math.abs(durs[i] - durs[i - 1]) < 1e-6 ? run + 1 : 1; if (run > 3) ok = false; }
    if (m > 1 && durs[m - 1] < Math.min(...durs.slice(0, m - 1)) - 1e-6) ok = false;
    if (ok) return durs;
  }
  return null;
}

/**
 * A return that opens with a quick bend into the note (struck a half or whole step below and pushed up at once, then held for a moment) and runs on
 * in a flourish of 3 to 6 notes (8 for a shredder on a bar-long note) of uneven lengths, now and then a 16th of air in it, and comes back to the note.
 */
function bendFlourish(s: Span, ask: FigureAsk, rng: Rng, k: FlourishK): Figure[] {
  const n = s.note, L = n.len, person = ask.person, want = ask.want, P = ask.profile;
  const { notes, mainIdx, ms, dMin, beat } = k;
  const pcs = scaleOf(s.ctx.song).pcs;
  // the bend: a half step for the tight moods, a whole step for the open ones (the way up into the note; the note is in the key)
  const open = ask.mood === 'happy' || ask.mood === 'triumphant' || ask.mood === 'angry', tight = ask.mood === 'dark' || ask.mood === 'tense' || ask.mood === 'melancholic';
  const sizes = [1, 2].filter((b) => pcs.has(mod(n.midi - b, 12)));
  if (!sizes.length) return [];
  const b = sizes.length === 2 ? (rng.chance(open ? 0.75 : tight ? 0.25 : 0.5) ? 2 : 1) : sizes[0];
  // (the bend has to land in the head: the engine's own time for it)
  const minHead = Math.max(2, Math.ceil((0.123 + b * 0.025) / 0.97 / (ms / 1000)));
  if (minHead > 5) return [];
  // (quick: a moment, at most about half a second whatever the tempo)
  const hq = Math.min(minHead + (rng.chance(0.3) ? 1 : 0) + (rng.chance(0.15) ? 2 : 0), Math.max(minHead, Math.floor(500 / ms)));
  // the lengths a flourish draws from (not quicker than the pick can go)
  const units: { v: number; w: number }[] = (k.shuffle
    ? [{ v: snap(beat / 3), w: 3 }, { v: snap(beat / 6), w: 1.2 }, { v: snap(beat / 2), w: 0.8 }, { v: 1, w: 0.3 }]
    : [{ v: 1, w: 3 }, { v: 2, w: 1.4 }, { v: snap(beat / 3), w: 0.9 }, { v: snap(beat / 6), w: 0.7 }, { v: 1.5, w: 0.5 }]).filter((u) => u.v >= dMin - 1e-6);
  if (!units.length) return [];
  const defs = CONTOURS.filter((d) => (k.only ? d.name === k.only : true) && d.m[0] >= 2 && d.m[0] <= 5);
  const pick = wpick(rng, defs.map((d) => {
    const f = d.feel;
    const d2 = (Object.keys(f) as (keyof Feel)[]).reduce((a, key) => a + (f[key] - want[key]) ** 2, 0);
    let w = Math.exp(-d2 / 1.5) * (FLOURISH_SHAPE[d.name] ?? 1) * (person.figures[d.name] ?? 1) ** 2.5;
    w *= 1 + 0.6 * (P.up - 0.5) * 2 * d.dir;
    return { v: d, w };
  }));
  if (!pick) return [];
  const long = person.kind === 'shredder' && L >= 16;
  const mTop = Math.min(pick.m[1], long ? 8 : 6);
  const minHome = Math.max(2, L * k.home);
  // how many notes: as many as the time gives, 3 to 6 by the feel
  const wantM = clamp(Math.round(3.4 + 1.6 * want.agitation + 1.2 * want.ornament + (rng.next() - 0.5) * 2), 3, mTop);
  const out: Figure[] = [];
  // (a short note takes a flourish of two notes)
  for (let m = Math.min(wantM, mTop); m >= Math.max(L < 8 ? 2 : 3, pick.m[0]); m--) {
    const durs = drawLengths(rng, m, units);
    if (!durs) continue;
    // a 16th of air between two notes of the flourish (not first after the bend)
    const gapAt = m >= 3 && rng.chance(0.22 * (AIR[person.kind] ?? 1)) ? rng.int(1, m - 1) : -1;
    const F = durs.reduce((a, x) => a + x, 0) + (gapAt >= 0 ? 1 : 0);
    const tail = snap(L - hq - F);
    if (tail < Math.max(2, minHome - hq) - 1e-6 || tail < 2 * dMin) continue;
    const pitchesToMain = (pitch: number) => pitch === n.midi;
    let t = n.t + hq;
    const pos: Pos[] = durs.map((dur, i) => { if (i === gapAt) t += 1; const q = { t, dur, target: 0 }; t += dur; return q; });
    const A = clamp(Math.round(P.size / 1.8 + 0.6 * want.agitation + (rng.next() - 0.5)), 1, 4);
    const targets = pick.targets(m, A, rng.next());
    pos.forEach((q, i) => { q.target = targets[i]; });
    for (const path of searchPath(s, ask, pos, mainIdx, notes, n.midi, null, k.canOut).slice(0, 2)) {
      // (a gap right before a landing that is the last figure note would make the landing late)
      if (gapAt === m - 1 && pitchesToMain(path.pitches[m - 1])) continue;
      const events = playPath(s, ask, { head: hq, headHit: { bend: b }, tail, path, isBridge: false, ms, pos });
      if (!events || !heardMost(events, n.midi)) continue;
      const moves = path.pitches.map((p, i) => p - (i ? path.pitches[i - 1] : n.midi)).filter((d) => d !== 0);
      const lens = durs.flatMap((d, i) => (i === gapAt ? ['.', lenName(d, beat)] : [lenName(d, beat)])).join(' ');
      out.push({
        events, intent: 'return', contour: `bend-${pick.name}`, cell: gapAt >= 0 ? 'random+air' : 'random', layout: 'bend-run',
        w: Math.exp(-(path.cost / (m + 1)) / 1.2), label: `bend ${b}, ${moves.map((d) => `${d > 0 ? 'up' : 'down'} ${Math.abs(d)}`).join(', ')}`, m, lens,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the trill, written as notes

/**
 * A trill that suits the tempo: the note and the scale note above (or below) it, hammered and pulled, written note by note at the speed the tempo
 * allows (70 to 180 ms a note, as near 105 as the beat's divisions come), then the note held. It ends on the note on a beat division.
 */
export function composeTrill(s: Span, _ask: FigureAsk, rng: Rng): Figure[] {
  const n = s.note, h = s.event.hit, L = n.len, song = s.ctx.song;
  if (!figureHead(h) || L < 6 || h.bend || h.slide) return [];
  const { notes } = scaleOf(song);
  const mainIdx = notes.indexOf(n.midi);
  if (mainIdx < 0) return [];
  const ms = msStep(s), beat = beatAt(song, n.t);
  const shuffle = s.read.tags.some((t) => t.id === 'shuffle-groove' && t.w >= 0.5);
  // the unit: the division of the beat whose note is nearest 105 ms (a straight feel keeps to 16ths and 8ths, a shuffle to triplets)
  const divs = (shuffle ? [beat / 6, beat / 3, beat / 2] : [0.5, 1, 2, beat / 6, beat / 3]).map(snap).filter((u) => u * ms >= 70 && u * ms <= 180);
  if (!divs.length) return [];
  const u = divs.reduce((best, x) => (Math.abs(Math.log(x * ms / 105)) < Math.abs(Math.log(best * ms / 105)) ? x : best));
  const g = shuffle ? snap(beat / 3) : u >= 2 ? 2 : 1;
  const out: Figure[] = [];
  for (const dir of [1, 1, -1]) {
    const nbIdx = mainIdx + dir;
    if (nbIdx < 0 || nbIdx >= notes.length || Math.abs(notes[nbIdx] - n.midi) > 3) continue;
    const nb = notes[nbIdx];
    const D = beat * rng.pick([1, 1, 2]);
    let r = Math.max(2, Math.round((D / u + 1) / 2));
    for (; r >= 2; r--) {
      const run = (2 * r - 1) * u;
      // the landing starts on a division of the beat, counted from the note, with a head (the note held or struck) of at least a unit before the first change
      const minT = run + u;
      const cands: number[] = [];
      for (let T = Math.ceil(minT / g - 1e-6) * g; T <= L - Math.max(2, L * 0.36); T = snap(T + g)) cands.push(T);
      if (!cands.length) continue;
      const T = cands[Math.min(cands.length - 1, rng.int(0, 1))];
      const head = snap(T - run);
      const land = snap(L - T);
      if (head < u - 1e-6 || land < Math.max(2, L * 0.36) - 1e-6) continue;
      const events: PEvent[] = [{ t: n.t, len: head, base: n.i, hit: { ...h, len: head } }];
      let t = n.t + head;
      for (let j = 0; j < 2 * r - 1; j++) {
        const up = j % 2 === 0;
        const { vib: _v, ...base } = landingHit(h);
        const hit: GuitarHit = { ...base, step: Math.floor(t), len: u, notes: [up ? nb : n.midi], vel: clamp(h.vel * (up ? 0.88 : 0.92), 0.2, 1.2), exact: true, art: 'legato' };
        delete hit.shift;
        events.push({ t: snap(t), len: snap(u), base: n.i, hit });
        t += u;
      }
      const land0 = landingHit(h);
      events.push({ t: snap(t), len: snap(land), base: n.i, hit: { ...land0, step: Math.floor(t), len: land, art: 'legato', vel: h.vel * 0.94 } });
      if (Math.abs(t + land - (n.t + L)) > 0.05 || !heardMost(events, n.midi)) continue;
      const word = Math.abs(u - 1) < 0.02 ? '16ths' : Math.abs(u - 2) < 0.02 ? '8ths' : Math.abs(u - beat / 3) < 0.02 ? '8th triplets' : Math.abs(u - beat / 6) < 0.02 ? '16th triplets' : '32nds';
      out.push({ events, intent: 'return', contour: 'trill', cell: word, layout: 'trill', w: 1, label: `trill ${dir > 0 ? 'above' : 'below'} (${nb - n.midi > 0 ? '+' : ''}${nb - n.midi}) in ${word}, ${r} turns`, m: 2 * r - 1 });
      break;
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

/** The path as events: the head, the figure's notes (how each is played), the landing. Null if the time does not add up. */
function playPath(s: Span, ask: FigureAsk, p: { head: number; headHit?: Partial<GuitarHit>; tail: number; path: Path; isBridge: boolean; ms: number; pos: Pos[] }): PEvent[] | null {
  const n = s.note, h = s.event.hit, person = ask.person;
  const hands = s.ctx.hands;
  const events: PEvent[] = [];
  // the head: the note as it was, cut short (a bend into it, for a bend and run)
  events.push({ t: n.t, len: snap(p.head), base: n.i, hit: { ...h, len: p.head, ...(p.headHit ?? {}) } });
  let prevPitch = n.midi;
  let end = n.t + p.head;
  const rng = (k: number) => { const x = Math.sin((n.t * 131 + n.midi * 17 + k * 7.31 + p.pos.length) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const play = (pitch: number, t: number, dur: number, k: number, out: boolean, vel: number) => {
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
    end = t + dur;
  };
  const m = p.path.pitches.length;
  let mergedAt = -1;
  p.path.pitches.forEach((pitch, i) => {
    const last = i === m - 1;
    // (the last figure note of a return that is the note itself is the landing: it takes the tail's time too)
    if (!p.isBridge && last && pitch === n.midi) { mergedAt = p.pos[i].t; return; }
    play(pitch, p.pos[i].t, p.pos[i].dur, i, p.path.out[i], h.vel * (0.78 + 0.2 * ((i + 1) / m)));
  });
  if (!p.isBridge) {
    const t = mergedAt >= 0 ? mergedAt : end;
    const lastLen = mergedAt >= 0 ? p.pos[m - 1].dur + p.tail : p.tail;
    const d = n.midi - prevPitch;
    const pLeg = clamp(0.2 + 0.6 * hands.legato + person.legato * 0.4, 0, 0.9);
    const art: GuitarHit['art'] = d !== 0 && Math.abs(d) <= 4 && rng(99) < pLeg ? 'legato' : 'pick';
    const land = landingHit(h);
    events.push({ t: snap(t), len: snap(lastLen), base: n.i, hit: { ...land, step: Math.floor(t), len: lastLen, art, vel: h.vel * 0.94 } });
    end = t + lastLen;
  }
  return Math.abs(end - (n.t + n.len)) < 0.05 ? events : null;
}
