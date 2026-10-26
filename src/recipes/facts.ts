// What the recipe lab works out about a lick (docs/RECIPE-LAB.md): its facts (length, range, shape, techniques,
// how it ends), a guess for the things Paul marks (job, genres, moods, energy) until he marks them, and the
// fingering that draws it as tab. Nothing here is used by the song writers yet.

import { BY_GENRE, type LickKind } from '../players/lead';
import { moodFit, shapeTags } from '../parts/solotags';
import { MOODS } from '../tension';
import type { LibNote, LickEntry, Role } from './library';
import { parseNotes, spanOf } from './library';

const mod = (n: number, m: number) => ((n % m) + m) % m;
export const DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

export interface Facts {
  /** In 16ths. */
  length: number;
  count: number;
  perBeat: number;
  /** Highest minus lowest note, in semitones (double-stops counted). */
  range: number;
  contour: string;
  maxLeap: number;
  techniques: string[];
  /** Over the chord's root: the first note and the note it ends on (after any bend let down). */
  starts: string;
  ends: string;
  /** Ends on the root, 3rd or 5th. */
  strongEnd: boolean;
  offBeat: boolean;
  outNotes: number;
}

export function techniques(notes: LibNote[]): string[] {
  const t = new Set<string>();
  for (const n of notes) {
    if (n.dyad === 0) t.add('unison bend');
    else if (n.dyad !== undefined) t.add('double-stop');
    if (n.bend && n.dyad !== 0) t.add(n.bend >= 3 ? 'overbend' : 'bend');
    if (n.unbend) t.add(n.bend ? 'let down' : 'pre-bend');
    if (n.trill) t.add('trill');
    if (n.tremolo) t.add('tremolo');
    if (n.rake) t.add('rake');
    if (n.dead) t.add('ghost');
    if (n.art === 'slide') t.add('slide');
    if (n.art === 'legato') t.add('legato');
    if (n.vib) t.add('vibrato');
  }
  return [...t];
}

/** Where each note ends up after a bend let down. */
const landing = (n: LibNote) => n.semi - (n.unbend ?? 0);

const shapeOf = (l: LickEntry, notes: LibNote[]) => {
  const ps = notes.map(landing);
  return { minor: l.q !== 'maj', deg: ps[0], steps: ps.slice(1).map((p, i) => p - ps[i]) };
};

export function factsOf(l: LickEntry): Facts {
  const notes = parseNotes(l.notes);
  const length = spanOf(notes);
  const all = notes.flatMap((n) => (n.dyad !== undefined ? [n.semi, n.semi - n.dyad] : [n.semi]));
  const tags = shapeTags(shapeOf(l, notes));
  const last = landing(notes[notes.length - 1]);
  return {
    length, count: notes.length, perBeat: (notes.length * 4) / length,
    range: Math.max(...all) - Math.min(...all),
    contour: tags.contour, maxLeap: tags.maxLeap,
    techniques: techniques(notes),
    starts: DEGREE[mod(notes[0].semi, 12)], ends: DEGREE[mod(last, 12)],
    strongEnd: [0, 3, 4, 7].includes(mod(last, 12)),
    offBeat: notes[0].pos % 4 !== 0,
    outNotes: notes.filter((n) => n.out).length,
  };
}

export interface Guess { role: Role[]; genres: string[]; moods: string[]; energy: number }

/**
 * A first guess at what Paul marks, from the notes and the player: shown greyed in the lab until he keeps or
 * changes it. Rough on purpose; it only saves typing.
 */
export function guessOf(l: LickEntry): Guess {
  const notes = parseNotes(l.notes);
  const f = factsOf(l);
  const first = notes[0].semi, last = landing(notes[notes.length - 1]);
  const bigBend = notes.some((n) => (n.bend ?? 0) >= 3 || (n.rake && n.bend));
  // the job: a climb or a fall when it's quick, a peak for the big bends and screams, short ones fill
  const role: Role[] = [];
  if (l.speed === 'fast' && last - first >= 5) role.push('ramp');
  else if (bigBend || (notes[0].bend && first >= 12)) role.push('peak');
  else if (f.length <= 8) role.push('fill');
  else if (l.speed === 'fast') role.push('build');
  else if (last < first - 2 && notes[notes.length - 1].len >= 6) role.push('release');
  else role.push('phrase');
  if (f.strongEnd && notes[notes.length - 1].len >= 6 && !role.includes('release') && !role.includes('ramp')) role.push('ending');
  // the genres where the lick's players are at home (weight 2 or more in the lead player picks)
  const kinds: Record<LickKind, string> = { sung: 'melodic', blues: 'bluesy', run: 'shredder', simple: 'raw', muted: 'funky' };
  const genres = Object.entries(BY_GENRE)
    .filter(([, ps]) => ps.some(([k, w]) => l.who.some((who) => kinds[who] === k) && w >= 2))
    .map(([g]) => g);
  // the moods whose interval taste (the vocal's table) likes its moves best
  const shape = shapeOf(l, notes);
  const moods = notes.length < 2 ? [] : MOODS.map((m) => ({ m, fit: moodFit(shape, m) }))
    .sort((a, b) => b.fit - a.fit).filter((x, i) => i < 2 && x.fit > 1).map((x) => x.m);
  const energy = Math.min(5, { slow: 2, mid: 3, fast: 4 }[l.speed] + (bigBend || notes.some((n) => n.tremolo || n.rake) ? 1 : 0));
  return { role, genres, moods, energy };
}

/* ---- tab */

/** Standard tuning, low E first. */
export const OPEN = [40, 45, 50, 55, 59, 64];
export const MAX_FRET = 22;

/** A note on the neck: `str` 1 (high E) to 6 (low E); a double-stop's lower note on `lowStr`. */
export interface Fingered { str: number; fret: number; lowStr?: number; lowFret?: number }

/** The fretted notes (before a bend): the top note, and the lower one of a double-stop (the bend is on it). */
export function fretted(n: LibNote, base: number): { top: number; low?: number } {
  if (n.dyad === undefined) return { top: base + n.semi - lift(n) };
  return { top: base + n.semi, low: base + n.semi - n.dyad - (n.bend || n.unbend || 0) };
}

/** How far the fretted note is under the note written (a bend or a pre-bend; a double-stop's bend is on its lower note). */
export const lift = (n: LibNote) => (n.dyad !== undefined ? 0 : n.bend || n.unbend || 0);

/** The root the tab is drawn over: the key's note from E3 up (so the licks sit around the 5th-17th frets). */
export const tabRoot = (key: number) => 52 + mod(key - 4, 12);

function place(n: LibNote, base: number, str: number): Fingered | null {
  const s = 6 - str;
  const f = fretted(n, base);
  const fret = f.top - OPEN[s];
  if (fret < 0 || fret > MAX_FRET) return null;
  if (f.low === undefined) return { str, fret };
  const ls = s - (n.dyad! >= 8 ? 2 : 1);
  if (ls < 0) return null;
  const lowFret = f.low - OPEN[ls];
  if (lowFret < 0 || lowFret > MAX_FRET || Math.abs(lowFret - fret) > 5) return null;
  return { str, fret, lowStr: 6 - ls, lowFret };
}

/**
 * The lick fingered over `root`: the strings it was written on where it has them (`@N`), otherwise the path
 * with the least hand movement (staying in one position, a slide or a hammer on the same string). Moved an
 * octave if it doesn't fit the neck (`prefer`: the octave to try first, so an edit doesn't make the tab jump). Null
 * if it can't be fingered at all.
 */
export function finger(notes: LibNote[], root: number, prefer?: number): { base: number; at: Fingered[] } | null {
  for (const base of [...(prefer === undefined ? [] : [prefer]), root, root + 12, root - 12, root + 24]) {
    const at = notes.every((n) => n.str) ? notes.map((n) => place(n, base, n.str!)) : path(notes, base);
    if (at && at.every((x) => x)) return { base, at: at as Fingered[] };
  }
  return null;
}

function path(notes: LibNote[], base: number): (Fingered | null)[] | null {
  const opts = notes.map((n) => (n.str ? [place(n, base, n.str)] : [1, 2, 3, 4, 5, 6].map((s) => place(n, base, s))).filter((x): x is Fingered => !!x));
  if (opts.some((o) => !o.length)) return null;
  // cheapest path through the options: hand moves past a 4-fret stretch cost the most
  let cost = opts[0].map((o) => Math.abs(o.fret - 8) * 0.15 + (o.fret === 0 ? 1 : 0));
  const back: number[][] = [];
  for (let i = 1; i < opts.length; i++) {
    const n = notes[i];
    const next = opts[i].map((o) => {
      let best = Infinity, bi = 0;
      opts[i - 1].forEach((p, j) => {
        const d = Math.abs(o.fret - p.fret);
        let c = cost[j] + Math.max(0, d - 3) * 2 + d * 0.3 + Math.abs(o.str - p.str) * 0.2 + (o.fret === 0 ? 1 : 0);
        if ((n.art === 'slide' || n.art === 'legato') && o.str !== p.str) c += 1.5;
        if (c < best) { best = c; bi = j; }
      });
      return [best, bi];
    });
    back.push(next.map((x) => x[1]));
    cost = next.map((x) => x[0]);
  }
  let k = cost.indexOf(Math.min(...cost));
  const out: Fingered[] = [opts[opts.length - 1][k]];
  for (let i = opts.length - 2; i >= 0; i--) { k = back[i][k]; out.unshift(opts[i][k]); }
  return out;
}

/** A note from the tab: string and fret (as fretted, before the bend) to its sounding note over the root. */
export function semiFromTab(str: number, fret: number, base: number, bend = 0): number {
  return OPEN[6 - str] + fret + bend - base;
}
