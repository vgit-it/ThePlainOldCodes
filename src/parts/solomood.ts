// The mood of a Tune first solo (docs/SOLO-MOOD.md): what each mood does to the melody, as one table the writer reads.
// The vocal's interval table (src/verse/intervals.ts) says how much a mood likes each interval; this adds the rest of the character:
// how often the line jumps (and which way), how quick or slow it is and how it changes pace, how high it sits, what colour notes it
// leans on (the 9th, the 6th, the flat 2nd), how rough it may be, how it ends a phrase. The same table gives the aims the mood-aware
// tune score checks against (src/parts/solotune.ts, TuneAim).

import type { Mood } from '../tension';
import type { TuneAim } from './solotune';

export type Contour = 'rise' | 'fall' | 'arch' | 'dip' | 'level';

export interface SoloMood {
  /** How much the mood's interval table counts against the rest of a note's cost (1 = the vocal's weight). */
  weight: number;
  /** The share of cell starts and cadences that jump (5+ semitones), and the share of jumps that go up. */
  leap: number; jumpUp: number;
  /** A jump into the held note instead of a run of steps. */
  cadLeap: number;
  /** -1 slow, 1 quick: the feel of the rhythm; the chance a cell flips it (quick then slow, slow then quick); the chance of a change inside a cell. */
  quick: number; contrast: number; shift: number;
  /** Semitones the whole solo sits higher (+) or lower (-). */
  height: number;
  /** Times the length of the held note that ends a phrase. */
  hold: number;
  /** How willing the line is to repeat a note (0-1), and times the chance an answer plays its call's cells again. */
  repeatNote: number; answers: number;
  /** Colour notes: semitones above the chord's root, and how much the mood likes each on a held or weak note (0-1). */
  colour: Record<number, number>;
  /** The chance an open ending (a call) lands on a colour note. */
  colourGoal: number;
  /** How rough the line may be: 0 avoids the notes that rub the chord, 1 does not mind. */
  rough: number;
  /** The contours a phrase takes, by its role. */
  call: [Contour, number][]; answer: [Contour, number][];
}

export const SOLO_MOOD: Record<Mood, SoloMood> = {
  happy: {
    weight: 1, leap: 0.25, jumpUp: 0.6, cadLeap: 0.2, quick: 0.3, contrast: 0.35, shift: 0.25, height: 1, hold: 0.9, repeatNote: 0.3, answers: 1.2,
    colour: { 9: 0.8, 2: 0.5, 11: 0.4 }, colourGoal: 0.15, rough: 0, call: [['rise', 5], ['arch', 5]], answer: [['fall', 5], ['arch', 5]],
  },
  melancholic: {
    weight: 1.1, leap: 0.14, jumpUp: 0.25, cadLeap: 0.12, quick: -0.6, contrast: 0.25, shift: 0.3, height: -2, hold: 1.3, repeatNote: 0.4, answers: 1,
    colour: { 2: 1, 10: 0.9, 9: 0.6, 11: 0.4 }, colourGoal: 0.35, rough: 0.1, call: [['arch', 5], ['fall', 5]], answer: [['fall', 8], ['dip', 2]],
  },
  nostalgic: {
    weight: 1, leap: 0.2, jumpUp: 0.45, cadLeap: 0.15, quick: -0.3, contrast: 0.3, shift: 0.3, height: 0, hold: 1.15, repeatNote: 0.35, answers: 1.1,
    colour: { 9: 1, 2: 0.7, 10: 0.4 }, colourGoal: 0.3, rough: 0.1, call: [['arch', 6], ['rise', 4]], answer: [['fall', 6], ['arch', 4]],
  },
  tense: {
    weight: 1.1, leap: 0.4, jumpUp: 0.6, cadLeap: 0.35, quick: 0.5, contrast: 0.5, shift: 0.4, height: 1, hold: 0.8, repeatNote: 0.8, answers: 0.9,
    colour: { 1: 0.8, 6: 0.8, 11: 0.5, 10: 0.5 }, colourGoal: 0.4, rough: 1, call: [['rise', 5], ['level', 5]], answer: [['level', 4], ['fall', 3], ['arch', 3]],
  },
  angry: {
    weight: 1.1, leap: 0.45, jumpUp: 0.5, cadLeap: 0.4, quick: 0.7, contrast: 0.45, shift: 0.35, height: 0, hold: 0.8, repeatNote: 1, answers: 1.3,
    colour: { 1: 0.5, 6: 0.6, 10: 0.6 }, colourGoal: 0.25, rough: 0.6, call: [['level', 4], ['rise', 4], ['arch', 2]], answer: [['fall', 5], ['level', 5]],
  },
  dreamy: {
    weight: 1, leap: 0.3, jumpUp: 0.55, cadLeap: 0.3, quick: -0.4, contrast: 0.4, shift: 0.35, height: 1, hold: 1.3, repeatNote: 0.2, answers: 1.2,
    colour: { 2: 1, 11: 0.9, 9: 0.7, 10: 0.4 }, colourGoal: 0.4, rough: 0.2, call: [['arch', 6], ['rise', 4]], answer: [['arch', 5], ['fall', 5]],
  },
  triumphant: {
    weight: 1, leap: 0.4, jumpUp: 0.8, cadLeap: 0.5, quick: 0.2, contrast: 0.4, shift: 0.5, height: 2, hold: 1, repeatNote: 0.2, answers: 1.1,
    colour: { 9: 0.7, 2: 0.4 }, colourGoal: 0.1, rough: 0, call: [['rise', 7], ['arch', 3]], answer: [['arch', 5], ['fall', 5]],
  },
  dark: {
    weight: 1.1, leap: 0.25, jumpUp: 0.25, cadLeap: 0.3, quick: -0.3, contrast: 0.3, shift: 0.3, height: -3, hold: 1.2, repeatNote: 0.5, answers: 1,
    colour: { 1: 0.9, 10: 0.7, 6: 0.5, 2: 0.4 }, colourGoal: 0.35, rough: 0.6, call: [['fall', 4], ['arch', 3], ['level', 3]], answer: [['fall', 7], ['dip', 3]],
  },
};

type Band = [number, number, number, number];
/** What the mood-aware tune score wants of each mood: the shares of steps, jumps and quick notes (a band: zero below the first, full between the middle two). */
const AIMS: Record<Mood, { steps: Band; leaps: Band; quick: Band; fill: number; sameMax: number }> = {
  happy:       { steps: [0.15, 0.35, 0.65, 0.9], leaps: [0, 0.05, 0.25, 0.45], quick: [0.1, 0.2, 0.5, 0.75], fill: 0.8, sameMax: 0.08 },
  melancholic: { steps: [0.3, 0.5, 0.85, 1], leaps: [0, 0, 0.12, 0.3], quick: [0, 0.05, 0.28, 0.5], fill: 0.9, sameMax: 0.1 },
  nostalgic:   { steps: [0.2, 0.4, 0.75, 0.95], leaps: [0, 0.02, 0.18, 0.35], quick: [0, 0.08, 0.35, 0.6], fill: 0.9, sameMax: 0.08 },
  tense:       { steps: [0.05, 0.2, 0.6, 0.85], leaps: [0.05, 0.15, 0.4, 0.6], quick: [0.2, 0.35, 0.7, 0.9], fill: 0.5, sameMax: 0.2 },
  angry:       { steps: [0, 0.1, 0.5, 0.8], leaps: [0.1, 0.2, 0.45, 0.65], quick: [0.25, 0.4, 0.75, 0.95], fill: 0.6, sameMax: 0.3 },
  dreamy:      { steps: [0.1, 0.3, 0.7, 0.95], leaps: [0, 0.08, 0.3, 0.5], quick: [0, 0.05, 0.32, 0.55], fill: 0.5, sameMax: 0.06 },
  triumphant:  { steps: [0.05, 0.2, 0.6, 0.85], leaps: [0.08, 0.18, 0.42, 0.6], quick: [0.05, 0.15, 0.5, 0.75], fill: 0.75, sameMax: 0.06 },
  dark:        { steps: [0.2, 0.4, 0.8, 1], leaps: [0, 0.03, 0.2, 0.4], quick: [0, 0.05, 0.3, 0.55], fill: 0.8, sameMax: 0.12 },
};

/** The aims of a mood for the tune score; `w` is the mood's interval table. */
export const aimFor = (mood: Mood, w: readonly number[]): TuneAim => ({ ...AIMS[mood], w });
