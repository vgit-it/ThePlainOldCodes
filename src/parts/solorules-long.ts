// The solo player's first real rewrite rules (docs/SOLO-PLAYER.md, step 3): ways to play one long note. Each re-plays or decorates the
// note without losing it: it starts on the note's pitch at its time, the note's pitch is the one heard most, and (where a rule says it
// keeps all) it ends on it. A rule only proposes; the director scores and picks, and the checker (soloverify.ts) has the last word.
//
// Stay (the note held, with expression): scoop in, bend in, late bend, wide vibrato.
// (Paul, 2026-10-25: nothing that strikes one note again and again; the pulses, stutter, gallop, ghosts and tremolo are gone. The figures that
// go up and down around the note and back, or climb toward the next, and the trill (written as notes at the tempo) are composed: solofigure.ts.)

import type { Feel } from '../idea';
import { SCALES } from '../theory';
import type { Rule, Span } from './solorules';

const feel = (agitation: number, roughness: number, ornament: number, weight: number, looseness: number): Feel => ({ agitation, roughness, ornament, weight, looseness });
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** A plain picked note: nothing on it that a re-picking or a new bend would lose. */
function plainPick(s: Span): boolean {
  const h = s.event.hit;
  return !h.mute && h.notes.length === 1 && !h.bend && !h.lateBend && !h.unbend && !h.trill && !h.tremolo && !h.slide && !h.rake && !h.swell && !h.letRing
    && (h.art === undefined || h.art === 'pick');
}

const pcsMemo = new WeakMap<object, Set<number>>();
const keyPcs = (s: Span) => {
  const song = s.ctx.song;
  if (!pcsMemo.has(song)) pcsMemo.set(song, new Set((SCALES[song.mode] as readonly number[]).map((p) => (p + song.key) % 12)));
  return pcsMemo.get(song)!;
};
const isInKey = (s: Span, m: number) => keyPcs(s).has(mod(m, 12));

// ---------------------------------------------------------------- shape

const SCOOP_IN: Rule = {
  name: 'scoop-in', keeps: 'all',
  profile: {
    feel: feel(-0.3, -0.3, 0.2, 0, 0.8),
    likes: { 'phrase-start': 0.6, 'first-note': 0.3, 'leap-up': 0.4, 'held-bar': 0.2, 'low-energy': 0.2, 'step-up': 0.1 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 3 ? 1 : 0),
  realise: (s, rng) => {
    const h = s.event.hit;
    const from = s.read.feel.looseness > 0.5 ? rng.pick([-2, -3, -3, -5]) : rng.pick([-1, -2, -2, -3]);
    return [{ t: s.note.t, len: s.note.len, base: s.note.i, hit: { ...h, slide: from, ...(s.note.len >= 6 && h.vib === undefined ? { vib: 18 } : {}) } }];
  },
};

const BEND_IN: Rule = {
  name: 'bend-in', keeps: 'all',
  profile: {
    feel: feel(0, 0.1, 0.1, 0.3, 0.3),
    likes: { 'peak-note': 0.5, 'held-peak': 0.4, 'leap-up': 0.3, 'high-register': 0.3, 'climax-note': 0.4, 'step-up': 0.2, 'answer-landing': 0.2 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 3 && [1, 2].some((b) => isInKey(s, s.note.midi - b)) ? 1 : 0),
  realise: (s, rng) => {
    const ok = [1, 2].filter((b) => isInKey(s, s.note.midi - b));
    if (!ok.length) return null;
    // (a whole step is the full bend; a half step is the small blues one)
    const b = ok.length === 2 ? (rng.chance(0.65) ? 2 : 1) : ok[0];
    return [{ t: s.note.t, len: s.note.len, base: s.note.i, hit: { ...s.event.hit, bend: b } }];
  },
};

const LATE_BEND: Rule = {
  name: 'late-bend', keeps: 'all',
  profile: {
    feel: feel(-0.3, 0, 0.1, 0.2, 0.6),
    likes: { 'long-with-room': 0.4, 'held-bar': 0.5, 'long-before-rest': 0.4, 'phrase-end': 0.3, 'call-hanging': 0.2 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 8 && [1, 2].some((b) => isInKey(s, s.note.midi - b)) ? 1 : 0),
  realise: (s, rng) => {
    const ok = [1, 2].filter((b) => isInKey(s, s.note.midi - b));
    if (!ok.length) return null;
    const b = ok.length === 2 ? (rng.chance(0.7) ? 2 : 1) : ok[0];
    return [{ t: s.note.t, len: s.note.len, base: s.note.i, hit: { ...s.event.hit, lateBend: b } }];
  },
};

const WIDE_VIBRATO: Rule = {
  name: 'wide-vibrato', keeps: 'all',
  profile: {
    feel: feel(-0.5, -0.3, -0.1, 0.2, 0.6),
    likes: { 'held-bar': 0.5, 'long-before-rest': 0.5, 'phrase-end': 0.4, 'low-energy': 0.3, 'final-landing': 0.4, 'answer-landing': 0.3 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 && (s.event.hit.vib ?? 0) < 20 ? 1 : 0),
  realise: (s, rng) => [{ t: s.note.t, len: s.note.len, base: s.note.i, hit: { ...s.event.hit, vib: Math.round(20 + rng.next() * 14) } }],
};

/** The ways to play a long note that are not figures (the figures are composed: solofigure.ts): the note held with expression (stay). */
export const LONG_RULES: Rule[] = [SCOOP_IN, BEND_IN, LATE_BEND, WIDE_VIBRATO];
