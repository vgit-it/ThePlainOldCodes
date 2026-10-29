// Solo backing (docs/SOLO-BACKING.md): under a solo the rhythm guitar plays held chords instead of its riff or strum pattern.
// The section's chord changes stay exactly as the song wrote them; only the rhythm part changes. A riff song's guitar rings
// a power chord on each chord; a strummed song's guitar strikes the full chord once. The bass holds the root.
// The drums and the solo writers are untouched (they read the chords as they are).

import type { Idea } from '../idea';
import { chordPc } from '../theory';
import { lowestOf, powerChord } from '../theory/fretboard';
import { bassRoot, restrikes } from './energy';

/**
 * Have the band play the section's chords held. Returns the note for the section card.
 * A chord is struck when it changes, and again at the top of every second bar it carries on for.
 */
export function heldBacking(idea: Idea, from = 0, to = idea.song.total): string {
  const { song, chords } = idea;
  const part = from > 0 || to < song.total;
  let strikes = [...restrikes(song, new Set(chords.timeline.map((t) => t.step)))].sort((a, b) => a - b);
  // (only a stretch: the chord is struck as it starts)
  if (part) strikes = [...new Set([from, ...strikes.filter((g) => g > from && g < to)])].sort((a, b) => a - b);
  const lens = idea.bassLen ?? new Array<number>(song.total).fill(0);
  for (let g = from; g < to; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; lens[g] = 0; }
  idea.bassLen = lens;
  const riff = !!(idea.guitar && song.tuning);
  if (riff) {
    // (a note from before the stretch stops where it starts)
    idea.guitar = (idea.guitar ?? []).filter((h) => h.step < from || h.step >= to).map((h) => (h.step < from && h.step + h.len > from ? { ...h, len: from - h.step } : h));
  }
  strikes.forEach((g, k) => {
    const chord = chords.timeline[chords.chordIdx[g]].chord;
    const change = chords.timeline.some((t) => t.step === g);
    if (riff && song.tuning) {
      // a power chord rung until the next strike (and a little over: it rings into it)
      idea.guitar!.push({ step: g, ...powerChord(chordPc(song.key, chord), song.tuning, true), len: (strikes[k + 1] ?? to) - g + 2, vel: change ? 0.9 : 0.8 });
      let n = lowestOf(chordPc(song.key, chord), song.tuning);
      while (n > 40) n -= 12;
      idea.bass[g] = n;
    } else {
      idea.strum[g] = 'D';
      idea.bass[g] = bassRoot(song.key, chord);
    }
  });
  // the plan, for the players to read (the rhythm guitar's hands): where a chord is struck
  if (riff) idea.guitar!.sort((a, b) => a.step - b.step);
  idea.section!.soloBack = part ? { strikes, from, to } : { strikes };
  if (part) return `the song's chords held for a stretch (${strikes.length} strikes); the rhythm guitar rings them ${riff ? 'as power chords' : 'as full chords'}, the bass holds the roots`;
  return `Solo backing: the song's chords, held (${chords.timeline.length} chords in ${song.bars.length} bars); the rhythm guitar rings them ${riff ? 'as power chords' : 'as full chords'}, the bass holds the roots`;
}
