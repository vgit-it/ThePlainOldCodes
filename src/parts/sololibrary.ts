// The named licks (src/recipes/licks.json, docs/RECIPE-LAB.md) as recipes for the story told in licks (docs/SOLO-LIBRARY.md). Each live lick
// has the job Paul marked on it in the recipe lab; where nothing is marked yet, the lab's own guess from the notes (`guessOf`) stands in.
// A part of the story asks for the licks that do its job, and the genre and the mood lean the pick. The writer in solorecipes.ts fits the
// chosen lick into the part (placeLibLick) like any recipe.

import licksFile from '../recipes/licks.json';
import { guessOf } from '../recipes/facts';
import type { LickFile, Role } from '../recipes/library';
import type { Mood } from '../tension';
import { LIBRARY, type LibLick } from './licks';

export interface PoolLick {
  lick: LibLick;
  /** The jobs it does: marked, else guessed. */
  roles: Role[];
  genres: string[];
  moods: string[];
  /** True where the roles are the lab's guess, not Paul's mark. */
  guessed: boolean;
}

/** The live licks (the same list and order as LIBRARY) with what they are for. */
export const POOL: PoolLick[] = (licksFile as LickFile).licks.filter((l) => l.status === 'live').map((l, i) => {
  const g = guessOf(l), marked = !!l.role?.length;
  return { lick: LIBRARY[i], roles: marked ? l.role! : g.role, genres: l.genres?.length ? l.genres : g.genres, moods: l.moods?.length ? l.moods : g.moods, guessed: !marked };
});

/** The jobs a lick may do in each part of the story. */
export const JOBS: Record<string, Role[]> = {
  statement: ['phrase', 'lead-in', 'tag'],
  answer: ['phrase', 'lead-in', 'tag'],
  return: ['phrase', 'lead-in', 'tag'],
  build: ['build', 'fill', 'lead-in'],
  ramp: ['ramp', 'build'],
  release: ['release', 'ending'],
  /** A piece in the middle of a gap being strung together. */
  fill: ['fill', 'tag', 'lead-in', 'phrase', 'build'],
};

/** The licks that do one of the jobs and fit in `room` 16ths, each with a weight: the genre and the mood lean it, a marked lick beats a guess. */
export function poolFor(jobs: Role[], genre: string, mood: Mood, room: number): [PoolLick, number][] {
  return POOL.filter((x) => x.lick.span <= room + 8 && x.roles.some((r) => jobs.includes(r)))
    .map((x) => [x, (x.genres.includes(genre) ? 2 : 1) * (x.moods.includes(mood) ? 1.5 : 1) * (x.guessed ? 1 : 1.5) * (x.roles[0] === jobs[0] ? 1.5 : 1)] as [PoolLick, number]);
}
