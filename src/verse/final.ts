// The song's last chorus (docs/VOCAL-FINAL.md): the singer goes where the band goes.
//  - After a key change the chorus is the same tune moved up by the step the band moved (`moveKey`). Always on: without it the singer
//    stays in the old key while the band plays in the new one.
//  - A lifted last chorus (switch): without a key change the same tune is sung about a third higher, each chord note moved up to a
//    chord note, passing notes kept passing (`liftBuilt`). Rhythm, words and phrases stay as they are; only the pitches move.
// Pure: it reads the finished notes and gives new ones.

import type { Built } from './build';
import type { BandNote, Range } from './verse';
import { SCALES, type Chord, type Mode } from '../theory';
import { chordTones } from '../parts/guitar2';

/** How far the last chorus lifts when the key stays (semitones, about): a minor third. The chord notes are three or four apart, so a chord note lands on the next one up. */
export const LAST_LIFT = 3;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The pitches of a note moved by `by` semitones: its own, its bend inside, and the moves after that. */
function shifted(n: BandNote, by: number): BandNote {
  return {
    ...n, midi: n.midi + by,
    ...(n.bendTo !== undefined ? { bendTo: n.bendTo + by } : {}),
    ...(n.more ? { more: n.more.map((m) => ({ ...m, to: m.to + by })) } : {}),
  };
}

/** How far to move a melody written in `from` so that it is in `to`: the shortest way, up or down (-5 to 6). */
export const keyStep = (from: number, to: number): number => { const d = mod(to - from, 12); return d > 6 ? d - 12 : d; };

/** A melody written in one key, sung in another: every note moved by the same step, so it is still on the same notes of the chords. */
export function moveKey(b: Built, by: number): Built {
  if (!by) return b;
  return { ...b, notes: b.notes.map((n) => shifted(n, by)), goals: b.goals.map((g) => ({ ...g, midi: g.midi + by })) };
}

/** Whether the melody moved by `by` still fits the voice's far limits. */
export const fits = (b: Built, by: number, range: Range): boolean => b.notes.every((n) => n.midi + by <= range.xhi && n.midi + by >= range.xlo && (n.bendTo === undefined || n.bendTo + by <= range.xhi));

/**
 * The same tune higher inside the key. A chord note moves up to a chord note of the chord under it (the next one up: the root to the
 * 3rd, the 3rd to the 5th, the 5th to the root), a passing note to a scale note that is not (most of the time), each one the nearest to
 * `by` semitones up and always above where it was. A note that would pass the voice's top stays where it was.
 */
export function liftBuilt(b: Built, by: number, key: number, mode: Mode, chordAt: Chord[], range: Range): Built {
  const scale = new Set(SCALES[mode] as readonly number[]);
  const tonesAt = new Map<Chord, Set<number>>();
  // (a chord of two notes, a power chord, takes the key's own 3rd too: the writer sings it there)
  const toneSet = (c: Chord) => {
    let s = tonesAt.get(c);
    if (!s) {
      s = new Set(chordTones(key, c));
      if (s.size <= 2) for (const d of [3, 4]) { const p = mod(key + c.root + d, 12); if (scale.has(mod(p - key, 12))) s.add(p); }
      tonesAt.set(c, s);
    }
    return s;
  };
  const notes = b.notes.map((n) => {
    const c = chordAt[Math.max(0, Math.min(chordAt.length - 1, Math.floor(n.step)))];
    if (!c) return n;
    const tones = toneSet(c), was = tones.has(mod(n.midi, 12));
    let best = 0, bestCost = Infinity;
    for (let m = n.midi + 1; m <= n.midi + by + 5; m++) {
      const isTone = tones.has(mod(m, 12));
      if (m > range.xhi || (!isTone && !scale.has(mod(m - key, 12)))) continue;
      const cost = 0.45 * Math.abs(m - (n.midi + by)) + (was ? (isTone ? 0 : 4) : isTone ? 1.5 : 0);
      if (cost < bestCost) { bestCost = cost; best = m; }
    }
    return best ? shifted(n, best - n.midi) : n;
  });
  // (the skeleton's goals are what the phrases are measured against: they move with their notes)
  const at = new Map(b.notes.map((n, i) => [n.step, notes[i].midi - n.midi]));
  return { ...b, notes, goals: b.goals.map((g) => ({ ...g, midi: g.midi + (at.get(g.step) ?? 0) })) };
}
