// Guitar 2 and the lead extras: rewriting guitar 2, room, breaks and twin lead.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import { type Genre } from '../genres';
import type { Idea } from '../idea';
import { type G2Options, type Guitar2Style, chordTones, generateGuitar2, pickStyle } from '../parts/guitar2';
import { type LickKind } from '../players/lead';
import { Rng } from '../rng';
import { SCALES } from '../theory';

/* ------------------------------------------------------------ guitar 2 */

export const runCount = (idea: Idea) => Math.ceil(idea.song.bars.length / 4);

/** Rewrite guitar 2 for a section: forced roles, or picked like an idea (undefined). Returns its description. */
export function writeGuitar2(idea: Idea, o: G2Options, rng: Rng, force?: Guitar2Style[], lick?: LickKind): string {
  const g2 = generateGuitar2(rng, idea.song, idea.chords, idea.guitar ?? null, force, lick, o);
  idea.guitar2 = g2.hits;
  return g2.notes[0];
}

/** Figures (docs/LEAD-FIGURES.md): the chance a song's verses have a picked figure on Guitar 2, by genre (real songs: picked figures are 26% of lead bars in pop, 13-15% in rock and grunge). */
export const FIGURE_SONGS: Record<Genre, number> = { pop: 0.7, rock: 0.5, grunge: 0.5, altmetal: 0.4, hardrock: 0.25, metal: 0.2, funk: 0.3 };

/**
 * Room (docs/LEAD-ROOM.md): the chance the lead guitar keeps out from under the singer's lines through a
 * four-bar run, by genre. Real lead guitar plays while the singer sings 15% of its notes in metal, 21% in
 * hard rock, 35% in funk; about half in pop, rock, grunge and alt metal, as the app did (docs/STUDY-LEAD.md).
 */
export const ROOM: Record<Genre, number> = { metal: 0.7, hardrock: 0.8, funk: 0.7, pop: 0.1, rock: 0, grunge: 0, altmetal: 0 };

/**
 * Room: in the runs where the lead keeps out of the way, Guitar 2's notes under a sung line go, and notes
 * ringing into one stop where it starts; what's left plays in the gaps (answers, fills, the end of a
 * verse into the chorus). Solos and sections with no singing are left alone.
 */
export function makeRoom(sections: Idea[], genre: Genre, seed: string) {
  const rng = new Rng(seed);
  for (const x of sections) {
    const voc = x.vocal ?? [];
    if (x.section?.solo || !voc.length || !x.guitar2.length) continue;
    // the sung lines (gaps under a beat joined)
    const lines: [number, number][] = [];
    for (const n of voc) {
      const l = lines[lines.length - 1];
      if (l && n.step - l[1] < 4) l[1] = Math.max(l[1], n.step + n.len);
      else lines.push([n.step, n.step + n.len]);
    }
    const bars = x.song.bars;
    const clear = new Set<number>(); // runs of four bars
    for (let r = 0; r * 4 < bars.length; r++) if (rng.chance(ROOM[genre])) clear.add(r);
    const runOf = (g: number) => Math.floor(Math.max(0, bars.findIndex((b) => g >= b.start && g < b.start + b.len)) / 4);
    const under = (g: number) => lines.some(([a, b]) => g >= a - 1 && g < b);
    x.guitar2 = x.guitar2.filter((h) => !(clear.has(runOf(h.step)) && under(h.step)));
    for (const h of x.guitar2) {
      if (!clear.has(runOf(h.step))) continue;
      const next = lines.find(([a]) => a > h.step);
      if (next && h.step + h.len > next[0]) h.len = Math.max(1, Math.floor(next[0] - h.step));
    }
  }
}

/**
 * Breaks (docs/LEAD-BREAKS.md): in songs with no solo, the chance there's no lead guitar at all (real songs
 * with a lead guitar: pop 29%, funk 36%, rock 48%; docs/STUDY-LEAD.md), else of a short lead break after a
 * chorus (real pop and funk songs with a lead: 54% / 76% have one; the app's pop 25%, funk 13%).
 */
export const NO_LEAD: Record<Genre, number> = { pop: 0.65, funk: 0.6, altmetal: 0.5, rock: 0.3, grunge: 0.25, hardrock: 0.1, metal: 0.05 };
export const BREAK: Record<Genre, number> = { pop: 0.45, funk: 0.7, rock: 0.5, grunge: 0.5, altmetal: 0.5, hardrock: 0.5, metal: 0.5 };

/**
 * Twin (docs/LEAD-TWIN.md): the chance a song has a second lead guitar on the hook and lead lines, not the solo (real
 * hard rock and metal songs with a lead: 55% have a second lead line, 70% of those in the same bars), and
 * what it plays: a harmony a scale 3rd up, an octave below, or the same notes (a double).
 */
export const mod = (n: number, m: number) => ((n % m) + m) % m;
export type TwinKind = 'harmony' | 'octave' | 'double';
export const TWIN: Record<Genre, number> = { hardrock: 0.55, metal: 0.55, rock: 0.3, grunge: 0.2, altmetal: 0.15, pop: 0.1, funk: 0.1 };
export const TWIN_KINDS: Record<Genre, [TwinKind, number][]> = {
  metal: [['harmony', 3], ['octave', 1], ['double', 1]], hardrock: [['harmony', 2], ['double', 2], ['octave', 1]],
  rock: [['double', 2], ['octave', 2], ['harmony', 1]], grunge: [['octave', 2], ['double', 2]], altmetal: [['octave', 2], ['double', 2]],
  pop: [['double', 2], ['octave', 1], ['harmony', 1]], funk: [['octave', 2], ['double', 1]],
};

/** Twin: a second lead guitar on Guitar 2's notes from step `from` (a harmony stays a double where it would rub on a held note). */
export function addTwin(idea: Idea, kind: TwinKind, from: number) {
  const { key, mode, total } = idea.song;
  const sc: readonly number[] = SCALES[mode];
  const chordAt = (g: number) => idea.chords.timeline[idea.chords.chordIdx[Math.min(g, total - 1)]].chord;
  const third = (m: number, g: number, held: boolean) => {
    const d = sc.indexOf(mod(m - key, 12));
    const up = m + (d < 0 ? 3 : mod(sc[(d + 2) % 7] - sc[d], 12));
    const tones = chordTones(key, chordAt(g));
    return held && tones.some((t) => [1, 11].includes(mod(up - t, 12))) ? m : up;
  };
  idea.guitar2 = idea.guitar2.map((h) => {
    if (h.step < from || h.swell || h.mute) return h;
    const twin = kind === 'double' ? [...h.notes] : kind === 'octave' ? h.notes.map((m) => (m >= 64 ? m - 12 : m + 12)) : h.notes.map((m) => third(m, h.step, h.len >= 4));
    return { ...h, twin };
  });
}

/** A role that plays (not 'rest'), picked as for an idea. */
export function playingStyle(rng: Rng, idea: Idea, run: number): Guitar2Style {
  const sec = idea.song.sections?.[run * 4] ?? null;
  for (let i = 0; i < 6; i++) {
    const s = pickStyle(rng, idea.song.partGenres.strum, sec);
    if (s !== 'rest') return s;
  }
  return 'lead';
}


