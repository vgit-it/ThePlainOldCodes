// What the singer still takes from the old Guide line (experiment, docs/ARCHIVE.md): the note and line types, the scales,
// the height of each section, and the numbers for lead-ins and breaths. The Guide line's own writers (this file's
// writeGuide, anchor.ts, real.ts, dynamics.ts) were removed in the clean-up; they are in git (docs/ARCHIVE.md).

import type { SectionKind } from '../idea';
import type { Genre } from '../genres';
import type { Mood } from '../tension';
import { SCALES } from '../theory';

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** A quick note on a held one: `at` steps into it, `len` steps long (an 8th), then back. */
export interface Flick {
  at: number; len: number; midi: number;
  /** A 16th's silence (in steps) after it before the held note comes back (the quick note then a 16th itself). */
  gap?: number;
  /** Pitch by words: a new stressed word (true, going up) or a word's soft last syllable (false, going down). */
  starts?: boolean;
  /** At the held note's end: bent up (or down) to, and the line moves on from there. */
  bend?: boolean;
}


export interface GuideNote {
  /** Step in its section, length in steps, the note, and its scale degree (0 home, 1 the 2nd ... any octave). */
  step: number; len: number; midi: number; deg: number;
  /** Out of the key (a mood's colour note). */
  colour?: boolean;
  /** A leap after a pause. */
  leap?: boolean;
  /** Bent into from the note before (no new attack): the bend's length in steps (an 8th, a quarter, half a bar). */
  bend?: number;
  /** Quick notes on it. */
  flicks?: Flick[];
  /** Pushes and pulls on it: `at` steps in. */
  marks?: Mark[];
  /** The Vocal tune's Bends (tune.ts): a scoop up into it from so many semitones below, a fall off its end by so many (the vocal's own). */
  slide?: number;
  fall?: number;
  /** The Vocal tune's Bends: bent into from the note before, but a new word (a slide into the next word, not a word carried on). */
  newWord?: boolean;
}

/** A push (a lift, like a word starting) or a pull (a dip, like a word ending) inside a held note. */
/** A push or a pull on a held note. A pull falls away to silence, the note back on the next beat (`back` steps after `at`; at the note's end, not back). */

export interface Mark { at: number; kind: 'push' | 'pull'; back?: number }

/**
 * What the vocal tune (tune.ts) is asked to do; the singer uses `tune`, `feel`, `carry` and `bends`.
 * (The other switches belonged to the removed Guide writers.)
 */
export interface GuideIdeas {
  /** Vocal tune (tune.ts): the main vocal's own tune and words, as the vocal row writes them. */
  tune?: boolean;
  /** Vocal tune, Bends (tune.ts): Some: glides inside a word and the vocal's own scoops and falls; More: also slides out of a held note into the next word. */
  bends?: 'some' | 'more';
  /** Human feel (feel.ts, docs/GUIDE-FEEL.md): how the line is played and sung (glides, scoops, swells, fades, falls, vibrato, breaths); the written line unchanged. */
  feel?: boolean;
  /** Carry over: now and then the last note runs on into a section the line sits out (a solo), held or bent. */
  carry?: boolean;
  /** Breaths: a pause after a tiring stretch (long, or high) and before a big section. */
  breath?: boolean;
  /** Lead-ins: now and then the next section's first note comes in before the section starts, held into it. */
  leadIn?: boolean;
}

/** Breaths: how tiring the stretch just sung is (bars, a high note counting more), from which a breath is likely. */
export const TIRED = 2.5;
/** Lead-ins: how often, and how early (steps before the section: an 8th, a beat, two beats). */
export const LEAD_IN_P = 0.35;
export const LEAD_INS: [number, number][] = [[2, 0.3], [4, 0.45], [8, 0.25]];

/**
 * How often a quick note starts a new word (else it ends one), by genre: a little more in busier genres
 * (words.ts; with Pitch by words, how often quick notes go up).
 */
export const WORD_STARTS: Record<Genre, number> = { funk: 0.6, hardrock: 0.55, rock: 0.5, pop: 0.5, metal: 0.5, altmetal: 0.5, grunge: 0.4 };

export interface GuideLine {
  /** Notes per section, in play order. */
  parts: GuideNote[][];
  /** Sections the line sits out (intros, solos, and some interludes, bridges, breakdowns and outros). */
  silent: boolean[];
  mood: Mood;
  /** What it did, in plain words. */
  notes: string[];
}


export const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = (m: number) => `${NAMES[mod(m, 12)]}${Math.floor(m / 12) - 1}`;

/** A high voice's top, written an octave under where it's sung (the woman's voice sings the line back up an octave, voice.ts). */
export const DOWN = 12;
/** A range set by hand (Paul, to see how far it stretches): its lowest and highest notes, MIDI; at least an octave apart (narrower, the home note can fall outside it). */
export type GuideRange = [number, number];

/**
 * The line's own key and scale (Paul: "see if I can get away with a different scale for the vocals"): the
 * scales it can be written in (seven notes each, so steps, quick notes and homes work as in the song's).
 */
export const GUIDE_SCALES = {
  ...SCALES,
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  melodic: [0, 2, 3, 5, 7, 9, 11],
} as const satisfies Record<string, readonly number[]>;
export type GuideScale = keyof typeof GUIDE_SCALES;

/**
 * Height by section, not wandering (Paul: a narrow range "without making it too monotonous"): where each kind of
 * section sits in the voice (0 its bottom, 1 its top), moved by the tension and the mood's lean; a pre-chorus climbs
 * through itself. Within a phrase the line keeps near that height: the mood's span sets how many scale notes either side.
 */
export const HEIGHT: Partial<Record<SectionKind, number>> = { intro: 0.3, verse: 0.25, prechorus: 0.35, chorus: 0.7, interlude: 0.4, bridge: 0.55, breakdown: 0.25, solo: 0.5, outro: 0.4 };
