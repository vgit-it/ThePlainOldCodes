// The solo player's joints (docs/SOLO-PLAYER.md, section 18, step 4b): a short note that leans into the next one. The note is struck and
// keeps at least as much of its time as any other pitch, then one or two notes inside its own time carry the line to the next note, which
// is never played twice in a row with the note before. The ways:
//   pass       the scale notes between the two, the last one or two of them (a run toward the next note)
//   approach   the scale note just beyond the next note (up and back, or down and back)
//   chromatic  a half step outside the key, below or above the next note (bluesy and funky)
//   enclose    the scale notes above and below the next note, in either order, then the note
// A run is the same thing over a cell of 3 to 4 short notes: each joint leans in (the director does that).

import type { Rng } from '../rng';
import { TUNINGS } from '../theory/fretboard';
import { intervalCost } from '../verse/intervals';
import { figureHead, msStep, scaleOf } from './solofigure';
import { type PEvent, snap } from './soloevents';
import type { Span } from './solorules';
import { type ShortAsk, type ShortMove, legatoOf, mod, pieceOf } from './soloshort';

export type JointKind = 'pass' | 'approach' | 'chromatic' | 'enclose';
export const JOINT_KINDS: JointKind[] = ['pass', 'approach', 'chromatic', 'enclose'];

/** Candidate joints for a short note that touches the next one; empty when it cannot take one. */
export function composeJoint(s: Span, ask: ShortAsk, rng: Rng): ShortMove[] {
  const n = s.note, h = s.event.hit, L = n.len, nx = s.next, song = s.ctx.song;
  // (the last note is carried into the next section and bent there, starting on another pitch: nothing leans into it)
  if (L < 2 || L >= 4 || !nx || nx.frozen || s.after > 0.5 + 1e-6 || !figureHead(h) || h.bend || h.slide) return [];
  const { notes, pcs } = scaleOf(song);
  const a = notes.indexOf(n.midi), b = notes.indexOf(nx.midi);
  if (a < 0 || b < 0 || a === b) return [];
  const dir = Math.sign(b - a);
  const N = nx.midi;
  const ms = msStep(s);
  const dMin = Math.ceil((62 / ms) * 12) / 12;
  const { person, want, profile: P } = ask;
  const tuning = (song.tuning ?? TUNINGS.standard).strings;
  const lo = tuning[0], hi = tuning[5] + 24;
  const canOut = person.kind === 'bluesy' || person.kind === 'funky';
  const kw = (k: JointKind) => (ask.only ? (ask.only === k ? 1 : 0) : person.join[k] ?? 1);
  const out: ShortMove[] = [];

  /** The note struck, then the lean notes one after the other to the end of its time. */
  const build = (kind: JointKind, leans: { pitch: number; out?: boolean }[], label: string, w: number) => {
    const k = leans.length;
    if (leans.some((x) => x.pitch < lo || x.pitch > hi || x.pitch === n.midi || Math.abs(x.pitch - N) > 5)) return;
    // (the note keeps at least as much time as any one lean note)
    const d = k === 1 ? (L < 3 ? 1 : rng.pick([1, 1.5])) : snap(L / 3);
    const aLen = snap(L - k * d);
    if (d < dMin - 1e-6 || aLen < d - 1e-6) return;
    const events: PEvent[] = [{ t: n.t, len: aLen, base: n.i, hit: { ...h, len: aLen } }];
    let t = n.t + aLen;
    let prev = n.midi;
    for (const l of leans) {
      if (l.pitch === prev) return;
      const legato = Math.abs(l.pitch - prev) <= 4 && rng.chance(legatoOf(s, person, d));
      events.push(pieceOf(s, t, d, l.pitch, { art: legato ? 'legato' : 'pick', vel: h.vel * 0.82, out: l.out }));
      t += d;
      prev = l.pitch;
    }
    // (the way into the next note costs what the mood says of its size; the weight is scaled up to stand beside a touch on the note)
    out.push({ events, kind, label, w: 2.2 * w * Math.exp(-intervalCost(P, prev, N, 0, false) / 1.5) });
  };

  // ---- the scale notes between the two, the last one or two of them
  const between = [];
  for (let i = a + dir; i !== b; i += dir) between.push(notes[i]);
  if (kw('pass') > 0 && between.length >= 1 && Math.abs(N - n.midi) <= 9) {
    const k = between.length >= 2 && (L >= 3 || person.kind === 'shredder') && rng.chance(0.6) ? 2 : 1;
    build('pass', between.slice(-k).map((pitch) => ({ pitch })), `passes through ${k} scale note${k > 1 ? 's' : ''} toward the next`, kw('pass') * (0.7 + 0.5 * Math.max(0, want.agitation + 0.3)));
  }

  // ---- the scale note just beyond the next note, and back
  if (kw('approach') > 0 && b + dir >= 0 && b + dir < notes.length) {
    build('approach', [{ pitch: notes[b + dir] }], 'leans into the next from beyond it', kw('approach') * (0.7 + 0.5 * Math.max(0, want.ornament + 0.3)));
  }

  // ---- a half step outside the key into the next note
  if (kw('chromatic') > 0 && canOut) {
    const cands = [N - 1, N + 1].filter((p) => !pcs.has(mod(p, 12)) && p !== n.midi);
    if (cands.length) {
      const p = cands.length === 2 ? (dir > 0 ? cands[0] : cands[1]) : cands[0];
      build('chromatic', [{ pitch: p, out: true }], 'a half step outside the key into the next', kw('chromatic') * (0.7 + 0.6 * Math.max(0, want.roughness + 0.3)));
    }
  }

  // ---- the notes above and below the next note, either way round
  if (kw('enclose') > 0 && b + 1 < notes.length && b - 1 >= 0) {
    const up = notes[b + 1], down = notes[b - 1];
    const pair = rng.chance(0.5) ? [up, down] : [down, up];
    if (pair[0] !== n.midi) build('enclose', pair.map((pitch) => ({ pitch })), 'circles the next note, above and below', kw('enclose') * (0.7 + 0.6 * Math.max(0, want.ornament + 0.3)));
  }
  return out;
}
