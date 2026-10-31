// Which parts of a track play through a wah pedal (docs/WAH.md). Behind the "Wah pedal" switch.
//  - Funk: the rhythm guitar on an auto-wah (the picking makes it quack), in some songs.
//  - Leads: a cocked wah (the pedal parked half way: nasal, vocal) in the solos and lead breaks, in some songs.
//    Of those, some rock the pedal on the long held notes (heel to toe, a beat a rock) instead of leaving it parked.
// A song decides once: it either has the wah or not, so a section never changes the story half way.
// Pure and deterministic, like the rest of the generator.

import type { Genre } from '../genres';
import type { SectionInfo } from '../idea';
import { Rng } from '../rng';
import type { WahMode } from '../audio/wah';

/** What a section plays through the wah (a part missing: none). */
export interface SectionWah { chords?: WahMode; guitar2?: WahMode }

/** The share of songs whose rhythm guitar has an auto-wah. */
export const AUTO_CHANCE: Partial<Record<Genre, number>> = { funk: 0.6 };
/** The share of songs whose solos have a cocked wah. */
export const COCKED_CHANCE: Record<Genre, number> = { rock: 0.35, pop: 0.1, funk: 0.5, hardrock: 0.5, metal: 0.2, grunge: 0.3, altmetal: 0.2 };

/** The share of the songs with a lead wah where the pedal is rocked on held notes. */
export const ROCK_CHANCE: Record<Genre, number> = { rock: 0.5, pop: 0, funk: 0.4, hardrock: 0.6, metal: 0.3, grunge: 0.4, altmetal: 0.3 };

const electric = (s?: string) => !!s && s.startsWith('electric');

/** The wah of every section (`undefined`: none), for a song of this genre. */
export function planWah(seed: string, genre: Genre, sections: SectionInfo[]): (SectionWah | undefined)[] {
  const r = new Rng(`${seed}-wah`);
  const auto = r.chance(AUTO_CHANCE[genre] ?? 0);
  const cocked = r.chance(COCKED_CHANCE[genre]);
  // (drawn last, so the songs that had a cocked wah keep it)
  const rock = r.chance(ROCK_CHANCE[genre]);
  return sections.map((s) => {
    const w: SectionWah = {};
    // (a quiet intro with the guitar alone stays plain; the wah comes in with the band)
    if (auto && electric(s.sound?.chords) && s.bandFrom === undefined) w.chords = 'auto';
    if (cocked && (s.solo || s.lead) && electric(s.sound?.guitar2)) w.guitar2 = rock ? 'rock' : 'cocked';
    return w.chords || w.guitar2 ? w : undefined;
  });
}
