// The solo player's intention for a long note (docs/SOLO-PLAYER.md, section 15): is the note held (stay), played around and come back to
// (return), played as a climb toward the next note (bridge), or struck again and again (flurry). A long note is held as it is mostly to slow
// things down or to push its mood (a peak, a landing, a sad or dreamy moment, a quiet one): the hold share is a dial by mood, energy, the
// drums and the place of the note, then the player's own density.

import type { Mood } from '../tension';
import type { Intent } from './solofigure';
import type { Person } from './soloperson';

/** The share of long notes a mood holds as they are, at middling energy. */
const MOOD_HOLD: Record<Mood, number> = { dreamy: 0.3, melancholic: 0.28, nostalgic: 0.23, dark: 0.2, tense: 0.14, happy: 0.14, triumphant: 0.12, angry: 0.08 };

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export interface IntentAsk {
  mood: Mood;
  /** The energy at the note, 0 to 1. */
  e01: number;
  /** The strength (0 to 1) of a read tag on the note. */
  tag: (id: string) => number;
  person: Person;
  /** Whether a bridge to the next note is possible at all. */
  canBridge: boolean;
  /** How well the best flurry rule fits (0: none can be played here). */
  flurryFit: number;
}

/** How likely the note is held as it is (0.08 to 0.9): 12% to 45% by mood and energy, most of the time on a peak or a final landing. */
export function holdShare(a: IntentAsk): number {
  const { tag } = a;
  let h = MOOD_HOLD[a.mood] * (1 - 0.8 * (a.e01 - 0.5));
  h *= clamp(1.25 - 0.6 * a.person.density, 0.8, 1.2);
  h *= 1 - 0.25 * tag('busy-drums') + 0.15 * tag('open-drums');
  h *= 1 + 0.2 * tag('long-before-rest') + 0.3 * tag('call-hanging');
  const big = Math.max(tag('held-peak'), tag('climax-note'), tag('final-landing'), 0.7 * tag('peak-note'), 0.5 * tag('closing'));
  h += (1 - h) * 0.55 * big;
  return clamp(h, 0.08, 0.9);
}

/** The chance of each intention (they add up to 1). */
export function intentWeights(a: IntentAsk): Record<Intent, number> {
  const { tag } = a;
  const h = holdShare(a);
  const ret = 0.5 * (1 + 0.3 * tag('held-bar') + 0.3 * tag('answer-landing') + 0.2 * tag('long-over-chord-change'));
  const bridge = a.canBridge ? 0.25 * (1 + 0.8 * Math.max(tag('rising-energy'), tag('pre-climax'), tag('before-leap'), tag('call-hanging'), tag('falling-energy') * 0.7)) : 0;
  const flurry = a.flurryFit > 0 ? 0.25 * Math.min(1.5, a.flurryFit / 0.5) * (0.6 + 0.8 * a.e01) : 0;
  const rest = ret + bridge + flurry;
  const k = (1 - h) / rest;
  return { stay: h, return: ret * k, bridge: bridge * k, flurry: flurry * k };
}
