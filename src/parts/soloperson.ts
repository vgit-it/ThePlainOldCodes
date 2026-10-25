// The solo player's personality (docs/SOLO-PLAYER.md, section 4): a style sheet from the five lead players, with a small twist per band so
// no two are the same. What the player likes (a taste per rule), what they never play, how much they decorate, how they lean in feel, and
// (per solo) the two or three pet moves that keep coming back.

import type { Feel } from '../idea';
import type { LeadKind, LeadPlayer } from '../players/lead';
import { Rng } from '../rng';

export interface Person {
  kind: LeadKind;
  /** How much they like each rewrite (a multiplier; 0: never). A rule not listed is 1. */
  taste: Record<string, number>;
  /** The chance a long note is decorated at all, before the energy, the place and the fit are counted. */
  density: number;
  /** Their own lean in feel, added to what the moment wants. */
  lean: Feel;
  /** How hard a rewrite may be pushed: 0 plays safe, 1 takes the wild option too. */
  risk: number;
  /** How much they like each shape of figure (docs/SOLO-PLAYER.md, section 15): a multiplier, 0 for never. */
  figures: Record<string, number>;
  /** How much they lean on hammer-ons and pull-offs against picking each note (0 to 1). */
  legato: number;
  /** How much they like each way of dressing a short note (docs/SOLO-PLAYER.md, section 18): grace, mordent, bend, slide, ghost, drag, push. A multiplier, 0 for never. */
  dress: Record<string, number>;
  /** How much they like each way of leaning a short note into the next (section 18, 4b): pass, approach, chromatic, enclose, and run (a cell of short notes all leaning in). */
  join: Record<string, number>;
}

/** The joints each kind of player leans on. */
const JOINTS: Record<LeadKind, Record<string, number>> = {
  melodic: { pass: 1.4, approach: 1, chromatic: 0.1, enclose: 0.4, run: 1 },
  bluesy: { pass: 1, approach: 1, chromatic: 1.5, enclose: 0.9, run: 0.8 },
  shredder: { pass: 2, approach: 0.6, chromatic: 0, enclose: 0.8, run: 1.8 },
  raw: { pass: 0.8, approach: 1.2, chromatic: 0.6, enclose: 0.3, run: 0.6 },
  funky: { pass: 0.8, approach: 1, chromatic: 1, enclose: 1.5, run: 0.8 },
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const feel = (agitation = 0, roughness = 0, ornament = 0, weight = 0, looseness = 0): Feel => ({ agitation, roughness, ornament, weight, looseness });

const SHEETS: Record<LeadKind, { taste: Record<string, number>; density: number; lean: Feel; risk: number; figures: Record<string, number>; legato: number; dress: Record<string, number> }> = {
  melodic: {
    taste: {
      'scoop-in': 2, 'wide-vibrato': 2.5, 'late-bend': 1.5, 'bend-in': 1, trill: 0.5, 'bend-run': 1.1,
    },
    density: 0.42, lean: feel(-0.1, -0.1, 0, 0, 0.2), risk: 0.2,
    figures: { 'neighbour-up': 1.2, 'neighbour-down': 1.3, turn: 1, arch: 1.5, dip: 1, 'stair-up': 0.6, 'stair-down': 1, 'arpeggio-up': 1.2, 'arpeggio-down': 1, pedal: 0.6, enclosure: 0.5, 'leap-fill': 0.6, zigzag: 0.3, wave: 0.8, climb: 1.2, 'climb-zigzag': 0.5, 'climb-thirds': 1, 'climb-late': 0.8 }, legato: 0.6, dress: { grace: 1, mordent: 0.7, bend: 2, slide: 0.8, ghost: 0.05, drag: 1.8, push: 1.4 },
  },
  bluesy: {
    taste: {
      'bend-in': 2.5, 'late-bend': 2.5, 'wide-vibrato': 2, 'scoop-in': 1, trill: 0.6, 'bend-run': 1.5,
    },
    density: 0.52, lean: feel(0, 0.2, 0, 0.1, 0.2), risk: 0.35,
    figures: { 'neighbour-up': 0.8, 'neighbour-down': 1.5, turn: 0.8, arch: 1, dip: 1.2, 'stair-up': 0.8, 'stair-down': 1.2, 'arpeggio-up': 0.6, 'arpeggio-down': 0.8, pedal: 1.4, enclosure: 1.3, 'leap-fill': 1, zigzag: 0.5, wave: 0.8, climb: 1, 'climb-zigzag': 0.8, 'climb-thirds': 0.6, 'climb-late': 1.2 }, legato: 0.5, dress: { grace: 1, mordent: 0.6, bend: 3.2, slide: 1, ghost: 0.2, drag: 2.4, push: 1.8 },
  },
  shredder: {
    taste: {
      trill: 2, 'wide-vibrato': 0.8, 'bend-in': 0.6, 'late-bend': 0.5, 'scoop-in': 0.3, 'bend-run': 0.7,
    },
    density: 0.68, lean: feel(0.3, 0, 0.3, 0, -0.1), risk: 0.7,
    figures: { 'neighbour-up': 0.8, 'neighbour-down': 0.8, turn: 1, arch: 1, dip: 1, 'stair-up': 2, 'stair-down': 2, 'arpeggio-up': 1.4, 'arpeggio-down': 1.4, pedal: 1.2, enclosure: 0.6, 'leap-fill': 0.8, zigzag: 1.5, wave: 1.5, climb: 1.6, 'climb-zigzag': 1.4, 'climb-thirds': 1.4, 'climb-late': 1 }, legato: 0.8, dress: { grace: 0.9, mordent: 1.2, bend: 0.1, slide: 0.4, ghost: 0, drag: 0, push: 0 },
  },
  raw: {
    taste: {
      'scoop-in': 1.3, 'bend-in': 1, 'wide-vibrato': 1, 'late-bend': 0.6, trill: 0.3, 'bend-run': 0.8,
    },
    density: 0.5, lean: feel(0.1, 0.3, -0.2, 0.2, 0), risk: 0.45,
    figures: { 'neighbour-up': 1, 'neighbour-down': 1.2, turn: 0.4, arch: 0.8, dip: 1, 'stair-up': 0.6, 'stair-down': 0.6, 'arpeggio-up': 1.2, 'arpeggio-down': 1.2, pedal: 1.6, enclosure: 0.3, 'leap-fill': 1.5, zigzag: 0.5, wave: 0.4, climb: 0.8, 'climb-zigzag': 0.5, 'climb-thirds': 1.2, 'climb-late': 1.2 }, legato: 0.3, dress: { grace: 0.7, mordent: 0.4, bend: 1.2, slide: 1.1, ghost: 1, drag: 0, push: 0 },
  },
  funky: {
    taste: {
      'scoop-in': 0.8, 'bend-in': 0.5, 'wide-vibrato': 0.4, trill: 0.4, 'late-bend': 0.3, 'bend-run': 0.5,
    },
    density: 0.58, lean: feel(0.1, 0, 0.1, -0.1, -0.3), risk: 0.4,
    figures: { 'neighbour-up': 1.2, 'neighbour-down': 1.2, turn: 1, arch: 0.8, dip: 0.8, 'stair-up': 0.6, 'stair-down': 0.6, 'arpeggio-up': 1, 'arpeggio-down': 1, pedal: 1.5, enclosure: 1.6, 'leap-fill': 1, zigzag: 1.2, wave: 1, climb: 0.8, 'climb-zigzag': 1.3, 'climb-thirds': 0.8, 'climb-late': 1 }, legato: 0.3, dress: { grace: 1, mordent: 0.7, bend: 0.1, slide: 0.5, ghost: 1.6, drag: 0, push: 0 },
  },
};

/** The band's lead player as a person: the sheet of their kind, a twist in every taste, in how much they decorate and in what they lean toward, and one thing they never play. */
export function personOf(bandSeed: string, lead: LeadPlayer): Person {
  const rng = new Rng(`${bandSeed}-person`);
  const s = SHEETS[lead.kind];
  const taste: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.taste)) taste[k] = Math.round(v * (0.8 + rng.next() * 0.45) * 100) / 100;
  // an allergy: one of the moves they like least
  const unloved = Object.entries(taste).filter(([k, v]) => v < 1 && k !== 'bend-run').map(([k]) => k);
  if (unloved.length) taste[rng.pick(unloved)] = 0;
  const twist = (x: number) => Math.max(-1, Math.min(1, x + (rng.next() - 0.5) * 0.2));
  const lean: Feel = { agitation: twist(s.lean.agitation), roughness: twist(s.lean.roughness), ornament: twist(s.lean.ornament), weight: twist(s.lean.weight), looseness: twist(s.lean.looseness) };
  return { kind: lead.kind, taste, density: s.density * (0.85 + rng.next() * 0.3), lean, risk: Math.max(0, Math.min(1, s.risk + (rng.next() - 0.5) * 0.2)), figures: Object.fromEntries(Object.entries(s.figures).map(([k, v]) => [k, Math.round(v * (0.8 + rng.next() * 0.45) * 100) / 100])), legato: clamp01(s.legato + (rng.next() - 0.5) * 0.2), dress: { ...s.dress }, join: { ...JOINTS[lead.kind] } };
}

/** The two or three moves this player comes back to in one solo: drawn from what they like (never one they refuse). */
export function signaturesOf(p: Person, soloSeed: string): string[] {
  const rng = new Rng(`${soloSeed}-signatures`);
  const pool = Object.entries(p.taste).filter(([, v]) => v > 0).map(([k, v]) => [k, v * v] as [string, number]);
  const out: string[] = [];
  const n = Math.min(pool.length, rng.int(2, 3));
  while (out.length < n) {
    const k = rng.weighted(pool.filter(([name]) => !out.includes(name)));
    out.push(k);
  }
  return out;
}
