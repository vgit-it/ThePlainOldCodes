// The solo player's first real rewrite rules (docs/SOLO-PLAYER.md, step 3): ways to play one long note. Each re-plays or decorates the
// note without losing it: it starts on the note's pitch at its time, the note's pitch is the one heard most, and (where a rule says it
// keeps all) it ends on it. A rule only proposes; the director scores and picks, and the checker (soloverify.ts) has the last word.
//
// Flurry (the note struck again): triplet pulse, eighth pulse, stutter, gallop, ghost pulse, tremolo, trill.
// Stay (the note held, with expression): scoop in, bend in, late bend, wide vibrato.
// Trill (the note and the one above it, as fast as the hands go).
// (The figures that go up and down around the note and back, or climb toward the next, are composed: solofigure.ts.)

import type { Feel, GuitarHit } from '../idea';
import { SCALES } from '../theory';
import { type PEvent, snap } from './soloevents';
import type { Rule, Span } from './solorules';
import { beatAt } from './soloverify';

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
/** The note `n` steps of the key's scale above (1) or below (-1) a note. */
function inKey(s: Span, midi: number, dir: 1 | -1, n = 1): number {
  const pcs = keyPcs(s);
  let m = midi;
  for (let k = 0; k < n; k++) do m += dir; while (!pcs.has(mod(m, 12)));
  return m;
}
const isInKey = (s: Span, m: number) => keyPcs(s).has(mod(m, 12));

/** How long a number of 16ths lasts at this song's tempo. */
const ms = (s: Span, steps: number) => (steps * 15000) / s.ctx.song.bpm;
const beatOf = (s: Span) => beatAt(s.ctx.song, s.note.t);

/** A new event for the note: the hit as it is, with these changes, not held on through a short rest after it. */
function piece(s: Span, t: number, len: number, o: { midi?: number; vel?: number; art?: GuitarHit['art']; mute?: 'dead'; keepVib?: boolean; extra?: Partial<GuitarHit> } = {}): PEvent {
  const { vib, ...h } = s.event.hit;
  const hit: GuitarHit = {
    ...h, step: Math.floor(t), len, vel: o.vel ?? h.vel, exact: true,
    ...(o.keepVib && vib !== undefined ? { vib } : {}),
    ...(o.midi !== undefined ? { notes: [o.midi] } : {}),
    ...(o.art ? { art: o.art } : {}),
    ...(o.mute ? { mute: o.mute } : {}),
    ...o.extra,
  };
  return { t: snap(t), len: snap(len), base: s.note.i, hit };
}
/** The rest of the note from `t` to its end, held as the note was (its vibrato and all). */
function hold(s: Span, t: number, o: { art?: GuitarHit['art']; vel?: number } = {}): PEvent {
  const h = s.event.hit, end = s.note.t + s.note.len;
  return { t: snap(t), len: snap(end - t), base: s.note.i, hit: { ...h, step: Math.floor(t), len: end - t, ...(o.art ? { art: o.art } : {}), ...(o.vel !== undefined ? { vel: o.vel } : {}) } };
}

/** The note struck again once for every length given (a little louder each time), then the rest of it held. Null when too little is left to hold. */
function repick(s: Span, lens: number[], loud: number, min = 2): PEvent[] | null {
  const n = s.note;
  const total = lens.reduce((a, b) => a + b, 0);
  if (n.len - total < min - 1e-6) return null;
  const out: PEvent[] = [];
  let t = n.t;
  lens.forEach((len, j) => {
    out.push(piece(s, t, len, { vel: Math.min(1, s.event.hit.vel * (0.82 + loud * (j / lens.length))) }));
    t += len;
  });
  out.push(hold(s, t));
  return out;
}

// ---------------------------------------------------------------- re-pick

const TRIPLET_PULSE: Rule = {
  name: 'triplet-pulse', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0.2, -0.1, 0.2, 0, 0), heavy: true, vetoes: ['final-landing'],
    likes: { 'shuffle-groove': 1.6, 'long-with-room': 0.2, 'rising-energy': 0.3, 'high-energy': 0.2, 'eighths-groove': -0.3, 'sixteenths-groove': -0.2 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 5 ? 1 : 0),
  realise: (s, rng) => {
    const u = beatOf(s) / 3;
    if (ms(s, u) < 62) return null;
    const k = s.note.len - 6 * u >= 2 && rng.chance(0.4) ? 6 : 3;
    return repick(s, Array(k).fill(u), 0.2) ?? repick(s, Array(3).fill(u), 0.2);
  },
};

const EIGHTH_PULSE: Rule = {
  name: 'eighth-pulse', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0, 0, -0.1, 0.2, -0.2), vetoes: ['final-landing'],
    likes: { 'eighths-groove': 0.6, 'quarters-groove': 0.5, 'open-drums': 0.2, 'rising-energy': 0.3, 'sixteenths-groove': -0.3, 'shuffle-groove': -0.5 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 ? 1 : 0),
  realise: (s, rng) => {
    const u = beatOf(s) / 2;
    if (ms(s, u) < 62) return null;
    const k = rng.pick([2, 3, 3, 4]);
    return repick(s, Array(k).fill(u), 0.25, 3) ?? repick(s, [u, u], 0.25, 3);
  },
};

const STUTTER_HOLD: Rule = {
  name: 'stutter-hold', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0.5, 0.3, 0.1, 0.1, -0.4), heavy: true, vetoes: ['final-landing', 'closing'],
    likes: { 'sixteenths-groove': 0.7, 'under-fill': 0.6, 'into-snare': 0.4, 'into-crash': 0.3, 'busy-drums': 0.3, 'high-energy': 0.4, 'shuffle-groove': -0.5, 'open-drums': -0.2 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 5 ? 1 : 0),
  realise: (s, rng) => (ms(s, 1) < 62 ? null : repick(s, Array(rng.pick([2, 3, 3, 4])).fill(1), 0.15)),
};

const GALLOP: Rule = {
  name: 'gallop', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0.7, 0.6, -0.1, 0.6, -0.4), heavy: true, vetoes: ['final-landing', 'closing'],
    likes: { 'high-energy': 0.6, 'eighths-groove': 0.4, 'sixteenths-groove': 0.2, 'high-tension': 0.3, 'shuffle-groove': -0.6, 'low-energy': -0.6 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 ? 1 : 0),
  realise: (s, rng) => {
    if (ms(s, 1) < 62) return null;
    const r = rng.pick([1, 2]);
    return repick(s, Array.from({ length: r }, () => [2, 1, 1]).flat(), 0.2) ?? repick(s, [2, 1, 1], 0.2);
  },
};

const GHOST_PULSE: Rule = {
  name: 'ghost-pulse', keeps: 'main',
  profile: {
    group: 'flurry', feel: feel(0.3, 0.5, 0.2, -0.2, -0.6), heavy: true, vetoes: ['final-landing', 'closing'],
    likes: { 'sixteenths-groove': 0.6, 'on-kick': 0.4, 'on-snare': 0.3, 'busy-drums': 0.3, 'shuffle-groove': -0.4, 'open-drums': -0.3, 'low-energy': -0.4 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 ? 1 : 0),
  realise: (s, rng) => {
    if (ms(s, 1) < 62) return null;
    const r = s.note.len - 8 >= 2 && rng.chance(0.4) ? 2 : 1;
    if (s.note.len - 4 * r < 2) return null;
    const out: PEvent[] = [];
    let t = s.note.t;
    for (let j = 0; j < r; j++) {
      out.push(piece(s, t, 1, { vel: s.event.hit.vel * 0.95 }), piece(s, t + 1, 1, { mute: 'dead', vel: s.event.hit.vel * 0.5 }));
      out.push(piece(s, t + 2, 1, { vel: s.event.hit.vel * 0.85 }), piece(s, t + 3, 1, { mute: 'dead', vel: s.event.hit.vel * 0.5 }));
      t += 4;
    }
    out.push(hold(s, t));
    return out;
  },
};

const TREMOLO_HOLD: Rule = {
  name: 'tremolo-hold', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0.6, 0.6, 0.1, 0.5, -0.2), heavy: true,
    likes: { 'climax-note': 0.7, 'held-peak': 0.5, 'peak-note': 0.4, 'high-tension': 0.5, 'into-crash': 0.5, crest: 0.3, 'low-energy': -0.5 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 ? 1 : 0),
  realise: (s, rng) => {
    const beat = beatOf(s);
    let L = beat * (s.note.len >= beat * 3 + 2 && rng.chance(0.5) ? 2 : 1);
    if (s.note.len - L < 2) L = s.note.len - 2;
    if (L < 2) return null;
    return [piece(s, s.note.t, L, { vel: s.event.hit.vel * 0.92, extra: { tremolo: true } }), hold(s, s.note.t + L)];
  },
};

// ---------------------------------------------------------------- shape

const SCOOP_IN: Rule = {
  name: 'scoop-in', keeps: 'all',
  profile: {
    group: 'stay', feel: feel(-0.3, -0.3, 0.2, 0, 0.8),
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
    group: 'stay', feel: feel(0, 0.1, 0.1, 0.3, 0.3),
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
    group: 'stay', feel: feel(-0.3, 0, 0.1, 0.2, 0.6),
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
    group: 'stay', feel: feel(-0.5, -0.3, -0.1, 0.2, 0.6),
    likes: { 'held-bar': 0.5, 'long-before-rest': 0.5, 'phrase-end': 0.4, 'low-energy': 0.3, 'final-landing': 0.4, 'answer-landing': 0.3 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 && (s.event.hit.vib ?? 0) < 20 ? 1 : 0),
  realise: (s, rng) => [{ t: s.note.t, len: s.note.len, base: s.note.i, hit: { ...s.event.hit, vib: Math.round(20 + rng.next() * 14) } }],
};

// ---------------------------------------------------------------- move

const TRILL: Rule = {
  name: 'trill', keeps: 'all',
  profile: {
    group: 'flurry', feel: feel(0.5, -0.2, 0.6, -0.1, -0.1), heavy: true,
    likes: { 'high-energy': 0.3, 'static-repeat': 0.3, 'long-with-room': 0.2, 'rising-energy': 0.2 },
  },
  weight: (s) => (plainPick(s) && s.note.len >= 6 ? 1 : 0),
  realise: (s, rng) => {
    const d = inKey(s, s.note.midi, 1) - s.note.midi;
    const beat = beatOf(s), n = s.note;
    if (n.len <= beat * 2 + 1) {
      const { vib: _v, ...h } = s.event.hit;
      return [{ t: n.t, len: n.len, base: n.i, hit: { ...h, trill: d } }];
    }
    const L = beat * rng.pick([1, 1, 2]);
    if (n.len - L < 2) return null;
    return [piece(s, n.t, L, { extra: { trill: d } }), hold(s, n.t + L)];
  },
};

/** The ways to play a long note that are not figures (the figures are composed: solofigure.ts): the note struck again and again (flurry) and the note held with expression (stay). */
export const LONG_RULES: Rule[] = [
  TRIPLET_PULSE, EIGHTH_PULSE, STUTTER_HOLD, GALLOP, GHOST_PULSE, TREMOLO_HOLD, TRILL,
  SCOOP_IN, BEND_IN, LATE_BEND, WIDE_VIBRATO,
];
