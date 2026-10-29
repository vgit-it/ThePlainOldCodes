// Mood song (docs/MOOD-SONG.md): the mood chooses the song's mode, tempo and drum feel, not only how it builds.
// The genre still picks the pool: a mood chooses among the modes the genre uses (hard rock: major, mixolydian, minor),
// and the tempo moves from the genre's own. Pure: no chance, so the song around it stays as it was.

import type { RiffStyle } from './genres';
import type { Mode } from './theory';
import type { Mood } from './tension';

/** What the page asks for: the mood the song is written for, and which of its parts follow it. */
export interface MoodSong { mood: Mood; tempo?: boolean; mode?: boolean; riff?: boolean }

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

/**
 * Mood riff (docs/MOOD-RIFF.md): how much each mood likes each riff style, times the genre's own weight for it.
 * Sad moods sit on single notes, arpeggios and low pedal notes; gallops and big chords stay for the bold ones.
 */
const RIFF_LIKES: Record<Mood, Partial<Record<RiffStyle, number>>> = {
  melancholic: { arp: 3, single: 2.5, pedal: 1.5, chug: 0.7, gallop: 0.1, big: 1, picked: 0.7, lick: 0.5 },
  dark: { pedal: 2.5, single: 2, chug: 1.5, arp: 1.5, gallop: 0.2, picked: 0.6, lick: 0.6 },
  dreamy: { arp: 4, single: 2, big: 1.2, chug: 0.3, gallop: 0.1, picked: 0.8, lick: 0.5 },
  nostalgic: { picked: 2, arp: 2, single: 1.5, lick: 1.2, chug: 0.7, gallop: 0.4 },
  tense: { pedal: 2.5, chug: 2, single: 1.5, gallop: 1, picked: 0.8, arp: 0.8, big: 0.6, lick: 0.6 },
  angry: { chug: 2.5, gallop: 1.5, big: 1.5, pedal: 1.3, picked: 0.7, arp: 0.1, lick: 0.8 },
  happy: { picked: 2, lick: 2, big: 1.5, single: 1, chug: 0.7, pedal: 0.6, arp: 0.5 },
  triumphant: { gallop: 2, big: 2, picked: 1.5, lick: 1.2, chug: 0.6, single: 0.8, arp: 0.2 },
};
export const riffLike = (mood: Mood, style: RiffStyle) => RIFF_LIKES[mood][style] ?? 1;

/** The riff's pentatonic follows the mode's 3rd: the minor one for the minor modes, the major one for major, mixolydian and lydian. */
export function riffPent(mode: Mode, blue: boolean): number[] {
  if (mode === 'phrygian' || mode === 'minor' || mode === 'dorian') return blue ? [0, 3, 5, 6, 7, 10] : [0, 3, 5, 7, 10];
  const s = [0, 4, 5, 7, mode === 'mixolydian' ? 10 : 9];
  if (mode === 'lydian') s.push(6);
  if (blue) s.push(3);
  return s.sort((a, b) => a - b);
}
