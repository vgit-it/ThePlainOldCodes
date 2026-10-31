// Which parts of a track play through a wah pedal (docs/WAH.md). Behind the "Wah pedal" switch.
//  - Funk: the rhythm guitar on an auto-wah (the picking makes it quack), in some songs.
//  - Leads: a cocked wah (the pedal parked half way: nasal, vocal) in the solos and lead breaks, in some songs.
//    Of those, some rock the pedal on the long held notes (heel to toe, a beat a rock) instead of leaving it parked.
// A song decides once: it either has the wah or not, so a section never changes the story half way.
// Pure and deterministic, like the rest of the generator.

import type { Genre } from '../genres';
import type { SectionInfo } from '../idea';
import { Rng } from '../rng';
import type { WahAmount, WahMode } from '../audio/wah';

/** What a section plays through the wah (a part missing: none). */
export interface SectionWah { chords?: WahMode; guitar2?: WahMode; /** missing: normal */ amount?: WahAmount }

/** The share of songs whose rhythm guitar has an auto-wah. */
export const AUTO_CHANCE: Partial<Record<Genre, number>> = { funk: 0.6 };
/** The share of songs whose solos have a cocked wah. */
export const COCKED_CHANCE: Record<Genre, number> = { rock: 0.35, pop: 0.1, funk: 0.5, hardrock: 0.5, metal: 0.2, grunge: 0.3, altmetal: 0.2 };

/** The share of the songs with a lead wah where the pedal is rocked on held notes. */
export const ROCK_CHANCE: Record<Genre, number> = { rock: 0.5, pop: 0, funk: 0.4, hardrock: 0.6, metal: 0.3, grunge: 0.4, altmetal: 0.3 };

const electric = (s?: string) => !!s && s.startsWith('electric');

/** The strong wah turns up in more songs (the draws stay the same, only the odds grow). */
export const STRONG_ODDS = 1.4;
export const STRONG_MAX = 0.9;

/**
 * The wah of every section (`undefined`: none), for a song of this genre.
 * Strong: more songs have it, and every lead wah is a rocking one (the pedal moves on every note). Subtle and normal pick the same songs.
 */
export function planWah(seed: string, genre: Genre, sections: SectionInfo[], amount: WahAmount = 'normal'): (SectionWah | undefined)[] {
  const r = new Rng(`${seed}-wah`);
  const strong = amount === 'strong';
  const odds = (p: number) => (strong ? Math.min(STRONG_MAX, p * STRONG_ODDS) : p);
  const auto = r.chance(odds(AUTO_CHANCE[genre] ?? 0));
  const cocked = r.chance(odds(COCKED_CHANCE[genre]));
  // (drawn last, so the songs that had a cocked wah keep it)
  const rock = r.chance(ROCK_CHANCE[genre]) || (strong && ROCK_CHANCE[genre] > 0);
  return sections.map((s) => {
    const w: SectionWah = {};
    // (a quiet intro with the guitar alone stays plain; the wah comes in with the band)
    if (auto && electric(s.sound?.chords) && s.bandFrom === undefined) w.chords = 'auto';
    if (cocked && (s.solo || s.lead) && electric(s.sound?.guitar2)) w.guitar2 = rock ? 'rock' : 'cocked';
    if (!w.chords && !w.guitar2) return undefined;
    if (amount !== 'normal') w.amount = amount;
    return w;
  });
}
