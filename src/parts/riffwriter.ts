// The riff writer (docs/RIFF-LAB.md): riffs written in layers, the way a guitarist builds one, instead of picking
// notes bar by bar (riff.ts). A riff is two runs of four bars (like the app's riff songs: a style for each half).
// The layers:
//  1. the style's rhythm: single-note hits where a feel likes them, chug stabs with palm mutes between, big chord
//     hits, a gallop on each beat, a pedal note answered by melody notes, stabs and then a single-note lick
//  2. a few pitches (the root most of all) and, for the single-note kinds, a contour, so notes repeat and it sticks
//  3. a one-bar cell, then an answer (half the same, half new), a turnaround, and a form (AAAB, ABAB...)
//  4. how each hit is struck: open note, palm mute, power chord, ghost note, a slide in
//  5. a pick of many: write several riffs from the seed, keep the one the style's rules like best
// Pure and deterministic: the same seed, song and chords give the same riff. 4/4 only for now. The two chord-picking
// styles (a picked hook, a clean arpeggio) write their notes as places in a chord (a scale step, a place in the shape)
// and take their fingering from the chord at each step (see `toHits`).

import { GENRES, type Genre, type RiffStyle } from '../genres';
import type { ChordPart, GuitarHit, Song } from '../idea';
import { Rng } from '../rng';
import { groupStarts } from '../rhythm';
import { SCALES, chordPc } from '../theory';
import { type Tuning, lowestOf, powerChord, riffNote, voicingsInTuning } from '../theory/fretboard';
import { PICK_STEPS, PICK_TEMPLATES } from './figures';
import { chordScale, pitchCell, stepSemis } from './motif';
import { ARP_PATTERNS, type RiffPart } from './riff';

/** The styles this writer can write: all eight of `RiffStyle`. */
export type WrittenStyle = 'single' | 'chug' | 'big' | 'gallop' | 'pedal' | 'lick' | 'picked' | 'arp';
export const WRITTEN_STYLES: readonly WrittenStyle[] = ['single', 'chug', 'big', 'gallop', 'pedal', 'lick', 'picked', 'arp'];
export const STYLE_LABEL: Record<WrittenStyle, string> = {
  single: 'Single-note riff', chug: 'Chugs and stabs', big: 'Big chords', gallop: 'Gallop', pedal: 'Pedal note', lick: 'Stabs and a lick',
  picked: 'Picked hook', arp: 'Clean arpeggio',
};
export const writes = (s: RiffStyle): s is WrittenStyle => (WRITTEN_STYLES as readonly string[]).includes(s);

export type RiffFeel = 'driving' | 'syncopated' | 'sparse' | 'chugging' | 'bouncy';
export type RiffFollow = 'chords' | 'key';
export type RiffRegister = 'low' | 'mid';

interface FeelSet {
  label: string;
  /** Hits in a bar (fewest, most). */
  hits: [number, number];
  /** How much the hits like the off-beat spots (0: on the beat). */
  syncope: number;
  /** How much they like the 16ths in between. */
  sixteenths: number;
  /** Chance a root note is palm-muted. */
  palm: number;
  /** Chance a hit on the beat (or a long one) is a power chord. */
  power: number;
  /** Chance a note is held right up to the next one (else it can be cut short). */
  hold: number;
  /** Chance a note repeats the one before. */
  stick: number;
}

/** The feels of the single-note riff (the other styles have their own shape). */
export const FEELS: Record<RiffFeel, FeelSet> = {
  driving: { label: 'Driving 8ths', hits: [6, 8], syncope: 0.1, sixteenths: 0, palm: 0.55, power: 0.2, hold: 0.3, stick: 0.5 },
  syncopated: { label: 'Syncopated', hits: [4, 7], syncope: 0.75, sixteenths: 0.2, palm: 0.2, power: 0.25, hold: 0.5, stick: 0.3 },
  sparse: { label: 'Sparse and heavy', hits: [2, 4], syncope: 0.3, sixteenths: 0, palm: 0, power: 0.5, hold: 0.85, stick: 0.2 },
  chugging: { label: 'Chugging 16ths', hits: [8, 12], syncope: 0.5, sixteenths: 0.9, palm: 0.85, power: 0.15, hold: 0.1, stick: 0.65 },
  bouncy: { label: 'Bouncy', hits: [5, 8], syncope: 0.6, sixteenths: 0.5, palm: 0.3, power: 0.2, hold: 0.35, stick: 0.35 },
};
export const FEEL_ORDER: RiffFeel[] = ['driving', 'syncopated', 'sparse', 'chugging', 'bouncy'];

/** What each riff genre tends to play (a genre not listed: any). */
const FEEL_BY_GENRE: Partial<Record<Genre, [RiffFeel, number][]>> = {
  hardrock: [['driving', 3], ['syncopated', 3], ['sparse', 1], ['bouncy', 2]],
  metal: [['chugging', 3], ['driving', 2], ['bouncy', 1], ['syncopated', 1]],
  grunge: [['sparse', 3], ['syncopated', 2], ['driving', 1]],
  altmetal: [['chugging', 3], ['syncopated', 2], ['bouncy', 1], ['sparse', 1]],
};

export interface RiffOptions {
  /** The styles of the two halves (missing: the genre's own arrangements, the ones this writer can write; decided by the seed). */
  styles?: [WrittenStyle, WrittenStyle];
  /** The single-note riff's feel (missing: by the song's genre, decided by the seed). */
  feel?: RiffFeel;
  /** Whether the riff moves with the chords or stays on the key (missing: the chords). */
  follow?: RiffFollow;
  /** Low on the open strings, or up an octave where notes can sit below the root (missing: by the seed). */
  register?: RiffRegister;
  /** How many riffs to write before keeping the best (missing: 24; 1 is the raw first one). */
  tries?: number;
}

/** One half of a riff (four bars). */
export interface RiffHalf {
  style: WrittenStyle;
  /** The shape of the four bars: A the riff, B its answer. */
  form: string;
  /** The pitches used, in semitones above the root. */
  pitches: number[];
  perBar: number;
  /** How the half ends. */
  turn: string;
  /** The first bar's rhythm: x a hit, a dot a gap, a space each beat. */
  grid: string;
}

export interface RiffInfo {
  /** The single-note feel (null: no half is a single-note riff). */
  feel: RiffFeel | null;
  follow: RiffFollow;
  register: RiffRegister;
  halves: [RiffHalf, RiffHalf];
  /** How well the rules like it (higher is better; 0 to 10). */
  score: number;
}

export interface WrittenRiff {
  part: RiffPart;
  info: RiffInfo;
}

/** One hit in a one-bar cell. */
interface Ev {
  pos: number;
  len: number;
  /** Semitones above the root of the chord sounding. */
  deg: number;
  kind: 'note' | 'palm' | 'power' | 'dead' | 'pick' | 'arp';
  slide?: number;
  vel: number;
  /** Picked hook: the note's place in the shape (L low root, O octave, F fifth, I inner, T the moving top), its scale step above the chord's root, and where the hand sits (a fret). `deg` is the same note in the key, to rate it by. */
  role?: string;
  step?: number;
  hand?: number;
  /** Arpeggio: how far up the chord's shape the note is (0 the lowest string, 1 the highest). */
  frac?: number;
  /** Stays on the key's root whatever the chord (a pedal note). */
  pedal?: boolean;
  /** Stays as written when the answer or a repeat changes notes (the pedal and the chugs). */
  fixed?: boolean;
}

/** What a style sounds like when it's right: each rule has a range; outside it costs (see `rate`). */
interface Rules {
  hits: [number, number];
  pitches: [number, number];
  /** Share of the notes on the root. */
  root: [number, number];
  /** Share of notes that repeat the one before. */
  same: [number, number];
  /** Share of hits off the beat. */
  off: [number, number];
  /** Bars that repeat (missing: about half to most). */
  repeat?: [number, number];
  /** False: big jumps are what the style does (picking through a chord), so they cost nothing. */
  leaps?: boolean;
}

/** A style's riff for four bars: the cell, its answer, the few pitches. */
interface Motif {
  style: WrittenStyle;
  set: number[];
  a: Ev[];
  b: Ev[];
  rules: Rules;
  /** A palm mute or ghost note only works on the root: a changed note becomes an open one (single-note and lick). */
  strict: boolean;
  /** The key's scale (semitones above the root), for the notes that are scale steps. */
  scale: number[];
}

const isRoot = (d: number) => ((d % 12) + 12) % 12 === 0;
/** How far `x` is outside the range lo..hi (0 inside). */
const outside = (x: number, [lo, hi]: [number, number]) => Math.max(0, lo - x, x - hi);

/* ------------------------------------------------------------------ 1. the rhythm (single-note) */

/** The off-beat spots riffs like to hit: the "and" of 1, the dotted 8th, the "a" of 2, the "and" of 3... */
const PUSH = [3, 6, 10, 11, 14];

/**
 * Where the hits fall in a 16-step bar, from step `lo` on. The first step is almost always hit; the feel decides
 * how much the rest like the off-beats.
 */
function skeleton(rng: Rng, f: FeelSet, lo = 0, count?: number): number[] {
  const n = Math.min(count ?? rng.int(f.hits[0], f.hits[1]), 16 - lo);
  const pos: number[] = rng.chance(lo ? 0.6 : 0.9) ? [lo] : [];
  while (pos.length < n) {
    const open: [number, number][] = [];
    for (let p = lo; p < 16; p++) {
      if (pos.includes(p)) continue;
      let w = p % 4 === 0 ? 1 - 0.3 * f.syncope : p % 4 === 2 ? 0.7 : 0.2 + 0.7 * f.sixteenths;
      if (PUSH.includes(p)) w += f.syncope * 0.8;
      // 16ths side by side are rare unless the feel is a busy one
      if (f.sixteenths < 0.5 && (pos.includes(p - 1) || pos.includes(p + 1))) w *= 0.3;
      open.push([p, w]);
    }
    pos.push(rng.weighted(open));
  }
  return pos.sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ 2. the pitches */

/** The few notes a single-note riff uses (semitones above the root), the root always among them. */
function pitchSet(rng: Rng, song: Song, register: RiffRegister): number[] {
  const scale: readonly number[] = SCALES[song.mode];
  const third = scale.includes(3) ? 3 : 4;
  const kits: [number[], number][] = [
    [[0], 0.6], [[0, third], 2], [[0, 5], 1.5], [[0, 7], 1.5], [[0, 10], 1],
    [[0, third, 5], 3], [[0, third, 7], 2.5], [[0, 5, 7], 2], [[0, third, 10], 1.5], [[0, 7, 10], 1.5], [[0, 5, 10], 1],
    [[0, third, 5, 7], 2], [[0, third, 5, 10], 1.5], [[0, third, 7, 10], 1.5], [[0, third, 5, 6], 1],
    [[0, 7, 12], 1], [[0, 10, 12], 1],
  ];
  // phrygian: the flat 2nd is its sound
  if (scale.includes(1)) kits.push([[0, 1, third], 2], [[0, 1, 7], 1.5]);
  const kit = rng.weighted(kits);
  if (register === 'low') return kit;
  // up an octave from the open string, the 5th and the b7 can sit below the root
  return [...new Set(kit.map((d) => (d >= 5 && d < 12 && rng.chance(0.5) ? d - 12 : d)))].sort((a, b) => a - b);
}

type Shape = 'flat' | 'rise' | 'fall' | 'arch' | 'valley' | 'zig';

/** A note (from the set) for each hit: a contour, a pull to the root on the beats, and notes that stay where they are. */
function melody(rng: Rng, f: FeelSet, pos: number[], set: number[]): number[] {
  const k = set.length;
  const root = set.indexOf(0);
  const shape = k === 1 ? 'flat' : rng.weighted<Shape>([['flat', 2], ['rise', 1.5], ['fall', 1.5], ['arch', 1], ['valley', 1], ['zig', 1.5]]);
  const target = (i: number) => {
    const t = pos.length > 1 ? i / (pos.length - 1) : 0;
    const share = shape === 'rise' ? t : shape === 'fall' ? 1 - t : shape === 'arch' ? 1 - Math.abs(2 * t - 1)
      : shape === 'valley' ? Math.abs(2 * t - 1) : shape === 'zig' ? i % 2 : 0;
    return shape === 'flat' ? root : Math.round(share * (k - 1));
  };
  const idx: number[] = [];
  pos.forEach((p, i) => {
    const prev = idx[i - 1];
    let x: number;
    if (i === 0) x = rng.chance(0.9) ? root : target(i);
    else if (p % 4 === 0 && rng.chance(0.4)) x = root;
    else if (rng.chance(f.stick)) x = prev;
    else x = Math.max(0, Math.min(k - 1, target(i) + rng.pick([-1, 0, 0, 1])));
    // the last hit of a bar often leans away from the root, so the riff wants to go round again
    if (i === pos.length - 1 && k > 1 && rng.chance(0.5)) x = rng.pick(set.map((_, j) => j).filter((j) => j !== root));
    idx.push(x);
  });
  return idx.map((x) => set[x]);
}

/* ------------------------------------------------------------------ 3. the cells of each style */

/** The single-note cell: the rhythm and the notes, each hit given a length and a way of being struck. */
function cellOf(rng: Rng, f: FeelSet, pos: number[], degs: number[]): Ev[] {
  return pos.map((p, i) => {
    const gap = (pos[i + 1] ?? 16) - p;
    const deg = degs[i];
    const onBeat = p % 4 === 0;
    let kind: Ev['kind'] = 'note';
    if (isRoot(deg) && gap <= 2 && rng.chance(f.palm)) kind = 'palm';
    else if (isRoot(deg) && gap <= 2 && f.sixteenths > 0.5 && rng.chance(0.08)) kind = 'dead';
    else if ((onBeat || gap >= 4) && rng.chance(f.power)) kind = 'power';
    let len = gap;
    if (kind === 'palm' || kind === 'dead') len = Math.min(gap, 2);
    else if (gap >= 2 && !rng.chance(f.hold)) len = Math.min(gap, rng.pick([1, 2, 2, 3]));
    const slide = kind === 'note' && !isRoot(deg) && gap >= 2 && rng.chance(0.1) ? -rng.pick([1, 2]) : undefined;
    const vel = kind === 'palm' ? (onBeat ? 0.86 : 0.76) : p === 0 ? 0.92 : onBeat ? 0.85 : 0.78;
    return { pos: p, len, deg, kind, slide, vel };
  });
}

/** Chugs and stabs: a power chord on the one and on a few other spots (left to ring), palm-muted chugs on the root between them. */
function chugCell(rng: Rng, set: number[], sixteenths: boolean, pedal: boolean): Ev[] {
  const spots = [2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15];
  const stabs = [0, ...rng.shuffle(spots).slice(0, rng.int(1, 3))].sort((a, b) => a - b);
  const out: Ev[] = [];
  stabs.forEach((s, i) => {
    const next = stabs[i + 1] ?? 16;
    const ring = Math.min(next - s, rng.pick([2, 3, 4, 6, 8]));
    // the odd stab on another note (the chromatic ones are the metal sound)
    const deg = i > 0 && set.length > 1 && rng.chance(0.35) ? rng.pick(set.filter((d) => d !== 0)) : 0;
    out.push({ pos: s, len: ring, deg, kind: 'power', vel: 0.95 });
    for (let p = s + ring; p < next; p++) {
      if (!sixteenths && p % 2) continue;
      if (rng.chance(0.12)) continue; // breathe
      const dead = sixteenths && rng.chance(0.12);
      out.push({ pos: p, len: sixteenths ? 1 : 2, deg: 0, kind: dead ? 'dead' : 'palm', vel: p % 4 === 0 ? 0.86 : 0.76, pedal, fixed: true });
    }
  });
  return out;
}

/** Big chords: one chord for the bar, a chord on every 8th or every beat, halves, a dotted 3-3-2, or a chord and a push or two. */
function bigCell(rng: Rng, set: number[]): Ev[] {
  const pattern = rng.weighted<'whole' | 'drive' | 'push' | 'half' | 'quarters' | 'dotted' | 'tresillo'>(
    [['whole', 0.7], ['drive', 1], ['push', 2], ['half', 1], ['quarters', 1], ['dotted', 1.2], ['tresillo', 1]]);
  const deg = (first: boolean) => (first || rng.chance(0.65) ? 0 : rng.pick(set));
  const at = (pos: number[]): Ev[] => pos.map((p, i) => ({ pos: p, len: (pos[i + 1] ?? 16) - p, deg: deg(i === 0), kind: 'power' as const, vel: p % 4 === 0 ? 0.95 : 0.88 }));
  if (pattern === 'whole') return at([0]);
  if (pattern === 'drive') {
    const out: Ev[] = [];
    for (let p = 0; p < 16; p += 2) out.push({ pos: p, len: 2, deg: deg(p === 0), kind: 'power', vel: p % 4 === 0 ? 0.92 : 0.76 });
    return out;
  }
  if (pattern === 'half') return at([0, 8]);
  if (pattern === 'quarters') return at([0, 4, 8, 12]);
  if (pattern === 'dotted') return at([0, 6, 12]);
  if (pattern === 'tresillo') return at([0, 3, 6, 8, 11, 14]);
  return at([0, ...rng.shuffle([6, 10, 14, 3, 11]).slice(0, rng.int(1, 2))].sort((a, b) => a - b));
}

/** A gallop on every beat (an 8th and two 16ths, or the other way round), on the root or on a line that moves a note a beat. */
function gallopCell(rng: Rng, set: number[]): Ev[] {
  const rev = rng.chance(0.3);
  const line = set.length > 1 && rng.chance(0.4);
  const palm = rng.chance(0.75);
  const beatDeg = line ? melody(rng, FEELS.driving, [0, 4, 8, 12], set) : [0, 0, 0, 0];
  const figure = rev ? [[0, 1], [1, 1], [2, 2]] : [[0, 2], [2, 1], [3, 1]];
  const out: Ev[] = [];
  for (let b = 0; b < 4; b++) {
    const s = b * 4, deg = beatDeg[b];
    // now and then a beat is one held hit instead of a gallop
    if (b > 0 && rng.chance(0.12)) { out.push({ pos: s, len: 4, deg, kind: line ? 'note' : 'power', vel: 0.9 }); continue; }
    figure.forEach(([o, len], k) => out.push({ pos: s + o, len, deg, kind: palm ? 'palm' : 'note', vel: k === 0 ? (b === 0 ? 0.9 : 0.82) : 0.74 }));
  }
  // the one is sometimes an open chord
  if (out[0].kind === 'palm' && !line && rng.chance(0.4)) out[0].kind = 'power';
  return out;
}

/** A pedal note: palm-muted root hits with melody notes (open) bouncing off it, a half-bar pattern played twice. */
function pedalCell(rng: Rng, set: number[]): Ev[] {
  const pattern = [...rng.pick(['PMPM', 'PPMP', 'PMPP', 'PPPM', 'P.M.', 'PMMP'])];
  const high = set.filter((d) => d !== 0);
  const melodic: number[] = [];
  for (const c of pattern) if (c === 'M') melodic.push(melodic.length && rng.chance(0.5) ? melodic[melodic.length - 1] : rng.pick(high));
  const out: Ev[] = [];
  for (let h = 0; h < 2; h++) {
    let m = 0;
    pattern.forEach((c, j) => {
      const pos = h * 8 + j * 2;
      if (c === 'P') out.push({ pos, len: 2, deg: 0, kind: 'palm', vel: j === 0 ? 0.88 : 0.76, pedal: true, fixed: true });
      else if (c === 'M') out.push({ pos, len: 2, deg: melodic[m++], kind: 'note', vel: 0.88 });
    });
  }
  return out;
}

/** Stabs in the first half of the bar, answered by a single-note lick in the second. */
function lickCell(rng: Rng, set: number[]): Ev[] {
  const f = FEELS.syncopated;
  const stabs = rng.chance(0.5) ? [0, rng.pick([4, 6])] : [0];
  const out: Ev[] = stabs.map((p, i) => ({ pos: p, len: (stabs[i + 1] ?? 8) - p, deg: 0, kind: 'power' as const, vel: 0.95 }));
  const pos = skeleton(rng, f, 8, rng.int(3, 5));
  out.push(...cellOf(rng, f, pos, melody(rng, f, pos, set)));
  return out;
}

/** A picked hook: one note on every 8th (every 16th in a slow song) following a template; the top note moves, the rest are low root, octave, fifth and an inner note. */
function pickedCell(rng: Rng, song: Song, scale: number[]): Ev[] {
  const tpl = rng.pick(PICK_TEMPLATES);
  const nT = [...tpl].filter((x) => x === 'T').length;
  // (the moving top stays in a small range: octave to 11th)
  const tops = pitchCell(rng, Math.max(2, nT), 3).map((s) => Math.max(7, Math.min(10, 8 + s)));
  const hand = rng.int(7, 14);
  const every = song.bpm < 100 && rng.chance(0.5) ? 1 : 2;
  const out: Ev[] = [];
  let k = 0;
  for (let p = 0, slot = 0; p < 16; p += every, slot++) {
    const role = tpl[slot % tpl.length];
    const step = role === 'T' ? tops[k++ % tops.length] : PICK_STEPS[role];
    out.push({ pos: p, len: every * 2, deg: stepSemis(scale, step), kind: 'pick', role, step, hand, vel: role === 'L' ? 0.86 : role === 'T' ? 0.84 : 0.7 + rng.next() * 0.06 });
  }
  return out;
}

/** A clean arpeggio: a pattern up and down the chord's shape on every 8th (now and then every 16th), with the odd gap. */
function arpCell(rng: Rng, song: Song): Ev[] {
  const pattern = rng.pick(ARP_PATTERNS);
  const every = rng.chance(0.2 + song.w * 0.3) ? 1 : 2;
  const out: Ev[] = [];
  for (let p = 0, k = 0; p < 16; p += every, k++) {
    if (k > 1 && rng.chance(0.08)) continue; // a little air
    const frac = pattern[k % pattern.length];
    out.push({ pos: p, len: 8, deg: Math.round(frac * 12), kind: 'arp', frac, vel: frac === 0 ? 0.66 : 0.52 + rng.next() * 0.1 });
  }
  return out;
}

/* ------------------------------------------------------------------ 3b. the answer, the turnaround, the form */

/** A hit changes note (a palm mute or ghost note only works on the root, where `strict`). */
function renote(e: Ev, deg: number, strict: boolean) {
  e.deg = deg;
  if (strict && (e.kind === 'palm' || e.kind === 'dead') && !isRoot(deg)) e.kind = 'note';
}

/** The second half of the bar answers the first: the same start, new notes (a beat at a time in a gallop), sometimes ending on a held note. */
function answerOf(rng: Rng, cell: Ev[], set: number[], strict: boolean, scale: number[], byBeat = false): Ev[] {
  const out = cell.map((e) => ({ ...e }));
  // the chord-picking styles keep the first half and move the second: new top notes, or another pattern up the shape
  if (out.some((e) => e.kind === 'pick')) {
    for (const e of out) if (e.pos >= 8 && e.role === 'T' && rng.chance(0.85)) retop(e, rng, scale);
    return out;
  }
  if (out.some((e) => e.kind === 'arp')) {
    const other = rng.pick(ARP_PATTERNS);
    let k = 0;
    for (const e of out) if (e.pos >= 8) { e.frac = other[k++ % other.length]; e.deg = Math.round(e.frac * 12); }
    return out;
  }
  if (set.length > 1) {
    if (byBeat) {
      for (const b of [2, 3]) {
        const beat = out.filter((e) => e.pos >= b * 4 && e.pos < b * 4 + 4 && !e.fixed);
        if (beat.length && rng.chance(0.85)) { const d = rng.pick(set.filter((x) => x !== beat[0].deg)); for (const e of beat) renote(e, d, strict); }
      }
    } else for (const e of out) if (e.pos >= 8 && !e.fixed && rng.chance(0.85)) renote(e, rng.pick(set.filter((d) => d !== e.deg)), strict);
  }
  const last = out[out.length - 1];
  if (last && !last.fixed && last.kind !== 'palm' && rng.chance(0.35)) { last.len = 16 - last.pos; }
  return out;
}

/** A picked hook's top note moves a step or two (staying in the octave to 11th). */
function retop(e: Ev, rng: Rng, scale: number[]) {
  const step = Math.max(7, Math.min(10, e.step! + rng.pick([-2, -1, 1, 2])));
  e.step = step;
  e.deg = stepSemis(scale, step);
}

/** One hit of a repeat played differently (the second time round). */
function varyOne(rng: Rng, cell: Ev[], set: number[], strict: boolean, scale: number[]): Ev[] {
  const out = cell.map((e) => ({ ...e }));
  if (out.some((e) => e.kind === 'pick' || e.kind === 'arp')) {
    const free = out.filter((e) => e.role === 'T' || e.kind === 'arp');
    if (free.length) {
      const e = rng.pick(free);
      if (e.kind === 'pick') retop(e, rng, scale);
      else { e.frac = Math.round(Math.max(0, Math.min(1, e.frac! + rng.pick([-0.2, 0.2]))) * 10) / 10; e.deg = Math.round(e.frac * 12); }
    }
    return out;
  }
  const free = set.length > 1 ? out.slice(1).filter((e) => !e.fixed) : [];
  if (free.length) { const e = rng.pick(free); renote(e, rng.pick(set.filter((d) => d !== e.deg)), strict); }
  return out;
}

/** How a four-bar half ends: a chord left to ring, silence for a drum fill, a run of 16ths, or a pickup into the next bar. */
function turnaround(rng: Rng, cell: Ev[], set: number[]): { cell: Ev[]; name: string } {
  const keep = (to: number) => cell.filter((e) => e.pos < to).map((e) => ({ ...e, len: Math.min(e.len, to - e.pos) }));
  if (cell.some((e) => e.kind === 'arp')) {
    // (a clean arpeggio ends clean: a note left to ring, silence, or a quick climb up the shape)
    const kind = rng.weighted<'ring' | 'stop' | 'climb'>([['ring', 2], ['stop', 2], ['climb', 2]]);
    if (kind === 'stop') return { cell: keep(12), name: 'a stop for the drum fill' };
    if (kind === 'ring') return { cell: [...keep(12), { pos: 12, len: 4, deg: 0, kind: 'arp', frac: 0, vel: 0.7 }], name: 'a note left to ring' };
    return { cell: [...keep(12), ...[0, 1, 2, 3].map((i) => ({ pos: 12 + i, len: 4, deg: [4, 7, 10, 12][i], kind: 'arp' as const, frac: [0.3, 0.5, 0.7, 0.9][i], vel: 0.6 + i * 0.04 }))], name: 'a quick climb up the shape' };
  }
  const kind = rng.weighted<'ring' | 'stop' | 'run' | 'push'>([['ring', 2], ['stop', 2], ['run', 2], ['push', 1]]);
  if (kind === 'ring') {
    const at = rng.chance(0.5) ? 8 : 12;
    return { cell: [...keep(at), { pos: at, len: 16 - at, deg: rng.pick(set.filter((d) => [0, 7, 10, -5, -2].includes(d))), kind: 'power', vel: 0.95 }], name: 'a chord left to ring' };
  }
  if (kind === 'stop') return { cell: keep(12), name: 'a stop for the drum fill' };
  if (kind === 'run') {
    const down = [...set].sort((a, b) => b - a);
    return { cell: [...keep(12), ...[0, 1, 2, 3].map((i) => ({ pos: 12 + i, len: 1, deg: down[i % down.length], kind: 'note' as const, vel: 0.8 }))], name: 'a run of 16ths' };
  }
  return { cell: [...keep(14), { pos: 14, len: 1, deg: 0, kind: 'palm', vel: 0.8 }, { pos: 15, len: 1, deg: 0, kind: 'palm', vel: 0.86 }], name: 'a pickup into the next bar' };
}

/** The four bars of a half: A the riff, B its answer. */
const FORMS: [string, number][] = [['AAAB', 3], ['ABAB', 2.5], ['AAAA', 1.5], ['AABA', 1]];

/* ------------------------------------------------------------------ 3c. a style's motif and its rules */

const RULES: Record<Exclude<WrittenStyle, 'single'>, Rules> = {
  chug: { hits: [5, 13], pitches: [1, 3], root: [0.6, 1], same: [0.5, 1], off: [0.2, 0.8] },
  big: { hits: [1, 5], pitches: [1, 3], root: [0.5, 1], same: [0.3, 1], off: [0, 0.5] },
  gallop: { hits: [6, 13], pitches: [1, 4], root: [0.4, 1], same: [0.6, 1], off: [0.35, 0.85] },
  pedal: { hits: [4, 9], pitches: [2, 5], root: [0.4, 0.75], same: [0.3, 0.8], off: [0.25, 0.75] },
  lick: { hits: [3, 8], pitches: [2, 5], root: [0.25, 0.7], same: [0.1, 0.6], off: [0.15, 0.7] },
  picked: { hits: [8, 16], pitches: [4, 8], root: [0.2, 0.6], same: [0, 0.35], off: [0.4, 0.8], repeat: [0.5, 1], leaps: false },
  arp: { hits: [7, 16], pitches: [3, 6], root: [0.15, 0.6], same: [0, 0.3], off: [0.4, 0.8], repeat: [0.5, 1], leaps: false },
};

/** A style's riff for four bars: the pitches, the cell, and the answer to it. */
function motifFor(rng: Rng, style: WrittenStyle, song: Song, f: FeelSet, register: RiffRegister): Motif {
  const third = (SCALES[song.mode] as readonly number[]).includes(3) ? 3 : 4;
  /** The root and `n` of the others, in order. */
  const withRoot = (n: number, from: number[]) => [0, ...rng.shuffle(from).slice(0, n)].sort((a, b) => a - b);
  let set: number[], a: Ev[], rules: Rules, strict = false, byBeat = false;
  const scale = [...(SCALES[song.mode] as readonly number[])];
  if (style === 'picked' || style === 'arp') {
    // (the pitches here are places in the chord; `set` is the notes a turnaround can lean on)
    set = [0, third, 5, 7, 10];
    a = style === 'picked' ? pickedCell(rng, song, scale) : arpCell(rng, song);
    rules = RULES[style];
  } else if (style === 'single') {
    set = pitchSet(rng, song, register);
    const pos = skeleton(rng, f);
    a = cellOf(rng, f, pos, melody(rng, f, pos, set));
    const want = 0.25 + 0.45 * f.syncope;
    rules = { hits: f.hits, pitches: [f.sixteenths > 0.8 ? 1 : 2, 4], root: [0.35, 0.7], same: [0.3, 0.7], off: [want - 0.2, want + 0.2] };
    strict = true;
  } else if (style === 'chug') {
    set = withRoot(rng.int(0, 2), [third, 5, 7, 10]);
    if (rng.chance(0.2)) set = [...set, rng.pick([1, 6])].sort((x, y) => x - y);
    a = chugCell(rng, set, rng.chance(0.5), rng.chance(0.5));
    rules = RULES.chug;
  } else if (style === 'big') {
    set = withRoot(rng.int(0, 2), [10, 7, 5, third]);
    a = bigCell(rng, set);
    rules = RULES.big;
  } else if (style === 'gallop') {
    set = withRoot(rng.int(0, 3), [third, 5, 7, 10]);
    a = gallopCell(rng, set);
    rules = RULES.gallop;
    byBeat = true;
  } else if (style === 'pedal') {
    set = withRoot(rng.int(1, 3), [third, 5, 7, 10]);
    a = pedalCell(rng, set);
    rules = RULES.pedal;
  } else {
    set = rng.pick([[0, third, 5, 7], [0, third, 5, 10], [0, third, 7, 10], [0, 5, 7, 10]]);
    a = lickCell(rng, set);
    rules = RULES.lick;
    strict = true;
  }
  return { style, set, a, b: answerOf(rng, a, set, strict, scale, byBeat), rules, strict, scale };
}

/* ------------------------------------------------------------------ 4. onto the guitar */

/** A note the low strings can play (a fret up to 12 on the four lowest). */
function playable(m: number, t: Tuning): number {
  while (m > t.strings[3] + 12) m -= 12;
  while (m < t.strings[0]) m += 12;
  return m;
}

function toHits(cells: Ev[][], song: Song, chords: ChordPart, follow: RiffFollow, register: RiffRegister): GuitarHit[] {
  const t = song.tuning!;
  const { key, total } = song;
  const chordAt = (g: number) => chords.timeline[chords.chordIdx[Math.min(g, total - 1)]].chord;
  const hits: GuitarHit[] = [];
  // (picked notes and arpeggio notes ring on into the next ones: they keep their length)
  const rings = new Set<GuitarHit>();
  const home = chords.timeline[0].chord;
  const shapes = cells.some((c) => c.some((e) => e.kind === 'arp')) ? voicingsInTuning(key, chords.timeline.map((te) => te.chord), t, { preferOpen: true }) : [];
  cells.forEach((cell, bi) => {
    for (const e of cell) {
      const step = song.bars[bi].start + e.pos;
      const base0 = { step, len: Math.max(1, e.len), vel: e.vel };
      if (e.kind === 'pick') {
        // a scale step above the chord's root, on the string nearest where the hand sits
        const ch = follow === 'key' ? home : chordAt(step);
        const midi = 50 + (((chordPc(key, ch) - 50) % 12) + 12) % 12 + stepSemis(chordScale(song.mode, ch), e.step!);
        const h: GuitarHit = { ...base0, ...fretNear(midi, t, e.hand!), letRing: true };
        hits.push(h); rings.add(h);
        continue;
      }
      if (e.kind === 'arp') {
        // the note a fraction of the way up the chord's shape (the shape of the chord sounding at that step)
        const v = shapes[follow === 'key' ? 0 : chords.chordIdx[Math.min(step, total - 1)]];
        const strings = v.frets.flatMap((f, s) => (f === null ? [] : [s]));
        const i = Math.round(e.frac! * (v.notes.length - 1));
        const h: GuitarHit = { ...base0, notes: [v.notes[i]], strings: [strings[i]], clean: true, letRing: true };
        hits.push(h); rings.add(h);
        continue;
      }
      const rootPc = e.pedal || follow === 'key' ? key : chordPc(key, chordAt(step));
      const pc = (((rootPc + e.deg) % 12) + 12) % 12;
      const base = { step, len: Math.max(1, e.len), vel: e.vel };
      if (e.kind === 'power') hits.push({ ...base, ...powerChord(pc, t, true), slide: e.slide });
      else if (e.kind === 'dead') hits.push({ ...base, ...powerChord(pc, t, false), mute: 'dead', vel: 0.7 });
      else {
        const f = e.kind === 'palm' ? powerChord(pc, t, false) : riffNote(playable(lowestOf(rootPc, t) + (register === 'mid' ? 12 : 0) + e.deg, t), t);
        hits.push({ ...base, ...f, mute: e.kind === 'palm' ? 'palm' : undefined, slide: e.slide });
      }
    }
  });
  hits.sort((a, b) => a.step - b.step);
  // a hit never rings past the next one
  hits.forEach((h, i) => { if (hits[i + 1] && !rings.has(h)) h.len = Math.max(1, Math.min(h.len, hits[i + 1].step - h.step)); });
  return hits;
}

/** A single note on the string whose fret is closest to where the hand sits, up to fret 14 (an octave lower when it won't reach). */
function fretNear(midi: number, t: Tuning, pos: number): { notes: number[]; strings: number[] } {
  let m = midi;
  while (m < t.strings[0]) m += 12;
  for (;; m -= 12) {
    let best = -1, cost = Infinity;
    for (let s = 0; s < 6; s++) {
      const f = m - t.strings[s];
      if (f < 0 || f > 14) continue;
      const c = Math.abs(f - pos) + (f === 0 ? 1.5 : 0);
      if (c < cost) { best = s; cost = c; }
    }
    if (best >= 0 || m - 12 < t.strings[0]) return { notes: [m], strings: [Math.max(0, best)] };
  }
}

/** What the drums and the bass read from the riff (as riff.ts leaves them). */
function riffPartOf(hits: GuitarHit[], song: Song, notes: string[]): RiffPart {
  const accents = new Array<number>(song.total).fill(0);
  const sounding = new Array<boolean>(song.total).fill(false);
  const beats = new Set(song.bars.flatMap((b) => groupStarts(b.groups).map((p) => b.start + p)));
  for (const h of hits) {
    if (h.clean) continue; // (clean arpeggio notes don't lead the drums or the bass)
    const a = h.mute === 'palm' ? 0.3 : h.mute === 'dead' ? 0 : h.notes.length > 1 ? 1 : beats.has(h.step) ? 0.5 : 0.2;
    accents[h.step] = Math.max(accents[h.step], a);
    for (let g = h.step; g < Math.min(song.total, h.step + h.len); g++) sounding[g] = true;
  }
  return { hits, accents, sounding, notes };
}

/* ------------------------------------------------------------------ 5. the rules, and a pick of many */

/** How the rules like four bars of a style (about -1 to +0.25; 0 is a good one). */
function rate(cells: Ev[][], r: Rules): number {
  const all = cells.flatMap((c) => c);
  const n = all.length;
  const rhythmOf = (c: Ev[]) => c.map((e) => e.pos).join(',');
  const barRepeat = cells.filter((c) => rhythmOf(c) === rhythmOf(cells[0])).length / cells.length;
  const kinds = new Set(cells.map(rhythmOf)).size;
  const degs = new Set(all.map((e) => e.deg)).size;
  const rootShare = all.filter((e) => isRoot(e.deg)).length / n;
  const offBeat = all.filter((e) => e.pos % 4 !== 0).length / n;
  let same = 0, leaps = 0;
  for (let i = 1; i < n; i++) {
    const d = Math.abs(all[i].deg - all[i - 1].deg);
    if (d === 0) same++;
    else if (d > 7 && d !== 12) leaps++;
  }
  let s = 0;
  s -= outside(n / cells.length, r.hits) * 0.15;
  s -= outside(degs, r.pitches) * 0.4;
  s -= outside(rootShare, r.root) * 2;
  s -= outside(n > 1 ? same / (n - 1) : 1, r.same) * 1.2;
  if (r.leaps !== false) s -= leaps * 0.12;
  s -= outside(barRepeat, r.repeat ?? [0.5, 0.85]) * 1.5;
  s -= Math.max(0, kinds - 3) * 0.25;
  s -= outside(offBeat, r.off);
  // starts on the one, on the root; ends somewhere that leads on
  const first = cells[0][0];
  if (first && first.pos === 0 && isRoot(first.deg)) s += 0.15;
  const lastCell = cells[cells.length - 1];
  const last = lastCell[lastCell.length - 1];
  if (last && [0, 7, 10].includes(((last.deg % 12) + 12) % 12)) s += 0.1;
  return s;
}

const grid = (c: Ev[]) => Array.from({ length: 16 }, (_, p) => (p && p % 4 === 0 ? ' ' : '') + (c.some((e) => e.pos === p) ? 'x' : '·')).join('');

function attempt(seed: string, song: Song, chords: ChordPart, styles: [WrittenStyle, WrittenStyle], feel: RiffFeel, follow: RiffFollow, register: RiffRegister): WrittenRiff {
  const rng = new Rng(seed);
  const f = FEELS[feel];
  const same = styles[0] === styles[1];
  const first = motifFor(rng, styles[0], song, f, register);
  const motifs = [first, same ? first : motifFor(rng, styles[1], song, f, register)];
  const form0 = rng.weighted(FORMS);
  const cells: Ev[][] = [];
  const halves: RiffHalf[] = [];
  let score = 0;
  motifs.forEach((m, half) => {
    // (the same style in both halves: the same riff, the second time with a turnaround and sometimes a note changed)
    const form = same || half === 0 ? form0 : rng.weighted(FORMS);
    const mine: Ev[][] = [];
    let turn = 'nothing special';
    [...form].forEach((letter, j) => {
      let cell = letter === 'A' ? m.a : m.b;
      if (same && half === 1 && j === 2 && rng.chance(0.35)) cell = varyOne(rng, cell, m.set, m.strict, m.scale);
      if (j === 3 && (half === 1 || rng.chance(same ? 0.3 : 0.7))) { const t = turnaround(rng, cell, m.set); cell = t.cell; turn = t.name; }
      mine.push(cell);
    });
    cells.push(...mine);
    score += rate(mine, m.rules) / 2;
    halves.push({ style: m.style, form, pitches: m.set, perBar: Math.round((mine.reduce((a, c) => a + c.length, 0) / 4) * 10) / 10, turn, grid: grid(mine[0]) });
  });
  const hits = toHits(cells, song, chords, follow, register);
  const label = same ? STYLE_LABEL[styles[0]] : `${STYLE_LABEL[styles[0]]}, then ${STYLE_LABEL[styles[1]].toLowerCase()}`;
  const notes = [`Guitar in ${song.tuning!.name}: a written riff: ${label}`];
  const info: RiffInfo = {
    feel: styles.includes('single') ? feel : null, follow, register, halves: halves as [RiffHalf, RiffHalf],
    // (-1 to +0.25 spread over 0 to 10)
    score: Math.max(0, ((score + 1) / 1.25) * 10),
  };
  return { part: riffPartOf(hits, song, notes), info };
}

/** The riff writer works on 4/4 songs of eight bars in a riff genre's tuning. */
export function canWriteRiff(song: Song): boolean {
  return !!song.tuning && song.bars.length === 8 && song.bars.every((b) => b.len === 16 && b.groups.length === 4);
}

/** The styles of the two halves, from the genre's own arrangements (only ones this writer can write), decided by the seed. */
export function pickStyles(seed: string, genre: Genre): [WrittenStyle, WrittenStyle] {
  const pool = (GENRES[genre].riff?.arrangements ?? [])
    .filter(([x, y]) => writes(x) && writes(y))
    .map(([x, y, w]) => [[x, y] as [WrittenStyle, WrittenStyle], w] as const);
  return pool.length ? new Rng(`${seed}-styles`).weighted(pool) : ['single', 'single'];
}

/** A riff for the song, written from `seed`: `tries` riffs written, the best by the rules kept. Null where the writer can't (see canWriteRiff). */
export function writeRiff(seed: string, song: Song, chords: ChordPart, o: RiffOptions = {}): WrittenRiff | null {
  if (!canWriteRiff(song)) return null;
  const styles = o.styles ?? pickStyles(seed, song.genre);
  const feel = o.feel ?? new Rng(`${seed}-feel`).weighted(FEEL_BY_GENRE[song.genre] ?? FEEL_ORDER.map((x) => [x, 1] as [RiffFeel, number]));
  const register = o.register ?? (new Rng(`${seed}-register`).chance(0.3) ? 'mid' : 'low');
  const follow = o.follow ?? 'chords';
  let best: WrittenRiff | null = null;
  for (let i = 0; i < Math.max(1, o.tries ?? 24); i++) {
    const r = attempt(`${seed}-try${i}`, song, chords, styles, feel, follow, register);
    if (!best || r.info.score > best.info.score) best = r;
  }
  return best && { ...best, info: { ...best.info, score: Math.round(best.info.score * 10) / 10 } };
}
