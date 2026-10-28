// The lead players' lick vocabularies (research: docs/LEAD.md, "Each player's style"): what a melodic
// player, a shredder, a raw grunge player, a funk player and a blues player actually play, written over
// the chord (so a lick fits wherever it's put), with the techniques that make each one sound like them:
// big and unison bends, bends let down again, pre-bends, double-stops (sixths, fourths, thirds,
// octaves), trills, tremolo picking, rakes, muted ghost notes.
// A lick is moved to the chord under it, put in the register near the last note played, and has to
// fit: every note in the key (or a chord note, or a passing note the lick means), held notes that
// don't rub against the chord, nothing clashing with the riff, the last note a chord note. Licks are
// also cut down (their first notes left off) to fit a gap, so the same lick doesn't always come out
// the same.
// The licks themselves are data: src/recipes/licks.json, edited in the recipe lab (docs/RECIPE-LAB.md).

import type { ChordPart, GuitarHit, Song } from '../idea';
import type { LickKind } from '../players/lead';
import type { Rng } from '../rng';
import { type Chord, QUALITIES, SCALES, chordPc } from '../theory';
import type { Tuning } from '../theory/fretboard';
import { chordTones, leadFret } from './guitar2';
import licksFile from '../recipes/licks.json';
import { type LibNote, type LickFile, type Speed, parseNotes, spanOf } from '../recipes/library';

const mod = (n: number, m: number) => ((n % m) + m) % m;

export type { LibNote, Speed } from '../recipes/library';

export interface LibLick {
  who: LickKind[];
  speed: Speed;
  /** Over minor chords, major chords, or either. */
  q: 'min' | 'maj' | 'any';
  /** Where it comes from (for the notes). */
  name: string;
  notes: LibNote[];
  span: number;
}

/** The named licks the app plays: the live ones in src/recipes/licks.json (edited in the recipe lab, docs/RECIPE-LAB.md), in file order. */
export const LIBRARY: LibLick[] = (licksFile as LickFile).licks.filter((l) => l.status === 'live').map((l) => {
  const notes = parseNotes(l.notes);
  return { who: l.who, speed: l.speed, q: l.q, name: l.name, notes, span: spanOf(notes) };
});

/** The chances, by player, of a rake into a lick's first bent note, and of using a lick from the library at all. */
export const LICK_HABITS: Record<LickKind, { rake: number; verse: number }> = {
  sung: { rake: 0.2, verse: 0.45 },
  blues: { rake: 0.3, verse: 0.35 },
  run: { rake: 0.1, verse: 0.7 },
  simple: { rake: 0.1, verse: 0.55 },
  muted: { rake: 0.05, verse: 0.7 },
};

/** A placed lick note, with everything it takes to play it. */
export interface PlacedNote {
  step: number;
  midi: number;
  len: number;
  vel: number;
  bend: number;
  unbend?: number;
  lateBend?: number;
  /** The bend let down or pushed up at this many 16ths into the note (unset: the usual time). */
  bendAt?: number;
  art?: 'pick' | 'legato' | 'slide';
  dyad?: number;
  trill?: number;
  tremolo?: boolean;
  rake?: number;
  dead?: boolean;
  vib?: number;
  /** The lead's extra sounds, as the library marks them (docs/GUITAR-SOUNDS.md). */
  harm?: 'pinch' | 'natural';
  dive?: number;
  feedback?: number;
  scrape?: number;
}

/** What a lick has to fit: the key, the chords and the riff. */
export interface LickFit {
  inKey: (m: number) => boolean;
  chordAt: (g: number) => Chord;
  isTone: (m: number, g: number) => boolean;
  /** A held note that rubs (a semitone from a chord note, or the flat 5th). */
  rubs: (m: number, g: number) => boolean;
  clash: (m: number, g: number) => boolean;
}

export function lickFit(song: Song, chords: ChordPart, riff: GuitarHit[] | null): LickFit {
  const { key, mode, total } = song;
  const chordAt = (g: number) => chords.timeline[chords.chordIdx[Math.min(Math.max(0, g), total - 1)]].chord;
  const isTone = (m: number, g: number) => chordTones(key, chordAt(g)).includes(mod(m, 12));
  return {
    inKey: (m) => (SCALES[mode] as readonly number[]).includes(mod(m - key, 12)),
    chordAt,
    isTone,
    rubs: (m, g) => !isTone(m, g)
      && (chordTones(key, chordAt(g)).some((c) => [1, 11].includes(mod(m - c, 12))) || mod(m - chordPc(key, chordAt(g)), 12) === 6),
    clash: (m, g) => (riff ?? []).some((h) => h.step <= g && g < h.step + h.len && h.mute !== 'dead'
      && h.notes.some((n) => [1, 11].includes(mod(m - n, 12)))),
  };
}

const minorChord = (c: Chord) => (QUALITIES[c.q] as readonly number[]).includes(3) && !(QUALITIES[c.q] as readonly number[]).includes(4);
const majorChord = (c: Chord) => (QUALITIES[c.q] as readonly number[]).includes(4);

/** Licks a player plays at a speed (or any speed), that suit the chord at `g`. */
export function licksFor(who: LickKind, speed: Speed | null, chord: Chord, maxSpan = Infinity): LibLick[] {
  return LIBRARY.filter((l) => l.who.includes(who) && (!speed || l.speed === speed) && l.span <= maxSpan
    && (l.q === 'any' || (l.q === 'min' ? minorChord(chord) : majorChord(chord))));
}

/**
 * A lick placed to end at `end` (its last note held to there), over the chord at its first note, in
 * [lo, hi], starting near `prev`. `close`: the last note on the root (home), on another chord note
 * (open), or any chord note. `from`: notes before this are left off (a lick cut down to fit). Null if
 * it doesn't fit anywhere.
 */
export function placeLibLick(
  rng: Rng, fit: LickFit, key: number, l: LibLick, end: number, lo: number, hi: number, prev: number,
  close: 'home' | 'open' | 'any', who: LickKind, vel: number, from = 0,
): PlacedNote[] | null {
  const notes = l.notes.slice(from);
  if (!notes.length) return null;
  const p0 = notes[0].pos;
  const span = l.span - p0;
  let at = end - span;
  at -= mod(at, 2);
  if (at < 0) return null;
  const step = (n: LibNote) => at + n.pos - p0;
  const root = chordPc(key, fit.chordAt(at));
  let best: { base: number; score: number } | null = null;
  for (let base = root + 12 * Math.floor((lo - 24) / 12); base <= hi; base += 12) {
    const ms = notes.map((n) => base + n.semi);
    if (ms.some((m, i) => m > hi || m - (notes[i].dyad ?? 0) < lo - 7 || m < lo - 2)) continue;
    const ok = notes.every((n, i) => {
      const g = step(n), m = ms[i];
      const notesHere = n.dyad !== undefined ? [m, m - n.dyad] : [m];
      if (notesHere.some((x) => fit.clash(x, g))) return false;
      if (!n.out && !n.dead && notesHere.some((x) => !fit.inKey(x) && !fit.isTone(x, g))) return false;
      // a held note, as it ends up (after a bend let down), mustn't rub
      if (n.len >= 4 && !n.tremolo && !n.trill && fit.rubs(m - (n.unbend ?? 0), g)) return false;
      return true;
    });
    if (!ok) continue;
    const last = notes[notes.length - 1], lm = ms[ms.length - 1] - (last.unbend ?? 0), lg = step(last);
    if (!fit.isTone(lm, lg)) continue;
    if (close === 'home' && mod(lm, 12) !== chordPc(key, fit.chordAt(lg)) && rng.chance(0.6)) continue;
    if (close === 'open' && mod(lm, 12) === chordPc(key, fit.chordAt(lg)) && rng.chance(0.6)) continue;
    const score = Math.abs(ms[0] - prev);
    if (!best || score < best.score) best = { base, score };
  }
  if (!best) return null;
  const hab = LICK_HABITS[who];
  let raked = false;
  return notes.map((n, i) => {
    const last = i === notes.length - 1;
    const len = last ? Math.max(n.len, end - step(n)) : n.len;
    // a rake into the first bent note now and then (or where the lick asks for one)
    const rake = n.rake || (!raked && !!n.bend && n.bend >= 2 && rng.chance(hab.rake)) ? rng.int(2, 3) : undefined;
    if (rake) raked = true;
    return {
      step: step(n), midi: best!.base + n.semi, len, vel: n.dead ? 0.55 : vel + (i === 0 ? 0.04 : 0) + (rng.next() - 0.5) * 0.05,
      bend: n.bend ?? 0, unbend: n.unbend, art: n.art ?? (i === 0 ? 'pick' : undefined), dyad: n.dyad, trill: n.trill,
      tremolo: n.tremolo, rake, dead: n.dead, vib: n.vib && len >= 4 ? 24 : undefined,
      harm: n.harm, dive: n.dive, feedback: n.feedback, scrape: n.scrape,
    };
  });
}

/** A placed note as Guitar 2 plays it: a double-stop on two neighbouring strings (a sixth or an octave skips one). */
export function placedHit(e: PlacedNote, t: Tuning, pos: number, clean?: boolean): GuitarHit {
  const f = leadFret(e.midi, t, pos);
  const extra = {
    bend: e.bend, unbend: e.unbend, lateBend: e.lateBend, bendAt: e.bendAt, art: e.art, trill: e.trill, tremolo: e.tremolo, rake: e.rake, vib: e.vib,
    harm: e.harm, dive: e.dive, feedback: e.feedback, scrape: e.scrape,
    mute: e.dead ? ('dead' as const) : undefined, clean,
  };
  if (e.dyad === undefined) return { step: e.step, ...f, len: e.len, vel: e.vel, ...extra };
  const low = e.midi - e.dyad;
  let top = f.strings[0];
  const skip = e.dyad >= 8 ? 2 : 1;
  // the lower note on a lower string, both within reach
  for (const s of [top, top + 1, top - 1, top + 2]) {
    const ls = s - skip;
    if (s > 5 || ls < 0) continue;
    const ft = e.midi - t.strings[s], fl = low - t.strings[ls];
    if (ft >= 0 && fl >= 0 && ft <= 20 && fl <= 20 && Math.abs(ft - fl) <= 4) { top = s; break; }
  }
  const ls = Math.max(0, top - skip);
  return { step: e.step, notes: [low, e.midi], strings: [ls, top], len: e.len, vel: e.vel, ...extra };
}
