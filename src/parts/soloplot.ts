// The solo's plot (docs/SOLO-HARMONY.md, step 2). Planned from three things, with no dice for the shape:
//  - the chords (soloharmony.ts): where they ask (a waiting chord), where they answer (home), where they arrive;
//  - the section's tension across the bars (the card's arc): the slow rise and fall under everything;
//  - the mood: what kind of story it is (arrive and soar, keep asking, push, float), how late the peak comes, how high it
//    starts and how it ends.
// It gives the phrase cuts (each phrase ends where the chords make an ending: a call on a waiting chord, an answer on home,
// the loop's turn is a natural end), each phrase's part (call, answer, climax, end), the one peak (on an arrival or the
// strongest pull, by the mood) and an energy by bar that rises to the peak and lets go after it.
// Pure: the same chords, tension, mood and rng give the same plot.

import type { Rng } from '../rng';
import type { Mood } from '../tension';
import { type HarmonyMap, beatAt, chordName } from './soloharmony';

export type PlotRole = 'call' | 'answer' | 'climax' | 'end';

interface PlotKind {
  word: string;
  /** Where the peak sits (0-1 through the solo), and what it sits on: an arrival (home reached) or the strongest pull. */
  peakAt: number;
  on: 'arrive' | 'tense';
  /** The energy at the start and at the end (-1 to 1), the peak is 1. */
  start: number;
  end: number;
  /** The chance that this solo says its big thing early instead (real solos often do: docs/STUDY-SOLO.md) and then comes back to it. */
  early: number;
}

/** What story each mood tells. Real solos peak early about as often as late (docs/STUDY-SOLO.md), so the mood sets where. */
export const PLOTS: Record<Mood, PlotKind> = {
  triumphant: { word: 'arrive and soar', peakAt: 0.75, on: 'arrive', start: -0.3, end: 0.35, early: 0.15 },
  happy: { word: 'build to a bright arrival', peakAt: 0.65, on: 'arrive', start: -0.4, end: 0, early: 0.25 },
  angry: { word: 'push, hot from the start', peakAt: 0.7, on: 'tense', start: -0.1, end: 0.2, early: 0.4 },
  tense: { word: 'push on the waiting chord', peakAt: 0.7, on: 'tense', start: -0.3, end: 0.1, early: 0.3 },
  dark: { word: 'weigh on the pull, let go late', peakAt: 0.65, on: 'tense', start: -0.4, end: -0.2, early: 0.3 },
  nostalgic: { word: 'remember, then arrive', peakAt: 0.6, on: 'arrive', start: -0.5, end: -0.3, early: 0.25 },
  melancholic: { word: 'keep asking, settle low', peakAt: 0.5, on: 'tense', start: -0.5, end: -0.6, early: 0.3 },
  dreamy: { word: 'float, one soft crest', peakAt: 0.4, on: 'arrive', start: -0.4, end: -0.5, early: 0.35 },
};

export interface Plot {
  /** Phrase lengths in bars, each phrase's part, and the index of the climax phrase (-1 if the solo is one phrase). */
  lens: number[];
  roles: PlotRole[];
  climax: number;
  /** The bar the peak phrase ends on, or -1. */
  peakBar: number;
  /** Energy by bar (-1 to 1, the peak is 1), and how big the swing of height and pace is (about 1). */
  eBar: number[];
  amp: number;
  /** What the plot is, in a few words, and the lines for the card. */
  word: string;
  lines: string[];
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export interface PlotIn {
  map: HarmonyMap;
  bars: { start: number; len: number }[];
  total: number;
  /** The section's tension, a level (0-1) for each bar. */
  tension?: number[];
  mood: Mood;
  rng: Rng;
}

export function planPlot(i: PlotIn): Plot {
  const { map, bars, total, mood, rng } = i;
  const nB = bars.length, K0 = PLOTS[mood];
  // (an early peak: the big thing said in the first third, hot from the start, and the line comes back up near the end)
  const early = nB >= 6 && rng.chance(K0.early);
  const K: PlotKind = early ? { ...K0, word: `${K0.word}, said early`, peakAt: 0.3, start: Math.max(K0.start, 0.1), end: Math.min(K0.end, 0.1) } : K0;
  const endOf = (b: number) => bars[b].start + bars[b].len;
  /** The chord that sounds as bar `b` ends. */
  const endBeat = (b: number) => beatAt(map, Math.max(bars[b].start, endOf(b) - 2));
  // the section's tension, smoothed over four bars (the card's sawtooth inside a phrase is not a story), then 0-1 across the solo
  const raw = Array.from({ length: nB }, (_, b) => (i.tension?.length ? i.tension[Math.min(i.tension.length - 1, b)] : 0.5));
  const sm = raw.map((_, b) => mean(raw.slice(Math.max(0, b - 2), Math.min(nB, b + 3))));
  const lo = Math.min(...sm), hi = Math.max(...sm);
  const slow = sm.map((v) => (hi - lo > 0.02 ? (v - lo) / (hi - lo) : 0.5));
  const pullBar = bars.map((b) => mean(Array.from({ length: Math.max(1, Math.floor(b.len / 4)) }, (_, q) => beatAt(map, b.start + q * 4).pull)));
  const amp = clamp(0.55 + 0.75 * mean(raw), 0.6, 1.25);

  // one phrase when the solo is short
  if (nB <= 3) {
    const eBar = bars.map((_, b) => clamp(0.6 * (nB > 1 ? -0.4 + 1.2 * (b / (nB - 1)) : 0.3) + 0.3 * (slow[b] * 2 - 1), -1, 1));
    return { lens: [nB], roles: ['end'], climax: -1, peakBar: -1, eBar, amp, word: K.word, lines: [`plot (${K.word}): a short solo, one phrase`] };
  }

  // ---- the peak: a bar that is the last of its phrase, on an arrival or the strongest pull, near where the mood puts it
  const jit = Array.from({ length: nB + 1 }, () => rng.next() * 0.25);
  let peakBar = -1, best = -Infinity;
  const worth = (b: number, on: 'arrive' | 'tense') => {
    const eb = endBeat(b);
    if (on === 'tense') return eb.pull;
    // (an arrival counts most in the first bar or so of the home chord)
    return eb.arrival > 0 ? eb.arrival * (bars[b].start - eb.step <= bars[b].len ? 1 : 0.7) : 0;
  };
  const anyArrival = map.beats.some((b) => b.arrival > 0);
  const on = K.on === 'arrive' && !anyArrival ? 'tense' : K.on;
  for (let b = 1; b <= nB - 3; b++) {
    const f = (b + 0.5) / nB;
    const s = worth(b, on) + 0.4 * slow[b] - 1.5 * Math.abs(f - K.peakAt) + 0.1 * jit[b];
    if (s > best) { best = s; peakBar = b; }
  }

  // ---- the cuts: phrases of 2-4 bars; each ends where the chords make an ending; one phrase ends on the peak bar
  // (state: the kind of ending the phrase before made, 0 asks on a waiting chord, 1 closes on a home-ish one)
  const NEG = -1e9;
  const sc: number[][] = Array.from({ length: nB + 1 }, () => [NEG, NEG]);
  const from: [number, number][][] = Array.from({ length: nB + 1 }, () => [[-1, 0], [-1, 0]]);
  sc[0] = [0, 0];
  for (let e = 2; e <= nB; e++) {
    for (let l = 2; l <= 4; l++) {
      const j = e - l;
      if (j < 0 || (j !== 0 && j < 2)) continue;
      if (peakBar >= 0 && j <= peakBar && e > peakBar + 1) continue; // a phrase may not cross the peak bar's end
      const last = e === nB;
      const p = endBeat(e - 1).pull;
      const kind = p >= 0.4 ? 0 : 1;
      const fit = last ? 0.5 : kind === 0 ? p : 1 - p;
      const stepEnd = endOf(e - 1);
      const loop = map.loop && !last ? (stepEnd % map.loop === 0 ? 0.3 : stepEnd % (map.loop / 2) === 0 ? 0.1 : 0) : 0;
      // (each phrase costs a little, or short phrases win by count; 3 bars is the odd one out)
      const len = -1.35 + (l === 3 ? -0.1 : l === 4 ? 0.1 : 0);
      for (let t = 0; t < 2; t++) {
        if (sc[j][t] <= NEG / 2) continue;
        const alt = j > 0 && !last && t !== kind ? 0.35 : 0;
        const v = sc[j][t] + fit + loop + len + alt + 0.2 * jit[e];
        if (v > sc[e][kind]) { sc[e][kind] = v; from[e][kind] = [j, t]; }
      }
    }
  }
  const lens: number[] = [], kinds: number[] = [];
  {
    let e = nB, k = sc[nB][0] >= sc[nB][1] ? 0 : 1;
    if (sc[nB][k] <= NEG / 2) {
      // (no way through: plain 2s and 3s)
      for (let rem = nB; rem > 0;) { const l = rem === 3 || rem === 5 ? 3 : 2; lens.unshift(Math.min(l, rem)); kinds.unshift(1); rem -= l; }
    } else {
      while (e > 0) { const [j, t] = from[e][k]; lens.unshift(e - j); kinds.unshift(k); e = j; k = t; }
    }
  }
  // ---- the parts
  const ends: number[] = [];
  lens.reduce((a, l) => { ends.push(a + l - 1); return a + l; }, 0);
  let climax = ends.indexOf(peakBar);
  if (climax === lens.length - 1) climax = -1;
  const roles: PlotRole[] = lens.map((_, k) => (k === lens.length - 1 ? 'end' : k === climax ? 'climax' : kinds[k] === 0 ? 'call' : 'answer'));
  const pb = climax >= 0 ? peakBar : -1;

  // ---- the energy by bar: up to the peak, let go after it; the slow tension and the chords' pull ride on top
  const mp = mean(pullBar);
  const top = pb >= 0 ? pb : Math.round(K.peakAt * (nB - 1));
  const eBar = bars.map((_, b) => {
    const shape = b <= top ? K.start + (1 - K.start) * (top > 0 ? (b / top) ** 1.3 : 1) : 1 + (K.end - 1) * ((b - top) / Math.max(1, nB - 1 - top));
    const e = 0.7 * shape + 0.2 * (slow[b] * 2 - 1) + 0.3 * (pullBar[b] - mp);
    return b === top ? 1 : clamp(e, -1, 0.9);
  });

  // ---- the card
  const where = (b: number) => `bar ${b + 1}`;
  const lines = [`plot (${K.word}${on !== K.on ? ', no arrival to land on' : ''}): ${lens.length} phrases of ${lens.join(' + ')} bars; the peak ${pb >= 0 ? `on ${chordName(endBeat(pb))} at the end of ${where(pb)}${endBeat(pb).arrival > 0 ? ' (an arrival)' : ''}` : 'none'}; energy ${eBar.map((v) => Math.round(v * 9)).join(' ')}`];
  let b0 = 0;
  lens.forEach((l, k) => {
    const eb = endBeat(b0 + l - 1);
    lines.push(`phrase ${k + 1}: bars ${b0 + 1}-${b0 + l}, ${roles[k]}, ends on ${chordName(eb)} (${eb.arrival > 0 ? 'arrival' : eb.role})`);
    b0 += l;
  });
  void total;
  return { lens, roles, climax, peakBar: pb, eBar, amp, word: K.word, lines };
}

/** The plot's energy at a step: the bars' values joined by straight lines between their middles. */
export function plotEnergyAt(p: Plot, bars: { start: number; len: number }[], g: number): number {
  const mid = (b: number) => bars[b].start + bars[b].len / 2;
  if (g <= mid(0)) return p.eBar[0];
  for (let b = 1; b < bars.length; b++) if (g <= mid(b)) { const t = (g - mid(b - 1)) / (mid(b) - mid(b - 1)); return p.eBar[b - 1] + (p.eBar[b] - p.eBar[b - 1]) * t; }
  return p.eBar[bars.length - 1];
}
