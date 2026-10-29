// Solo variation (docs/SOLO-VARY.md): a long solo (16 bars or more) is the same eight bars of band again and again.
// One stretch of it (4 or 8 bars, on a four-bar phrase, never the first four bars) gets another band feel:
//  - drums: lighter (closed hats, no crashes), half-time, or a lift (ride 8ths, a crash every bar);
//  - chords: the other section's chords (and its groove), or the song's chords held (power or full chords).
// Which one follows the genre and the mood; the solo's energy over the stretch follows it (a dip or a lift).

import type { Genre } from '../genres';
import type { Idea, SectionInfo } from '../idea';
import { Rng } from '../rng';
import type { Mood } from '../tension';
import { crashAt, shapeDrums } from './energy';
import type { Seg } from './join';

export type SoloVary = NonNullable<SectionInfo['soloVary']>[number];
type Kind = 'light' | 'half' | 'lift';

/** How likely each drum change is, by genre. */
const DRUM_G: Record<Genre, Record<Kind, number>> = {
  metal: { light: 0.5, half: 1, lift: 2 },
  hardrock: { light: 1, half: 1.2, lift: 1.2 },
  rock: { light: 1.2, half: 1, lift: 1 },
  grunge: { light: 1.2, half: 1.5, lift: 0.8 },
  altmetal: { light: 1, half: 1.2, lift: 1 },
  funk: { light: 1.5, half: 0.2, lift: 1 },
  pop: { light: 1.5, half: 0.4, lift: 1 },
};
/** And by mood: a calm one eases off, an angry one pushes. */
const DRUM_M: Record<Mood, Record<Kind, number>> = {
  happy: { light: 1, half: 0.7, lift: 1.5 },
  melancholic: { light: 2, half: 1, lift: 0.4 },
  nostalgic: { light: 1.8, half: 0.8, lift: 0.6 },
  tense: { light: 0.7, half: 1, lift: 1.6 },
  angry: { light: 0.5, half: 1, lift: 2 },
  dreamy: { light: 2, half: 0.8, lift: 0.5 },
  triumphant: { light: 0.7, half: 0.7, lift: 1.8 },
  dark: { light: 0.9, half: 1.8, lift: 1 },
};
/** What the solo's tension does over the stretch (so the tune follows the band). */
const DRUM_T: Record<VaryDrumKind, number> = { light: -0.18, half: -0.08, lift: 0.12, same: 0 };
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
  if (!r.chance(0.8)) return null;
  const kinds: Kind[] = halfOk ? ['light', 'half', 'lift'] : ['light', 'lift'];
  const stretch = ([from, to]: [number, number], held: boolean, not?: VaryDrumKind): SoloVary => {
    const drums = r.weighted<Kind>(kinds.filter((k) => k !== not).map((k) => [k, DRUM_G[genre][k] * DRUM_M[mood][k]]));
    const chords = r.weighted<SoloVary['chords']>([['other', 0.45], ['held', held ? 0.25 : 0], ['same', 0.3]]);
    // (the other section's chords bring their own groove: the drums change on top of it only half the time)
    const d: VaryDrumKind = chords === 'other' && r.chance(0.5) ? 'same' : drums;
    return { from, to, drums: d, chords };
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

/**
 * Change the drums over the stretch. The last bar of the solo (the hand-over) and the bars with a fill stay as they are.
 * Returns the note for the section card ('' when nothing changed).
 */
export function varyDrums(idea: Idea, v: SoloVary, rng: Rng): string {
  if (v.drums === 'same') return '';
  const d = idea.drums, { song } = idea, last = song.bars.length - 1;
  const filled = new Set(d.fills.map((f) => f.bar));
  const todo = song.bars.map((b, i) => ({ b, i })).filter(({ i }) => i >= v.from && i < v.to && i < last && !filled.has(i));
  const lift = () => {
    let n = 0;
    for (const { b } of todo) {
      for (let j = 0; j < b.len; j += 2) {
        const g = b.start + j;
        if (!d.hat[g] && !d.hatOpen[g] && !d.ride[g]) d.ride[g] = 0.7;
      }
      crashAt(d, b.start);
      n++;
    }
    return n;
  };
  const half = () => {
    let n = 0;
    for (const { b } of todo) {
      // (4/4 only: the snare from the 2nd and 4th beat to the 3rd)
      if (b.len !== 16 || b.groups.length !== 4) continue;
      const [s2, s3, s4] = [b.start + 4, b.start + 8, b.start + 12];
      if (d.snare[s2] < 0.5 && d.snare[s4] < 0.5) continue;
      d.snare[s3] = Math.max(0.95, d.snare[s2], d.snare[s4]);
      d.snare[s2] = 0; d.snare[s4] = 0;
      d.kick[s3] = 0;
      d.kick[b.start] = Math.max(d.kick[b.start], 0.9);
      n++;
    }
    return n;
  };
  let kind = v.drums;
  let n = 0;
  if (kind === 'half') { n = half(); if (!n) kind = 'lift'; }
  if (kind === 'lift') n = lift();
  if (kind === 'light') {
    for (const { b } of todo) { shapeDrums(idea, 2, rng, b.start, b.start + b.len); n++; }
  }
  if (!n) return '';
  const what = kind === 'light' ? 'the drums ease off (closed hats, no crashes)' : kind === 'half' ? 'the drums go to half-time' : 'the drums lift (ride on the 8ths, a crash every bar)';
  return `Solo bars ${v.from + 1}-${v.to}: ${what}`;
}
