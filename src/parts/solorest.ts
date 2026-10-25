// The solo player's rests (docs/SOLO-PLAYER.md, section 18, step 4c): a rest before a note (silence of 2 steps or more, or the silence before
// the first note) is mostly left as it is, the breath; now and then a short pickup leans into the note that follows, or one muted scratch
// marks the beat. The added notes sit in the last steps of the rest and end where the next note starts; the rest keeps at least a step of
// silence when it is 3 steps or more. They belong to no melody note (the checker lets them stand only inside a gap of the melody).
//   pickup      one scale note below or above the next note (or a half step outside the key for bluesy and funky), then the note
//   run-in      two scale notes stepping into the next note from one side
//   circle-in   the notes above and below the next note, then the note
//   scratch     one muted scratch on the last 16th of the rest

import type { Feel } from '../idea';
import type { Rng } from '../rng';
import { TUNINGS } from '../theory/fretboard';
import { type Profile, intervalCost } from '../verse/intervals';
import type { PEvent } from './soloevents';
import { msStep, scaleOf } from './solofigure';
import type { Person } from './soloperson';
import type { Span } from './solorules';
import { mod, pieceOf } from './soloshort';

export const REST_KINDS = ['pickup', 'run-in', 'circle-in', 'scratch'];

export interface RestAsk {
  person: Person;
  want: Feel;
  profile: Profile;
  /** The pitch played just before the rest (a pickup never starts by playing it again), if any. */
  prevPitch: number | null;
  /** The pitch the next note starts with (the pickup never ends on it). */
  nextFirst: number;
  /** Silence before the note, in steps. */
  silence: number;
  only?: string;
}

export interface RestMove {
  events: PEvent[];
  kind: string;
  label: string;
  w: number;
}

/** An added note: a plain picked hit that belongs to no melody note, with nothing the next note's own playing left on it. */
function bare(e: PEvent): PEvent {
  const { lateBend: _a, unbend: _b, bendAt: _c, trill: _d, tremolo: _e, swell: _f, letRing: _g, touch: _h, vib: _i, ...hit } = e.hit;
  const { base: _base, ...rest } = e;
  return { ...rest, hit, extra: true };
}

/** Candidate fills for the rest before the note of this span; empty when it should stay silent. */
export function composeRest(s: Span, ask: RestAsk, rng: Rng): RestMove[] {
  const n = s.note, song = s.ctx.song, S = ask.silence;
  if (S < 2 - 1e-6) return [];
  const { notes, pcs } = scaleOf(song);
  const b = notes.indexOf(n.midi);
  if (b < 0) return [];
  const ms = msStep(s);
  const dMin = Math.ceil((62 / ms) * 12) / 12;
  const { person, want, profile: P } = ask;
  const tuning = (song.tuning ?? TUNINGS.standard).strings;
  const lo = tuning[0], hi = tuning[5] + 24;
  const canOut = person.kind === 'bluesy' || person.kind === 'funky';
  const kw = (k: string) => (ask.only ? (ask.only === k ? 1 : 0) : k === 'scratch' ? person.dress.ghost ?? 1 : k === 'pickup' ? (person.join.approach ?? 1) : k === 'run-in' ? (person.join.pass ?? 1) : (person.join.enclose ?? 1));
  // the rest keeps a step of silence: what is added fits in the rest less a step
  const room = S - 1;
  const out: RestMove[] = [];

  /** The pitches played one after the other, each `d` steps, the last one ending where the note starts. */
  const build = (kind: string, pitches: { pitch: number; out?: boolean }[], d: number, label: string, w: number) => {
    const k = pitches.length;
    if (d < dMin - 1e-6 || k * d > room + 1e-6) return;
    if (pitches.some((p) => p.pitch < lo || p.pitch > hi || p.pitch === ask.nextFirst || Math.abs(p.pitch - n.midi) > 5)) return;
    if (ask.prevPitch !== null && pitches[0].pitch === ask.prevPitch) return;
    for (let i = 1; i < k; i++) if (pitches[i].pitch === pitches[i - 1].pitch) return;
    const events: PEvent[] = pitches.map((p, i) => {
      const e = pieceOf(s, n.t - (k - i) * d, d, p.pitch, { art: 'pick', vel: s.event.hit.vel * 0.78, out: p.out });
      return bare(e);
    });
    out.push({ events, kind, label, w: w * Math.exp(-intervalCost(P, pitches[k - 1].pitch, n.midi, 0, false) / 1.5) });
  };
  const d1 = 1;

  // ---- one scale note below or above the next note
  if (kw('pickup') > 0) {
    const sides = [b - 1, b + 1].filter((i) => i >= 0 && i < notes.length);
    for (const i of sides) build('pickup', [{ pitch: notes[i] }], d1, `a pickup ${i < b ? 'from below' : 'from above'}`, kw('pickup') * (0.7 + 0.5 * Math.max(0, want.ornament + 0.3)));
    if (canOut && !pcs.has(mod(n.midi - 1, 12))) build('pickup', [{ pitch: n.midi - 1, out: true }], d1, 'a pickup a half step below, outside the key', 0.6 * kw('pickup') * (0.7 + 0.6 * Math.max(0, want.roughness + 0.3)));
  }
  // ---- two scale notes stepping into it from one side
  if (kw('run-in') > 0 && room >= 2 - 1e-6) {
    for (const dir of [-1, 1]) if (b + 2 * dir >= 0 && b + 2 * dir < notes.length) build('run-in', [{ pitch: notes[b + 2 * dir] }, { pitch: notes[b + dir] }], 1, `a run in from ${dir < 0 ? 'below' : 'above'}`, kw('run-in') * (0.7 + 0.5 * Math.max(0, want.agitation + 0.3)));
  }
  // ---- the notes above and below it, either way round
  if (kw('circle-in') > 0 && room >= 2 - 1e-6 && b + 1 < notes.length && b >= 1) {
    const pair = rng.chance(0.5) ? [notes[b + 1], notes[b - 1]] : [notes[b - 1], notes[b + 1]];
    build('circle-in', pair.map((pitch) => ({ pitch })), 1, 'circles the note, above and below', kw('circle-in') * (0.7 + 0.6 * Math.max(0, want.ornament + 0.3)));
  }
  // ---- one muted scratch on the last 16th of the rest
  if (kw('scratch') > 0) {
    const e = pieceOf(s, n.t - 1, 1, n.midi, { art: 'pick', vel: s.event.hit.vel * 0.45, mute: 'dead' });
    out.push({ events: [bare(e)], kind: 'scratch', label: 'a muted scratch before it', w: kw('scratch') * (0.7 + 0.6 * Math.max(0, want.roughness + 0.3)) });
  }
  return out;
}
