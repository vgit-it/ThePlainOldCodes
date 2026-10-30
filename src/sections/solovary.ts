// Solo variation (docs/SOLO-VARY.md): a long solo (16 bars or more) is the same eight bars of band again and again.
// One stretch of it (4 or 8 bars, on a four-bar phrase, never the first four bars) gets another band feel:
//  - drums: a breakdown or heavy half-time (a different groove, always; see varyDrums);
//  - chords: the other section's chords (and its groove), or the song's chords held (power or full chords).
// Which one follows the genre and the mood; the solo's energy over the stretch follows it (a dip or a lift).

import type { Genre } from '../genres';
import type { Idea, SectionInfo } from '../idea';
import { Rng } from '../rng';
import type { Mood } from '../tension';
import { groupStarts } from '../rhythm';
import { crashAt } from './energy';
import type { Seg } from './join';

export type SoloVary = NonNullable<SectionInfo['soloVary']>[number];
type Kind = 'light' | 'half';

/** How likely each drum change is, by genre. */
const DRUM_G: Record<Genre, Record<Kind, number>> = {
  metal: { light: 1, half: 1 },
  hardrock: { light: 1, half: 1.2 },
  rock: { light: 1.2, half: 1 },
  grunge: { light: 1.2, half: 1.5 },
  altmetal: { light: 1, half: 1.2 },
  funk: { light: 1.5, half: 0.2 },
  pop: { light: 1.5, half: 0.4 },
};
/** And by mood: a calm one eases off, an angry one goes heavy. */
const DRUM_M: Record<Mood, Record<Kind, number>> = {
  happy: { light: 1, half: 0.7 },
  melancholic: { light: 2, half: 1 },
  nostalgic: { light: 1.8, half: 0.8 },
  tense: { light: 0.7, half: 1 },
  angry: { light: 0.5, half: 1 },
  dreamy: { light: 2, half: 0.8 },
  triumphant: { light: 0.7, half: 0.7 },
  dark: { light: 0.9, half: 1.8 },
};
/** What the solo's tension does over the stretch (so the tune follows the band). */
const DRUM_T: Record<VaryDrumKind, number> = { light: -0.18, half: -0.08, same: 0 };
type VaryDrumKind = SoloVary['drums'];

/** Where a stretch can sit, by the solo's length (bars from, bars up to). */
const SPANS: Record<number, [number, number][]> = {
  16: [[4, 8], [8, 12], [8, 16], [8, 12], [4, 8], [12, 16]],
  24: [[8, 16], [16, 24], [8, 12], [16, 20], [12, 16], [8, 16]],
};
/** A 24-bar solo's two stretches (four bars or more apart; an 8-bar one starts on a bar 8 or 16). */
const PAIRS_24: [[number, number], [number, number]][] = [
  [[4, 8], [12, 16]], [[4, 8], [16, 20]], [[8, 12], [16, 20]], [[8, 12], [20, 24]],
  [[4, 8], [16, 24]], [[8, 16], [20, 24]], [[4, 8], [20, 24]], [[12, 16], [20, 24]],
];

/**
 * Whether this solo gets a stretch (two in a solo of 24 bars, the second a different change), where, and how.
 * `halfOk`: 4/4 and not half-time already.
 * `heldAll`: the whole solo is held chords already (Solo backing), so a held stretch would be no change.
 */
export function planVary(seed: string, bars: number, genre: Genre, mood: Mood, halfOk: boolean, heldAll: boolean): SoloVary[] | null {
  if (bars < 16) return null;
  const r = new Rng(seed);
  const kinds: Kind[] = halfOk ? ['light', 'half'] : ['light'];
  const stretch = ([from, to]: [number, number], held: boolean, not?: VaryDrumKind): SoloVary => {
    // (a second stretch takes the other change; with one change on offer, the same again)
    const other = kinds.filter((k) => k !== not), pool = other.length ? other : kinds;
    const drums = r.weighted<Kind>(pool.map((k) => [k, DRUM_G[genre][k] * DRUM_M[mood][k]]));
    const chords = r.weighted<SoloVary['chords']>([['other', 0.45], ['held', held ? 0.25 : 0], ['same', 0.3]]);
    return { from, to, drums, chords };
  };
  if (bars >= 24 && r.chance(0.7)) {
    const [a, b] = r.pick(PAIRS_24);
    const first = stretch(a, !heldAll);
    // (one held stretch at most: the plan for the players has one range)
    return [first, stretch(b, false, first.drums)];
  }
  const spans = SPANS[bars >= 24 ? 24 : 16].filter(([, to]) => to <= bars);
  return [stretch(r.pick(spans), !heldAll)];
}

/** The bars `start` to `start + n` of a list of segments. */
function sliceBars(segs: Seg[], start: number, n: number): Seg[] {
  const out: Seg[] = [];
  let pos = 0;
  for (const s of segs) {
    const a = Math.max(start, pos), b = Math.min(start + n, pos + s.n);
    if (b > a) out.push({ ...s, from: s.from + (a - pos), n: b - a });
    pos += s.n;
  }
  return out;
}

/** The solo's segments with each 'other chords' stretch's bars taken from the other section's eight (same bar of the eight). */
export function varySegs(main: Seg[], other: Seg[], plan: SoloVary[]): Seg[] {
  const total = main.reduce((a, s) => a + s.n, 0);
  const out: Seg[] = [];
  let at = 0;
  for (const v of [...plan].filter((x) => x.chords === 'other').sort((a, b) => a.from - b.from)) {
    out.push(...sliceBars(main, at, v.from - at), ...sliceBars(other, v.from % 8, v.to - v.from));
    at = v.to;
  }
  return at ? [...out, ...sliceBars(main, at, total - at)] : main;
}

/** The tension over the stretches: a dip or a lift (a copy). */
export function varyTension(tt: number[], plan: SoloVary[]): number[] {
  return tt.map((x, i) => {
    const v = plan.find((y) => i >= y.from && i < y.to);
    return v ? Math.max(0, Math.min(1, x + DRUM_T[v.drums])) : x;
  });
}

/** Genres whose breakdown stays kick-led (the kick pattern is kept, the rest drops away). */
const HEAVY = new Set<Genre>(['metal', 'hardrock', 'altmetal']);
const LANES = ['kick', 'snare', 'hat', 'hatOpen', 'ride', 'crash', 'tom'] as const;

/**
 * Change the drums over the stretch, to another groove (not a tweak of the same one). The last bar of the solo (the hand-over)
 * and the bars with a fill stay as they are.
 *  - light, a breakdown: no snare, no cymbals but quiet hats on the beats; the kick on the 1 (kick-led genres keep their kick pattern);
 *  - half, heavy half-time: one snare on the 3rd beat, one kick on the 1, slow hats, a crash or an open hat on the 1;
 * Returns the note for the section card ('' when nothing changed).
 */
export function varyDrums(idea: Idea, v: SoloVary, _rng: Rng): string {
  if (v.drums === 'same') return '';
  const d = idea.drums, { song } = idea, last = song.bars.length - 1;
  const genre = song.partGenres.drums;
  const filled = new Set(d.fills.map((f) => f.bar));
  const todo = song.bars.map((b, i) => ({ b, i })).filter(({ i }) => i >= v.from && i < v.to && i < last && !filled.has(i));
  type Bar = (typeof todo)[number]['b'];
  const wipe = (b: Bar) => { for (const l of LANES) d[l].fill(0, b.start, b.start + b.len); };
  const beats = (b: Bar) => groupStarts(b.groups).map((p) => b.start + p);
  const four = (b: Bar) => b.len === 16 && b.groups.length === 4;
  const breakdown = () => {
    for (const { b, i } of todo) {
      const kicks = HEAVY.has(genre) ? Array.from({ length: b.len }, (_, j) => d.kick[b.start + j] * 0.85) : null;
      wipe(b);
      if (kicks) kicks.forEach((k, j) => { d.kick[b.start + j] = k; });
      d.kick[b.start] = Math.max(d.kick[b.start], 0.85);
      // (a lone kick on the 3rd beat every other bar, so the pulse is felt)
      if (!kicks && four(b) && (i - v.from) % 2) d.kick[b.start + 8] = 0.7;
      beats(b).forEach((g, j) => { d.hat[g] = j ? 0.38 : 0.44; });
    }
    return todo.length;
  };
  const half = () => {
    let n = 0;
    for (const { b, i } of todo) {
      // (4/4 only)
      if (!four(b) || (d.snare[b.start + 4] < 0.5 && d.snare[b.start + 12] < 0.5)) continue;
      const hats = beats(b).map((g) => d.hat[g] || d.ride[g] || 0.6);
      const and2 = d.kick[b.start + 6] ? 0.8 : 0;
      wipe(b);
      d.snare[b.start + 8] = 1;
      d.kick[b.start] = 1;
      d.kick[b.start + 6] = and2;
      beats(b).forEach((g, j) => { d.hat[g] = hats[j]; });
      // (a crash on the 1 every other bar; an open hat on the 1 in between)
      if ((i - v.from) % 2 === 0) crashAt(d, b.start);
      else { d.hat[b.start] = 0; d.hatOpen[b.start] = 0.7; }
      n++;
    }
    return n;
  };
  let kind = v.drums;
  let n = 0;
  // (half-time needs 4/4 bars with a backbeat; where it finds none, the breakdown)
  if (kind === 'half') { n = half(); if (!n) kind = 'light'; }
  if (kind === 'light') n = breakdown();
  if (!n) return '';
  const what = kind === 'light'
    ? (HEAVY.has(genre) ? 'a breakdown (the kick leads, no snare, quiet hats)' : 'a breakdown (kick on the 1, no snare, quiet hats on the beats)')
    : 'heavy half-time (one big kick, one big snare, slow hats)';
  return `Solo bars ${v.from + 1}-${v.to}: the drums go to ${what}`;
}
