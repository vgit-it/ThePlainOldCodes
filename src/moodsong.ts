// Mood song (docs/MOOD-SONG.md): the mood chooses the song's mode, tempo and drum feel, not only how it builds.
// The genre still picks the pool: a mood chooses among the modes the genre uses (hard rock: major, mixolydian, minor),
// and the tempo moves from the genre's own. Pure: no chance, so the song around it stays as it was.

import type { Mode } from './theory';
import type { Mood } from './tension';

/** What the page asks for: the mood the song is written for, and which of its parts follow it. */
export interface MoodSong { mood: Mood; tempo?: boolean; mode?: boolean }

/** From dark to bright. */
const BRIGHT: Record<Mode, number> = { phrygian: 1, minor: 2, dorian: 3, mixolydian: 4, major: 5, lydian: 6 };
/** How bright each mood wants its mode. */
const WANT: Record<Mood, number> = { happy: 5, triumphant: 5.5, nostalgic: 4, dreamy: 4.5, melancholic: 2, angry: 2, dark: 1.5, tense: 1 };
/** Times the genre's tempo. */
const TEMPO: Record<Mood, number> = { happy: 1.04, triumphant: 1.05, nostalgic: 0.9, dreamy: 0.8, melancholic: 0.82, angry: 1.08, dark: 0.88, tense: 1 };
/** Moods that sit back in a half-time feel when the tempo is still fast. */
const HALF: Mood[] = ['melancholic', 'dark', 'dreamy'];
/** At this tempo or faster, a slow mood's drums play half-time. */
export const HALF_FROM = 100;

/** The mode of the genre's own that is nearest what the mood wants; a tie goes to the mode the song rolled. */
export function moodMode(pool: readonly Mode[], mood: Mood, rolled: Mode): Mode {
  const want = WANT[mood];
  let best = rolled;
  let bestD = pool.includes(rolled) ? Math.abs(BRIGHT[rolled] - want) : Infinity;
  for (const m of pool) {
    const d = Math.abs(BRIGHT[m] - want);
    if (d < bestD - 1e-9) { best = m; bestD = d; }
  }
  return best;
}

/** The genre's tempo, moved by the mood. */
export const moodTempo = (bpm: number, mood: Mood) => Math.round(Math.max(50, Math.min(200, bpm * TEMPO[mood])));

/** Half-time drums for a slow mood whose tempo is still fast (the feel, not the tempo, then does the slowing). */
export const moodHalf = (bpm: number, mood: Mood) => HALF.includes(mood) && bpm >= HALF_FROM;
