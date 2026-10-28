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
export function heldBacking(idea: Idea): string {
  const { song, chords } = idea;
  const strikes = [...restrikes(song, new Set(chords.timeline.map((t) => t.step)))].sort((a, b) => a - b);
  const lens = idea.bassLen ?? new Array<number>(song.total).fill(0);
  for (let g = 0; g < song.total; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; lens[g] = 0; }
  idea.bassLen = lens;
  const riff = !!(idea.guitar && song.tuning);
  if (riff) idea.guitar = [];
  strikes.forEach((g, k) => {
    const chord = chords.timeline[chords.chordIdx[g]].chord;
    const change = chords.timeline.some((t) => t.step === g);
    if (riff && song.tuning) {
      // a power chord rung until the next strike (and a little over: it rings into it)
      idea.guitar!.push({ step: g, ...powerChord(chordPc(song.key, chord), song.tuning, true), len: (strikes[k + 1] ?? song.total) - g + 2, vel: change ? 0.9 : 0.8 });
      let n = lowestOf(chordPc(song.key, chord), song.tuning);
      while (n > 40) n -= 12;
      idea.bass[g] = n;
    } else {
      idea.strum[g] = 'D';
      idea.bass[g] = bassRoot(song.key, chord);
    }
  });
  // the plan, for the players to read (the rhythm guitar's hands): where a chord is struck
  idea.section!.soloBack = { strikes };
  return `Solo backing: the song's chords, held (${chords.timeline.length} chords in ${song.bars.length} bars); the rhythm guitar rings them ${riff ? 'as power chords' : 'as full chords'}, the bass holds the roots`;
}
