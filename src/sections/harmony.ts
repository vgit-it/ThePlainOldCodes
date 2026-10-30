// Harmony plan: the chord moves each kind of section uses, and the helpers that apply them.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import { type Mood } from '../tension';
import { GENRES, type RiffStyle } from '../genres';
import type { ChordEvent, ChordPart, GuitarHit, Idea, Song } from '../idea';
import { Rng } from '../rng';
import { type Chord, type Mode, QUALITIES, type Quality, SCALES, chordPc, degreeChord } from '../theory';
import { chordIdxFor } from './join';

/* ------------------------------------------------------------ harmony plan */

/** A chord plan: [root in semitones above the key, length in bars]. Verses and pre-choruses end on V (or bVII) to lead into the chorus. */
/** Chords as [root (semitones above the key), bars, quality (otherwise the key's own, or major for a root outside it)]. */
export type Plan = [number, number, Quality?][];

export const MAJOR_PLANS: Record<'verse' | 'pre' | 'bridge', Plan[]> = {
  verse: [
    [[0, 2], [5, 2], [0, 2], [7, 2]], // I IV I V
    [[0, 1], [7, 1], [9, 1], [5, 1], [0, 1], [7, 1], [9, 1], [7, 1]], // I V vi IV … V
    [[9, 2], [5, 2], [0, 2], [7, 2]], // vi IV I V
    [[0, 2], [10, 2], [5, 2], [7, 2]], // I bVII IV V
    [[0, 3], [5, 1], [0, 3], [7, 1]], // I . . IV I . . V
    [[0, 4], [5, 2], [7, 2]], // I . . . IV . V .
  ],
  pre: [
    [[5, 1], [7, 1], [5, 1], [7, 1]], // IV V IV V
    [[9, 1], [5, 1], [2, 1], [7, 1]], // vi IV ii V
    [[5, 2], [7, 2]], // IV . V .
    [[2, 1], [5, 1], [7, 2]], // ii IV V .
  ],
  bridge: [
    [[9, 2], [5, 2], [0, 2], [7, 2]], // vi IV I V
    [[5, 2], [9, 2], [5, 2], [7, 2]], // IV vi IV V
    [[4, 2], [9, 2], [5, 2], [7, 2]], // iii vi IV V
    [[10, 2], [5, 2], [10, 2], [7, 2]], // bVII IV bVII V
  ],
};

export const MINOR_PLANS: Record<'verse' | 'pre' | 'bridge', Plan[]> = {
  verse: [
    [[0, 2], [8, 2], [0, 2], [7, 2]], // i bVI i v
    [[0, 2], [5, 2], [0, 2], [10, 2]], // i iv i bVII
    [[0, 1], [10, 1], [8, 1], [10, 1]], // i bVII bVI bVII
    [[0, 4], [8, 2], [10, 2]], // i . . . bVI . bVII .
    [[0, 3], [10, 1], [0, 3], [8, 1]], // i . . bVII i . . bVI
  ],
  pre: [
    [[8, 1], [10, 1], [8, 1], [10, 1]], // bVI bVII bVI bVII
    [[5, 2], [7, 2]], // iv . v .
    [[3, 2], [10, 2]], // bIII . bVII .
    [[8, 2], [10, 2]], // bVI . bVII .
  ],
  bridge: [
    [[3, 2], [10, 2], [8, 2], [7, 2]], // bIII bVII bVI v
    [[8, 2], [3, 2], [10, 2], [7, 2]], // bVI bIII bVII v
    [[5, 2], [8, 2], [10, 2], [7, 2]], // iv bVI bVII v
  ],
};

/**
 * Chords that carry a mood (docs/TENSION.md): borrowed chords (iv in a major key for melancholy and
 * nostalgia, bVI–bVII into the chorus for triumph, the Phrygian bII for darkness and unease), the V held
 * long before a chorus (tension), the major V in a minor key (a stronger pull home), and for a dreamy
 * song, no hard V at all. Used for the verses, pre-choruses and bridges about half the time.
 */
export const MOOD_PLANS: Partial<Record<Mood, Partial<Record<'major' | 'minor', Partial<Record<'verse' | 'pre' | 'bridge', Plan[]>>>>>> = {
  melancholic: {
    major: { verse: [[[0, 2], [9, 2], [5, 2], [5, 2, 'min']]], pre: [[[9, 1], [5, 1], [5, 1, 'min'], [7, 1]]], bridge: [[[5, 2], [5, 2, 'min'], [0, 2], [7, 2]]] },
    minor: { verse: [[[0, 2], [5, 2], [8, 2], [7, 2, 'maj']]], bridge: [[[8, 2], [5, 2], [0, 2], [7, 2, 'maj']]] },
  },
  nostalgic: {
    major: { verse: [[[0, 2], [4, 2], [5, 2], [5, 2, 'min']]], pre: [[[2, 1], [5, 1, 'min'], [7, 2]]], bridge: [[[5, 2], [5, 2, 'min'], [9, 2], [7, 2]]] },
    minor: { verse: [[[0, 2], [8, 2], [3, 2], [10, 2]]] },
  },
  triumphant: {
    major: { pre: [[[5, 1], [7, 1], [8, 1], [10, 1]]], bridge: [[[9, 2], [5, 2], [8, 2], [10, 2]]] },
    minor: { bridge: [[[8, 2], [10, 2], [8, 2], [10, 2]]] },
  },
  happy: { major: { bridge: [[[2, 2], [5, 2], [9, 2], [7, 2]]] }, minor: { bridge: [[[3, 2], [10, 2], [8, 2], [10, 2]]] } },
  tense: {
    major: { pre: [[[5, 1], [7, 3]]], bridge: [[[9, 2], [8, 2], [7, 4]]] },
    minor: { verse: [[[0, 3], [1, 1]]], pre: [[[8, 1], [7, 3, 'maj']]], bridge: [[[0, 2], [1, 2], [0, 2], [7, 2, 'maj']]] },
  },
  dark: {
    major: { verse: [[[0, 2], [8, 2], [10, 2], [0, 2]]], bridge: [[[8, 2], [5, 2, 'min'], [0, 2], [7, 2]]] },
    minor: { verse: [[[0, 2], [1, 2], [0, 2], [8, 2]]], bridge: [[[8, 2], [5, 2], [1, 2], [7, 2, 'maj']]] },
  },
  angry: { major: { verse: [[[0, 2], [10, 2], [5, 2], [0, 2]]], pre: [[[10, 2], [7, 2]]] } },
  dreamy: {
    major: { verse: [[[0, 2], [5, 2], [0, 2], [5, 2]]], pre: [[[5, 4]]], bridge: [[[9, 2], [4, 2], [5, 4]]] },
    minor: { verse: [[[0, 4], [8, 4]]], pre: [[[8, 4]]], bridge: [[[8, 2], [3, 2], [8, 4]]] },
  },
};

/** Choruses written for a riff that plays the verses: away from home, then back (V bVII I, IV V I…). */
export const CHORUS_PLANS: Record<'major' | 'minor', Plan[]> = {
  major: [[[7, 2], [10, 2], [0, 4]], [[5, 2], [7, 2], [0, 4]], [[10, 2], [5, 2], [0, 4]], [[5, 2], [0, 2], [7, 2], [0, 2]]],
  minor: [[[8, 2], [10, 2], [0, 4]], [[3, 2], [10, 2], [0, 4]], [[5, 2], [8, 2], [10, 2], [0, 2]], [[8, 2], [3, 2], [10, 2], [0, 2]]],
};

/** Outro jams: a short loop in the new key, round and round. */
export const JAM_PLANS: Record<'major' | 'minor', Plan[]> = {
  minor: [[[0, 1], [8, 1], [10, 1], [0, 1]], [[0, 2], [10, 1], [8, 1]], [[0, 1], [3, 1], [10, 1], [5, 1]], [[0, 1], [10, 1], [8, 1], [10, 1]]],
  major: [[[0, 1], [10, 1], [5, 1], [0, 1]], [[0, 1], [7, 1], [10, 1], [5, 1]], [[0, 2], [5, 1], [10, 1]]],
};

/** Riff verses sit on the tonic and move in the last bar. */
export const RIFF_VERSE_MOVE = { major: [10, 5, 7], minor: [10, 8, 5, 3, 7] };

export const isMinor = (m: Mode) => m === 'minor' || m === 'dorian' || m === 'phrygian';
export const plansFor = (m: Mode) => (isMinor(m) ? MINOR_PLANS : MAJOR_PLANS);

export const NUMERAL = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
export const numeral = (c: Chord) =>
  c.q === '5' ? `${NUMERAL[c.root]}5` : ['min', 'm7', 'm9'].includes(c.q) ? NUMERAL[c.root].toLowerCase() : NUMERAL[c.root];

/** "I – IV – I – V" for a block's chords. */
export function describeChords(idea: Idea): string {
  const out: string[] = [];
  for (const e of idea.chords.timeline) {
    const n = numeral(e.chord);
    if (out[out.length - 1] !== n) out.push(n);
  }
  return out.slice(0, 8).join(' – ');
}

/** A chord on `root` that fits the mode (out-of-key roots are major), coloured like the genre. */
export function chordOn(song: Song, root: number, power: boolean, rng: Rng): Chord {
  if (power) return { root, q: '5' };
  const G = GENRES[song.genre];
  const scale: readonly number[] = SCALES[song.mode];
  const d = scale.indexOf(root);
  let c: Chord = d >= 0 ? degreeChord(scale, d, !!G.seventh) : { root, q: G.seventh ? '7' : 'maj' };
  if (c.q === 'dim' || c.q === 'aug' || c.q === 'm7b5') c = { root, q: '5' };
  return G.flavor(c, rng);
}

/** Chords written from a plan (instead of random ones), before the block's other parts are written to them. */
export const planned = (song: Song, plan: Plan, rng: Rng, power: boolean) => (c: ChordPart): ChordPart => {
  const byRoot = new Map<string, Chord>(); // the same chord every time a root comes back
  const timeline: ChordEvent[] = [];
  for (let bi = 0, k = 0; bi < song.bars.length; k++) {
    const [root, n, q] = plan[k % plan.length];
    const id = `${root}${q ?? ''}`;
    if (!byRoot.has(id)) byRoot.set(id, q && !power ? GENRES[song.genre].flavor({ root, q }, rng) : chordOn(song, root, power, rng));
    timeline.push({ step: song.bars[bi].start, chord: byRoot.get(id)! });
    bi += n;
  }
  return { timeline, chordIdx: chordIdxFor(timeline, c.chordIdx.length), notes: [] };
};

/** Riff styles that want real chords rather than power chords. */
export const chordal = (s: RiffStyle) => s === 'arp' || s === 'picked' || s === 'lick';

/**
 * A dominant pedal: the bass holds the key's 5th in 8ths over the last `n` bars (the chords moving above
 * it), a classic build. Only where the 5th sits well under every chord there (a chord note, or the 9th of
 * IV, the 11th of ii, the 6th of bVII); false if it doesn't.
 */
export function pedalBass(idea: Idea, n: number): boolean {
  const { song, chords, bass } = idea;
  const bars = song.bars.slice(-Math.min(n, song.bars.length));
  const from = bars[0].start, to = song.total;
  const pc = (song.key + 7) % 12;
  for (let g = from; g < to; g++) {
    const c = chords.timeline[chords.chordIdx[g]].chord;
    const tones = QUALITIES[c.q].map((x) => (chordPc(song.key, c) + x) % 12);
    if (!tones.includes(pc) && ![2, 5, 10].includes(c.root)) return false;
  }
  const heard = bass.slice(from, to).filter(Boolean);
  const mid = heard.length ? heard.reduce((a, b) => a + b, 0) / heard.length : 40;
  const m = pc + 12 * Math.round((mid - pc) / 12);
  for (let g = from; g < to; g++) {
    bass[g] = (g - from) % 2 === 0 ? m : 0;
    if (idea.bassLen) idea.bassLen[g] = bass[g] ? 2 : 0;
  }
  return true;
}

/** Move a whole section up (a key change for the last chorus). */
export function transpose(idea: Idea, n: number) {
  idea.song = { ...idea.song, key: (idea.song.key + n) % 12 };
  idea.bass = idea.bass.map((m) => (m ? m + n : 0));
  const up = (h: GuitarHit): GuitarHit => ({ ...h, notes: h.notes.map((m) => m + n) });
  if (idea.guitar) idea.guitar = idea.guitar.map(up);
  idea.guitar2 = idea.guitar2.map(up);
  // (a planned solo's landings and gaps are notes too)
  const sc = idea.soloCurve;
  if (sc?.landings) sc.landings = sc.landings.map((l) => ({ ...l, midi: l.midi + n }));
  if (sc?.gaps) sc.gaps = sc.gaps.map((g) => ({ ...g, from: g.from && { ...g.from, midi: g.from.midi + n }, to: g.to && { ...g.to, midi: g.to.midi + n } }));
}

