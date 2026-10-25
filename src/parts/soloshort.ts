// The solo player's short-note dressing (docs/SOLO-PLAYER.md, section 18, step 4a): a note under a beat (mostly one 8th) played with a small
// touch instead of plain. Everything sits inside the note's own time and the note keeps its pitch (the pitch heard most). The ways:
//   grace     a quick scale note (or a half step below) just before the note
//   mordent   the note, a neighbour, the note again, in thirds of the note's time
//   bend      the note bent up into, held (a strong beat; the bend has to land)
//   slide     slid into from a step or two away
//   ghost     one muted scratch just before the note (funky and raw)
//   drag      the note a hair late
//   push      the note a hair early (the note before gives up that time)
// A candidate is a list of events; the director draws one by weight and the checker has the last word.

import type { Feel, GuitarHit } from '../idea';
import type { Rng } from '../rng';
import type { Mood } from '../tension';
import { TUNINGS } from '../theory/fretboard';
import { type Profile, intervalCost } from '../verse/intervals';
import { type PEvent, snap } from './soloevents';
import type { Person } from './soloperson';
import type { Span } from './solorules';
import { figureHead, landingHit, msStep, onBeat, scaleOf } from './solofigure';

export type ShortKind = 'grace' | 'mordent' | 'bend' | 'slide' | 'ghost' | 'drag' | 'push';
export const SHORT_KINDS: ShortKind[] = ['grace', 'mordent', 'bend', 'slide', 'ghost', 'drag', 'push'];

export interface ShortAsk {
  person: Person;
  want: Feel;
  profile: Profile;
  mood: Mood;
  /** The pitch of the note played just before (a dressed note never starts by playing it again). */
  prevPitch: number | null;
  /** The note sits on a snare or crash: no push, no drag (a kick is often under the guitar, so a hair off it is the feel). */
  onDrum: boolean;
  /** The note before bent: no bend now. */
  prevBend: boolean;
  /** Only this way. */
  only?: ShortKind;
}

export interface ShortMove {
  events: PEvent[];
  kind: ShortKind;
  /** For the roll. */
  label: string;
  w: number;
  /** A push: the steps taken from the end of the note before. */
  push?: number;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The quickest a hammered or pulled note can follow the one before (ms). */
const LEGATO_MS = 42;

/** Candidate ways to dress a short note (2 to 4 steps, a plain picked note); empty when it cannot take one. */
export function composeShort(s: Span, ask: ShortAsk, rng: Rng): ShortMove[] {
  const n = s.note, h = s.event.hit, L = n.len, song = s.ctx.song;
  if (L < 2 || L >= 4 || !figureHead(h) || h.bend || h.slide) return [];
  const { notes, pcs } = scaleOf(song);
  const mainIdx = notes.indexOf(n.midi);
  if (mainIdx < 0) return [];
  const ms = msStep(s), s6 = ms / 1000;
  const { person, want, profile: P } = ask;
  const tuning = (song.tuning ?? TUNINGS.standard).strings;
  const lo = tuning[0], hi = tuning[5] + 24;
  const canOut = person.kind === 'bluesy' || person.kind === 'funky';
  const hands = s.ctx.hands;
  const kw = (k: ShortKind) => (ask.only ? (ask.only === k ? 1 : 0) : person.dress[k] ?? 1);
  const out: ShortMove[] = [];

  // the neighbours it can lean from: the scale note below and above, and for the blues-minded a half step below that is outside the key
  const neighbours = (): { pitch: number; out: boolean; w: number; word: string }[] => {
    const r: { pitch: number; out: boolean; w: number; word: string }[] = [];
    const add = (pitch: number, isOut: boolean, bias: number, word: string) => {
      if (pitch < lo || pitch > hi || Math.abs(pitch - n.midi) > 3 || pitch === n.midi) return;
      r.push({ pitch, out: isOut, w: bias * Math.exp(-intervalCost(P, pitch, n.midi, 0, false) / 1.5), word });
    };
    if (mainIdx > 0) add(notes[mainIdx - 1], false, 1, 'below');
    if (mainIdx < notes.length - 1) add(notes[mainIdx + 1], false, 0.85, 'above');
    if (canOut && !pcs.has(mod(n.midi - 1, 12))) add(n.midi - 1, true, 0.5, 'half step below');
    return r;
  };
  const pickNb = (exclude?: number) => {
    const list = neighbours().filter((x) => x.pitch !== exclude);
    const tot = list.reduce((a, x) => a + x.w, 0);
    if (tot <= 0) return null;
    let r = rng.next() * tot;
    for (const x of list) if ((r -= x.w) < 0) return x;
    return list[list.length - 1];
  };
  const legatoP = (dur: number) => clamp(0.25 + 0.6 * hands.legato + person.legato * 0.4 + (dur * ms < 100 ? 0.3 : 0), 0, 0.95);
  const mk = (t: number, len: number, pitch: number, o: { art: GuitarHit['art']; vel: number; out?: boolean; mute?: 'dead' }): PEvent => {
    const { vib: _v, ...base } = landingHit(h);
    const hit: GuitarHit = { ...base, step: Math.floor(t), len, notes: [pitch], vel: clamp(o.vel, 0.15, 1.2), exact: true, art: o.art, ...(o.mute ? { mute: o.mute } : {}) };
    delete hit.shift;
    if (o.out) hit.out = true;
    return { t: snap(t), len: snap(len), base: n.i, hit, ...(o.out ? { out: true } : {}) };
  };

  // ---- a grace note just before the note
  if (kw('grace') > 0) {
    const gs = [0.5, snap(2 / 3), 1].filter((g) => g <= L / 2 + 1e-6 && g * ms >= LEGATO_MS);
    const nb = pickNb(ask.prevPitch ?? undefined);
    if (nb && gs.length) {
      const g = gs[rng.int(0, gs.length - 1)];
      const art: GuitarHit['art'] = rng.chance(legatoP(L - g)) ? 'legato' : 'pick';
      const e1 = mk(n.t, g, nb.pitch, { art: 'pick', vel: h.vel * 0.8, out: nb.out });
      const e2 = mk(n.t + g, L - g, n.midi, { art, vel: h.vel * 0.96 });
      out.push({ events: [e1, e2], kind: 'grace', label: `grace from ${nb.word}`, w: kw('grace') * (0.7 + 0.5 * Math.max(0, want.ornament)) });
    }
  }

  // ---- a mordent: the note, a neighbour, the note
  if (kw('mordent') > 0 && L >= 2) {
    const d = snap(L / 3);
    const nb = pickNb();
    if (nb && d * ms >= LEGATO_MS && Math.abs(d * 3 - L) < 0.03) {
      const e1: PEvent = { t: n.t, len: d, base: n.i, hit: { ...h, len: d } };
      const e2 = mk(n.t + d, d, nb.pitch, { art: rng.chance(legatoP(d)) ? 'legato' : 'pick', vel: h.vel * 0.84, out: nb.out });
      const e3 = mk(n.t + 2 * d, L - 2 * d, n.midi, { art: rng.chance(legatoP(d)) ? 'legato' : 'pick', vel: h.vel * 0.9 });
      out.push({ events: [e1, e2, e3], kind: 'mordent', label: `mordent ${nb.word}`, w: kw('mordent') * (0.7 + 0.5 * Math.max(0, want.ornament)) });
    }
  }

  // ---- a quick bend up into the note (a strong beat; the bend has to land inside the note)
  if (kw('bend') > 0 && !ask.prevBend && onBeat(s, n.t)) {
    const open = ask.mood === 'happy' || ask.mood === 'triumphant' || ask.mood === 'angry', tight = ask.mood === 'dark' || ask.mood === 'tense' || ask.mood === 'melancholic';
    const sizes = [1, 2].filter((b) => pcs.has(mod(n.midi - b, 12)) && 0.05 + b * 0.025 + 0.05 < L * s6 * 0.97 - 0.003);
    if (sizes.length) {
      const b = sizes.length === 2 ? (rng.chance(open ? 0.75 : tight ? 0.25 : 0.5) ? 2 : 1) : sizes[0];
      out.push({ events: [{ t: n.t, len: L, base: n.i, hit: { ...h, bend: b } }], kind: 'bend', label: `quick bend ${b === 2 ? 'a whole' : 'a half'} step`, w: kw('bend') * (0.8 + 0.4 * Math.max(0, want.weight)) });
    }
  }

  // ---- slid into
  if (kw('slide') > 0) {
    const from = rng.chance(0.8) ? rng.pick([-1, -2, -2, -3]) : rng.pick([1, 2]);
    if (n.midi + from >= lo && n.midi + from !== ask.prevPitch) out.push({ events: [{ t: n.t, len: L, base: n.i, hit: { ...h, slide: from } }], kind: 'slide', label: `slide in from ${Math.abs(from)} ${from < 0 ? 'below' : 'above'}`, w: kw('slide') * (0.8 + 0.5 * Math.max(0, want.looseness)) });
  }

  // ---- one muted scratch just before the note (not sounding: the note keeps its pitch and starts half a step later)
  if (kw('ghost') > 0 && L >= 2) {
    const ghost = mk(n.t, 0.5, n.midi, { art: 'pick', vel: h.vel * 0.45, mute: 'dead' });
    const note = mk(n.t + 0.5, L - 0.5, n.midi, { art: 'pick', vel: h.vel });
    out.push({ events: [ghost, note], kind: 'ghost', label: 'a muted scratch before it', w: kw('ghost') * (0.7 + 0.6 * Math.max(0, want.roughness)) });
  }

  // ---- a hair late, a hair early (never on a drum hit)
  if (!ask.onDrum) {
    if (kw('drag') > 0 && L >= 2) {
      const d = rng.pick([1 / 6, 1 / 4, 1 / 3, 1 / 2]);
      out.push({ events: [{ t: snap(n.t + d), len: snap(L - d), base: n.i, loose: true, hit: { ...h, exact: true } }], kind: 'drag', label: `dragged ${Math.round(d * 12)}/12 of a step`, w: kw('drag') * (0.6 + 0.8 * Math.max(0, want.looseness + 0.3)) });
    }
    if (kw('push') > 0) {
      const d = rng.pick([1 / 6, 1 / 4, 1 / 3]);
      out.push({ events: [{ t: snap(n.t - d), len: snap(L + d), base: n.i, loose: true, hit: { ...h, exact: true } }], kind: 'push', label: `pushed ${Math.round(d * 12)}/12 of a step`, w: kw('push') * (0.6 + 0.8 * Math.max(0, want.looseness + 0.3)), push: snap(d) });
    }
  }
  return out;
}
