// Reads the solo's chords as a story (docs/SOLO-HARMONY.md, step 1). No notes are written here.
// Every chord gets a part in the plot: home (the tonic), rest (a calm place off home: vi, bIII), away (IV, ii, iv),
// tense (V, vii, bII, a dominant 7th or a suspended chord: it wants to move), lift (a borrowed bright chord in a major key:
// bVI, bVII, bIII). Each has a pull (0-1: how much it wants to go somewhere). An arrival is home reached from a chord with a
// pull; a twist is a tense chord that goes somewhere other than home. The map also says whether the section's chords loop
// (and how long the loop is), and whether it ends open (on a chord that is waiting).
// Pure: the same chords give the same map.

import type { Chord, Mode } from '../theory';
import { MINORISH } from './guitar2';

export type HarmonyRole = 'home' | 'rest' | 'away' | 'tense' | 'lift';

export interface HarmonyBeat {
  /** First step of the chord, and its length in steps (to the next different chord, or the section's end). */
  step: number;
  len: number;
  chord: Chord;
  role: HarmonyRole;
  /** How much the chord wants to move on (0 at home, near 1 on a dominant). */
  pull: number;
  /** Home reached from a chord with a pull: the size of that pull (0 when it is not an arrival). */
  arrival: number;
  /** A tense chord that does not go home (the surprise). */
  twist: boolean;
}

export interface HarmonyMap {
  beats: HarmonyBeat[];
  /** The length of the repeating chord loop in steps (0 when the chords do not loop), and how many times it plays. */
  loop: number;
  loops: number;
  /** The last chord is waiting (a pull of .5 or more): the section ends on a question. */
  endsOpen: boolean;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** The pull of each degree (semitones over the key), in a major-ish and a minor-ish key. */
const PULL_MAJOR = [0, 0.8, 0.5, 0.5, 0.35, 0.45, 0.7, 0.9, 0.5, 0.3, 0.55, 0.9];
const PULL_MINOR = [0, 0.8, 0.7, 0.2, 0.3, 0.45, 0.7, 0.6, 0.35, 0.3, 0.5, 0.9];

/** The pull of a chord in a key: by its degree, then its quality (a dominant 7th, a suspended chord or a diminished one pulls more). */
export function pullOf(c: Chord, mode: Mode): number {
  const minor = MINORISH.includes(mode);
  let p = (minor ? PULL_MINOR : PULL_MAJOR)[((c.root % 12) + 12) % 12];
  // (the major V in a minor key is the strong pull home, the minor v the weak one)
  if (minor && c.root === 7 && (c.q === 'maj' || c.q === '7' || c.q === '9' || c.q === '5')) p = c.q === '5' ? 0.75 : 0.95;
  if (c.q === '7' || c.q === '9' || c.q === '7#9') p += c.root === 0 ? 0.2 : 0.1;
  if (c.q === 'sus4' || c.q === 'sus2') p += c.root === 0 ? 0.2 : 0.1;
  if (c.q === 'dim' || c.q === 'm7b5') p += 0.15;
  return clamp01(p);
}

export function roleOf(c: Chord, mode: Mode, pull = pullOf(c, mode)): HarmonyRole {
  if (c.root === 0 && pull < 0.3) return 'home';
  const minor = MINORISH.includes(mode);
  // (borrowed bright chords in a major key: bIII, bVI, bVII)
  if (!minor && (c.root === 3 || c.root === 8 || c.root === 10) && pull < 0.6) return 'lift';
  if (pull >= 0.6) return 'tense';
  if (pull >= 0.4) return 'away';
  return pull < 0.15 ? 'home' : 'rest';
}

const same = (a: Chord, b: Chord) => a.root === b.root && a.q === b.q;

/** The shortest chord loop (in steps) the timeline repeats, 0 if it does not repeat at least one and a half times. */
function loopOf(events: { step: number; chord: Chord }[], total: number): number {
  const at = (g: number) => { let c = events[0].chord; for (const e of events) if (e.step <= g) c = e.chord; else break; return c; };
  const cuts = events.map((e) => e.step).filter((s) => s > 0);
  for (const p of cuts) {
    if (p * 1.5 > total) break;
    // every change point of the whole timeline sounds the same one loop on
    let ok = true;
    for (let g = 0; g + p < total && ok; g += 4) if (!same(at(g), at(g + p))) ok = false;
    if (ok) return p;
  }
  return 0;
}

/** Reads the chords of a section (`events` are its chord changes, `total` the steps) and its mode. */
export function readHarmony(events: { step: number; chord: Chord }[], total: number, mode: Mode): HarmonyMap {
  // (a chord played again straight away is one chord)
  const merged: { step: number; chord: Chord }[] = [];
  for (const e of [...events].sort((a, b) => a.step - b.step)) if (!merged.length || !same(merged[merged.length - 1].chord, e.chord)) merged.push({ step: e.step, chord: e.chord });
  const beats: HarmonyBeat[] = merged.map((e, i) => {
    const pull = pullOf(e.chord, mode);
    return { step: e.step, len: (merged[i + 1]?.step ?? total) - e.step, chord: e.chord, role: roleOf(e.chord, mode, pull), pull, arrival: 0, twist: false };
  });
  beats.forEach((b, i) => {
    const prev = beats[i - 1];
    if (!prev) return;
    if (b.role === 'home' && prev.pull >= 0.3) b.arrival = prev.pull;
    if (prev.role === 'tense' && b.role !== 'home') b.twist = true;
  });
  const loop = merged.length ? loopOf(merged, total) : 0;
  const last = beats[beats.length - 1];
  return { beats, loop, loops: loop ? Math.round((10 * total) / loop) / 10 : 1, endsOpen: !!last && last.pull >= 0.5 };
}

/** The chord sounding at a step. */
export const beatAt = (m: HarmonyMap, g: number): HarmonyBeat => {
  let r = m.beats[0];
  for (const b of m.beats) if (b.step <= g) r = b; else break;
  return r;
};

const ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

/** One line for the card: `I home → vi rest → IV away → V tense ⇒ I arrives`. */
export function harmonyLine(m: HarmonyMap): string {
  const name = (b: HarmonyBeat) => {
    const minorQ = ['min', 'm7', 'm9', 'dim', 'm7b5'].includes(b.chord.q);
    const r = ROMAN[b.chord.root % 12];
    return `${minorQ ? r.toLowerCase() : r}${b.chord.q === '5' ? '5' : ''}`;
  };
  const parts = m.beats.map((b) => `${name(b)} ${b.arrival ? 'arrives' : b.twist ? 'twist' : b.role}`);
  // (a loop shows once)
  const shown = m.loop ? m.beats.filter((b) => b.step < m.loop).map((b) => parts[m.beats.indexOf(b)]) : parts.slice(0, 12);
  return `${shown.join(' → ')}${m.loop ? ` (loops ${m.loops}x)` : parts.length > 12 ? ' …' : ''}${m.endsOpen ? ', ends open' : ''}`;
}
