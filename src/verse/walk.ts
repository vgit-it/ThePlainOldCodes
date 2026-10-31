// Walk between chord notes (docs/VOCAL-REAL.md, step 1): the verse writer sits a bar on one chord note, so it repeats a note far more
// than real singers do (41% of moves against 29%) and lands on a chord note on 92% of its strong beats (real songs: 69%). This pass
// loosens the notes in between, after the mood notes and before the repeated shapes copy them:
//  - a note that repeats the one before it steps to the scale note next to it (toward the note that follows, so the line goes somewhere);
//  - a short note on a strong beat (a bar's first beat much less often) steps in from the note before, when the note after it is a chord note that
//    takes it home: a passing note on the beat, resolved, as singers do.
// Only pitches change. Rhythm, phrase first and last notes, held notes, bends, mood notes and ends are left alone. Pure: dice by position.

import { Rng } from '../rng';
import { QUALITIES, chordPc, type Chord } from '../theory';
import type { BarGrid } from './grid';
import type { BandNote, Gap, Range } from './verse';

/** How often each loosening happens where it can. */
export const WALK = { repeat: 0.45, strong: 0.5, line: 0.2 };

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** A note the pass may move: a plain short note, nothing special about it. */
const plain = (n: BandNote, beat: number): boolean =>
  n.len <= beat && !n.nb && !n.walk && !n.land && !n.third && !n.end && !n.opener && !n.lead && !n.longHold && n.slide === undefined && n.bendTo === undefined
  && n.fadeBy === undefined && n.colour === undefined && n.endRole === undefined && n.surprise === undefined && n.inner === undefined;

export interface WalkCtx { key: number; /** The pitch classes of the scale (or the pentatonic). */ scale: ReadonlySet<number>; chordAt: Chord[]; range: Range }

export function withWalk(notes: BandNote[], phrases: Gap[], G: BarGrid, c: WalkCtx, seed: string): BandNote[] {
  const out = notes.map((n) => ({ ...n }));
  const eps = 1e-6;
  const toneAt = (n: BandNote): boolean => {
    const ch = c.chordAt[Math.max(0, Math.min(c.chordAt.length - 1, Math.floor(n.step + eps)))];
    return (QUALITIES[ch.q] as readonly number[]).some((q) => (chordPc(c.key, ch) + q) % 12 === mod(n.midi, 12));
  };
  /** The scale note next to a pitch, up (+1) or down (-1), inside the voice's range. */
  const beside = (midi: number, dir: 1 | -1): number | undefined => {
    let m = midi + dir;
    for (let k = 0; k < 3 && !c.scale.has(mod(m, 12)); k++) m += dir;
    return c.scale.has(mod(m, 12)) && m >= c.range.xlo && m <= c.range.xhi ? m : undefined;
  };
  for (const g of phrases) {
    const ix = out.map((_, i) => i).filter((i) => out[i].step >= g.step - eps && out[i].step < g.step + g.len - eps).sort((a, b) => out[a].step - out[b].step);
    for (let k = 1; k + 1 < ix.length; k++) {
      const n = out[ix[k]], prev = out[ix[k - 1]], next = out[ix[k + 1]];
      if (!plain(n, G.beat)) continue;
      const rng = new Rng(`${seed}|walk|${n.step}`);
      const roll = rng.next(), side = rng.next();
      if (n.midi === prev.midi) {
        // (a repeat: step to the neighbour, toward the next note when it is somewhere else, either way when it is not)
        if (roll >= WALK.repeat) continue;
        const up = beside(n.midi, 1), down = beside(n.midi, -1);
        const dir = next.midi > n.midi ? 1 : next.midi < n.midi ? -1 : side < 0.5 ? 1 : -1;
        const m = dir === 1 ? up ?? down : down ?? up;
        if (m !== undefined && m !== next.midi) n.midi = m;
      } else if (G.isStrong(n.step) && toneAt(n) && toneAt(next) && next.midi !== n.midi) {
        // (a passing note on the beat: in from the note before by a step, home on the chord note after)
        // (a bar's first beat is the chord's place: it loosens less often)
        if (roll >= (G.isLine(n.step) ? WALK.line : WALK.strong)) continue;
        const toward = prev.midi > n.midi ? 1 : -1;
        const m = beside(n.midi, toward);
        if (m !== undefined && Math.abs(m - prev.midi) < Math.abs(n.midi - prev.midi) && m !== next.midi) n.midi = m;
      }
    }
  }
  return out;
}
