// The solo's plot (docs/SOLO-HARMONY.md, steps 2 and 2b). Planned from what the song says, with no random energy shape:
//  - the chords (soloharmony.ts): where they ask (a waiting chord), where they answer (home), where they arrive, how they loop;
//  - the section's tension across the bars (the card's arc) and the sections next to the solo: where it starts and where it must end;
//  - the mood and the genre: what kind of story it is, and which shape of energy suits it.
// The shape is one of seven families (arch, rounds, climb and hold, fall and stay low, valley, level, steps), picked by those
// signals or chosen by hand. It gives the phrase cuts (each phrase ends where the chords make an ending, and on every crest),
// each phrase's part (call, answer, climax, end), the one main peak (on an arrival or the strongest pull, by mood) and an
// energy by bar. Pure: the same chords, tension, mood and rng give the same plot.

import type { Genre } from '../genres';
import type { Rng } from '../rng';
import type { Mood } from '../tension';
import { type HarmonyMap, beatAt, chordName } from './soloharmony';

export type PlotRole = 'call' | 'answer' | 'climax' | 'end';

export type ShapeId = 'arch' | 'rounds' | 'climb' | 'fall' | 'valley' | 'level' | 'steps';
export const SHAPES: ShapeId[] = ['arch', 'rounds', 'climb', 'fall', 'valley', 'level', 'steps'];
export type ShapeChoice = 'auto' | ShapeId;
export const isShapeChoice = (x: unknown): x is ShapeChoice => x === 'auto' || SHAPES.includes(x as ShapeId);
export const SHAPE_LABEL: Record<ShapeId, string> = {
  arch: 'Arch (up to one peak, then down)',
  rounds: 'Rounds (up and down once a time through, each crest higher)',
  climb: 'Climb and hold (up, then stay up)',
  fall: 'Fall and stay low (an early peak, then low)',
  valley: 'Valley (high, down low, high again)',
  level: 'Level (steady, one small lift)',
  steps: 'Steps (hold, lift, hold)',
};

/** A section next to the solo: what it is, how loud, the tension at the join, and its average tension. */
export interface Around { kind: string; energy: number; edge: number; mean: number }
/** What the track tells the plot: a shape chosen by hand, the sections either side, whether the solo is the song's climax. */
export interface StoryIn { shape?: ShapeChoice; prev?: Around; next?: Around; climax?: boolean }

interface PlotKind {
  word: string;
  /** Where the arch's peak sits (0-1 through the solo), and what the main peak sits on: an arrival (home reached) or the strongest pull. */
  peakAt: number;
  on: 'arrive' | 'tense';
  /** The energy at the start and at the end (-1 to 1); the peak is 1. */
  start: number;
  end: number;
}

/** What story each mood tells. Real solos peak early about as often as late (docs/STUDY-SOLO.md), so the mood sets where. */
export const PLOTS: Record<Mood, PlotKind> = {
  triumphant: { word: 'arrive and soar', peakAt: 0.75, on: 'arrive', start: -0.3, end: 0.35 },
  happy: { word: 'build to a bright arrival', peakAt: 0.65, on: 'arrive', start: -0.4, end: 0 },
  angry: { word: 'push, hot from the start', peakAt: 0.7, on: 'tense', start: -0.1, end: 0.2 },
  tense: { word: 'push on the waiting chord', peakAt: 0.7, on: 'tense', start: -0.3, end: 0.1 },
  dark: { word: 'weigh on the pull, let go late', peakAt: 0.65, on: 'tense', start: -0.4, end: -0.2 },
  nostalgic: { word: 'remember, then arrive', peakAt: 0.6, on: 'arrive', start: -0.5, end: -0.3 },
  melancholic: { word: 'keep asking, settle low', peakAt: 0.5, on: 'tense', start: -0.5, end: -0.6 },
  dreamy: { word: 'float, one soft crest', peakAt: 0.4, on: 'arrive', start: -0.4, end: -0.5 },
};

/** The fewest bars a shape needs. */
const MIN_BARS: Record<ShapeId, number> = { arch: 4, climb: 5, fall: 6, level: 6, rounds: 6, valley: 8, steps: 8 };
/** How often each shape suits a solo before anything is known: after the classes of real solos (level 38%, falling 20%, rising 17%, arch 15%, dip 9%, docs/STUDY-SOLO.md). */
const BASE: Record<ShapeId, number> = { arch: 0.2, rounds: 0.12, climb: 0.17, fall: 0.17, valley: 0.08, level: 0.2, steps: 0.06 };
const BY_MOOD: Record<Mood, Partial<Record<ShapeId, number>>> = {
  triumphant: { climb: 2, arch: 1.3, rounds: 1.3, steps: 1.3, fall: 0.3, level: 0.3, valley: 0.5 },
  happy: { rounds: 1.8, arch: 1.3, climb: 1.2, level: 0.7, fall: 0.5 },
  angry: { climb: 1.6, fall: 1.2, steps: 1.4, level: 0.8, arch: 0.8 },
  tense: { climb: 1.4, steps: 1.5, valley: 1.2, level: 0.8, rounds: 1.1 },
  dark: { fall: 1.8, level: 1.4, valley: 1.3, climb: 0.6, arch: 0.8 },
  nostalgic: { arch: 1.4, valley: 1.2, rounds: 1.1 },
  melancholic: { fall: 1.6, level: 1.6, valley: 1.2, climb: 0.5, steps: 0.5 },
  dreamy: { level: 2.2, rounds: 1.3, fall: 1.2, climb: 0.4, steps: 0.5 },
};
const BY_GENRE: Record<Genre, Partial<Record<ShapeId, number>>> = {
  metal: { climb: 1.5, steps: 1.5, rounds: 1.1, level: 0.6 },
  hardrock: { climb: 1.5, steps: 1.4, rounds: 1.1, level: 0.6 },
  grunge: { level: 1.5, fall: 1.4, valley: 1.2, climb: 0.6 },
  altmetal: { valley: 1.3, steps: 1.2 },
  pop: { rounds: 1.4, arch: 1.3, level: 0.8 },
  funk: { level: 1.6, rounds: 1.3, climb: 0.6 },
  rock: { arch: 1.2, climb: 1.1 },
};

export interface Plot {
  /** Phrase lengths in bars, each phrase's part, and the index of the climax phrase (-1 if the solo is one phrase). */
  lens: number[];
  roles: PlotRole[];
  climax: number;
  /** The bar the main peak phrase ends on, or -1. */
  peakBar: number;
  /** Every crest (a bar a phrase ends on, where the energy tops out): the main peak and the lesser ones. */
  crests: number[];
  /** Energy by bar (-1 to 1; the main peak is 1, except in a level solo), and how big the swing of height and pace is (about 1). */
  eBar: number[];
  amp: number;
  /** The shape, why it was picked, how far under the main peak the other phrases stay (semitones), and how much the main peak stands out (0-1). */
  shape: ShapeId;
  why: string[];
  gap: number;
  prom: number;
  /** What the plot is, in a few words, and the lines for the card. */
  word: string;
  lines: string[];
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
/** A line through points [bar, level], read at a bar. */
function pwl(pts: [number, number][], b: number): number {
  if (b <= pts[0][0]) return pts[0][1];
  for (let k = 1; k < pts.length; k++) if (b <= pts[k][0]) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k]; return x1 === x0 ? y1 : y0 + ((y1 - y0) * (b - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
}

export interface PlotIn {
  map: HarmonyMap;
  bars: { start: number; len: number }[];
  total: number;
  /** The section's tension, a level (0-1) for each bar. */
  tension?: number[];
  mood: Mood;
  genre: Genre;
  rng: Rng;
  story?: StoryIn;
}

export function planPlot(i: PlotIn): Plot {
  const { map, bars, total, mood, genre, rng } = i;
  const st = i.story ?? {};
  const nB = bars.length, K = PLOTS[mood];
  const endOf = (b: number) => bars[b].start + bars[b].len;
  /** The chord that sounds as bar `b` ends. */
  const endBeat = (b: number) => beatAt(map, Math.max(bars[b].start, endOf(b) - 2));
  // the section's tension, smoothed over four bars (the card's sawtooth inside a phrase is not a story), then 0-1 across the solo
  const raw = Array.from({ length: nB }, (_, b) => (i.tension?.length ? i.tension[Math.min(i.tension.length - 1, b)] : 0.5));
  const sm = raw.map((_, b) => mean(raw.slice(Math.max(0, b - 2), Math.min(nB, b + 3))));
  const lo = Math.min(...sm), hi = Math.max(...sm);
  const slow = sm.map((v) => (hi - lo > 0.02 ? (v - lo) / (hi - lo) : 0.5));
  const pullBar = bars.map((b) => mean(Array.from({ length: Math.max(1, Math.floor(b.len / 4)) }, (_, q) => beatAt(map, b.start + q * 4).pull)));
  const meanT = mean(raw);
  const amp = clamp(0.55 + 0.75 * meanT, 0.6, 1.25);
  // where it starts and where it must end: the sections either side (a solo after a quiet bridge starts low; before the last chorus it ends high)
  const start = clamp(K.start + (st.prev ? clamp((st.prev.edge - meanT) * 1.6, -0.4, 0.4) : 0), -0.9, 0.7);
  const end = clamp(K.end + (st.next ? clamp((st.next.edge - meanT) * 1.6, -0.4, 0.4) : 0), -0.9, 0.7);

  // one phrase when the solo is short
  if (nB <= 3) {
    const eBar = bars.map((_, b) => clamp(0.6 * (nB > 1 ? -0.4 + 1.2 * (b / (nB - 1)) : 0.3) + 0.3 * (slow[b] * 2 - 1), -1, 1));
    return { lens: [nB], roles: ['end'], climax: -1, peakBar: -1, crests: [], eBar, amp, shape: 'arch', why: ['a short solo'], gap: 3, prom: 1, word: K.word, lines: [`plot (${K.word}): a short solo, one phrase`] };
  }

  // ---- the shape: chosen by hand, or picked by what the song says
  const loopBars = map.loop ? bars.filter((b) => b.start < map.loop).length : 0;
  const rounds = map.loop > 0 && loopBars >= 2 && map.loops >= 2 ? Math.min(4, Math.max(2, Math.floor(map.loops + 0.25))) : 0;
  const w: Record<ShapeId, number> = { ...BASE };
  const why: Record<ShapeId, string[]> = { arch: [], rounds: [], climb: [], fall: [], valley: [], level: [], steps: [] };
  const mul = (s: ShapeId, f: number, note: string) => { w[s] *= f; if (f >= 1.3) why[s].push(note); };
  for (const s of SHAPES) { mul(s, BY_MOOD[mood][s] ?? 1, mood); mul(s, BY_GENRE[genre][s] ?? 1, genre); }
  if (rounds) mul('rounds', 2.2, `${rounds} loops of ${loopBars} bars`); else mul('rounds', 0.6, 'no loop');
  if (nB >= 16) { mul('rounds', 1.5, 'a long solo'); mul('steps', 1.5, 'a long solo'); mul('valley', 1.3, 'a long solo'); mul('level', 0.8, ''); }
  const { prev, next } = st;
  if (prev && prev.edge < meanT - 0.1) { mul('climb', 1.5, `after a quiet ${prev.kind}`); mul('arch', 1.2, ''); mul('fall', 0.6, ''); }
  if (prev && prev.edge > meanT + 0.1) { mul('fall', 1.3, `after a loud ${prev.kind}`); mul('level', 1.2, ''); }
  if (next && next.edge > meanT + 0.08) { mul('climb', 1.5, `into a bigger ${next.kind}`); mul('steps', 1.2, ''); mul('fall', 0.5, ''); }
  if (next && next.edge < meanT - 0.08) { mul('fall', 1.3, `into a quieter ${next.kind}`); mul('arch', 1.2, ''); mul('climb', 0.6, ''); }
  if (st.climax) { mul('climb', 1.5, 'the song\'s climax'); mul('arch', 1.5, 'the song\'s climax'); mul('level', 0.5, ''); }
  let shape: ShapeId, reason: string[];
  const asked = st.shape && st.shape !== 'auto' ? st.shape : null;
  if (asked && nB >= MIN_BARS[asked]) { shape = asked; reason = ['chosen']; }
  else if (asked) { shape = 'arch'; reason = [`too short for ${asked}`]; }
  else {
    const ok = SHAPES.filter((s) => nB >= MIN_BARS[s]);
    shape = rng.weighted(ok.map((s) => [s, w[s]] as [ShapeId, number]));
    reason = why[shape].filter((x, k, a) => x && a.indexOf(x) === k).slice(0, 3);
  }

  // ---- the crests: the bars a phrase ends on where the energy tops out (a bar from 1 to nB-3, so a phrase can end there and 2+ bars follow)
  const jit = Array.from({ length: nB + 1 }, () => rng.next() * 0.25);
  const anyArrival = map.beats.some((b) => b.arrival > 0);
  const on = K.on === 'arrive' && !anyArrival ? 'tense' : K.on;
  const worth = (b: number) => {
    const eb = endBeat(b);
    if (on === 'tense') return eb.pull;
    // (an arrival counts most in the first bar or so of the home chord)
    return eb.arrival > 0 ? eb.arrival * (bars[b].start - eb.step <= bars[b].len ? 1 : 0.7) : 0;
  };
  const top = nB - 3;
  /** The best bar in [a, b] near a target (0-1 through the solo), at least 2 bars from the ones in `avoid`. */
  const pick = (target: number, a: number, b: number, avoid: number[] = []) => {
    let at = -1, best = -Infinity;
    for (let q = clamp(a, 1, top); q <= clamp(b, 1, top); q++) {
      if (avoid.some((c) => Math.abs(c - q) < 2)) continue;
      const sc = worth(q) + 0.4 * slow[q] - 1.5 * Math.abs((q + 0.5) / nB - target) + 0.1 * jit[q];
      if (sc > best) { best = sc; at = q; }
    }
    return at;
  };
  let crests: number[] = [], pb = -1, gap = 3, prom = 1;
  let line: (b: number) => number;
  const low = Math.min(end, -0.25);
  if (shape === 'arch') {
    pb = pick(K.peakAt, 1, top); crests = [pb];
    line = (b) => (b <= pb ? start + (1 - start) * (pb > 0 ? (b / pb) ** 1.3 : 1) : 1 + (end - 1) * ((b - pb) / Math.max(1, nB - 1 - pb)));
  } else if (shape === 'climb') {
    const hs = clamp(Math.round(0.5 * (nB - 1)), 2, top);
    pb = pick(0.78, hs, top); crests = [pb]; gap = 1;
    line = (b) => (b < hs ? start + (0.85 - start) * (b / hs) ** 1.2 : b === nB - 1 ? 0.85 + (end - 0.85) * 0.4 : 0.85);
  } else if (shape === 'fall') {
    pb = pick(0.22, 1, Math.max(1, Math.round(0.4 * nB))); crests = [pb];
    const from = Math.max(start, 0);
    line = (b) => (b <= pb ? from + (1 - from) * (b / pb) ** 1.2 : low + (1 - low) * Math.exp((-3 * (b - pb)) / Math.max(1, nB - 1 - pb)));
  } else if (shape === 'valley') {
    const c1 = pick(0.12, 1, Math.max(1, Math.round(0.25 * nB)));
    pb = pick(0.85, Math.max(c1 + 4, Math.ceil(0.7 * nB)), top, [c1]);
    if (pb < 0) pb = pick(0.85, c1 + 2, top, [c1]);
    crests = [c1, pb];
    // (it drops straight after the first crest, stays low, and comes back up just before the main peak)
    const pts: [number, number][] = [[0, Math.max(start, 0.2)], [c1, 0.75], [c1 + 1, -0.6], [Math.max(c1 + 1, pb - 1), -0.6], [pb, 1], [nB - 1, end]];
    line = (b) => pwl(pts, b);
  } else if (shape === 'level') {
    pb = pick(0.6, 1, top); crests = [pb]; gap = 1; prom = 0.35;
    const L = clamp((start + end) / 2 + 0.3, -0.2, 0.45);
    line = (b) => L + (b === pb ? 0.3 : Math.abs(b - pb) === 1 ? 0.12 : 0);
  } else if (shape === 'steps') {
    const S = nB >= 16 ? 4 : 3;
    const edge = (k: number) => Math.round((k * nB) / S);
    const floor = clamp(start, -0.7, 0.1);
    const level = (b: number) => { for (let k = S - 1; k >= 0; k--) if (b >= edge(k)) return floor + (0.85 - floor) * (k / (S - 1)); return floor; };
    pb = pick(0.88, edge(S - 1), top);
    const lifts = Array.from({ length: S - 2 }, (_, k) => edge(k + 1) - 1).filter((c) => c >= 1 && c <= top && Math.abs(c - pb) >= 2);
    crests = [...lifts, pb].sort((a, b) => a - b); gap = 2;
    line = level;
  } else {
    // rounds: once a time through the loop, each crest a little higher, the last the main peak
    const R = Math.max(2, Math.min(rounds || clamp(Math.round(nB / 4), 2, 4), Math.floor(nB / 3)));
    const edge = (k: number) => Math.round((k * nB) / R);
    for (let k = 0; k < R; k++) {
      const c = pick(k === R - 1 ? 0.9 : (edge(k) + 0.7 * (edge(k + 1) - edge(k))) / nB, Math.max(edge(k) + 1, 1), Math.min(edge(k + 1) - 1, top), crests);
      if (c >= 0) crests.push(c);
    }
    crests.sort((a, b) => a - b);
    pb = crests[crests.length - 1];
    const pts: [number, number][] = [[0, start]];
    // (the crests climb: .55, .78, 1; between two the line drops about .85 under the crest before)
    const hOf = (k: number) => 0.55 + 0.45 * (crests.length > 1 ? k / (crests.length - 1) : 1);
    crests.forEach((c, k) => {
      if (k > 0) pts.push([Math.max(pts[pts.length - 1][0] + 0.5, (crests[k - 1] + c) / 2), Math.max(-0.7, hOf(k - 1) - 0.85)]);
      pts.push([c, hOf(k)]);
    });
    pts.push([nB - 1, end]);
    line = (b) => pwl(pts.sort((p, q) => p[0] - q[0]), b);
  }
  if (pb < 0) { shape = 'arch'; reason = ['no room for the shape']; pb = pick(K.peakAt, 1, top); crests = [pb]; gap = 3; prom = 1; line = (b) => (b <= pb ? start + (1 - start) * (pb > 0 ? (b / pb) ** 1.3 : 1) : 1 + (end - 1) * ((b - pb) / Math.max(1, nB - 1 - pb))); }
  crests = [...new Set(crests.filter((c) => c >= 1 && c <= top))].sort((a, b) => a - b);
  if (!crests.includes(pb)) crests = [...crests, pb].sort((a, b) => a - b);

  // ---- the cuts: phrases of 2-4 bars; each ends where the chords make an ending; one phrase ends on each crest
  // (state: the kind of ending the phrase before made, 0 asks on a waiting chord, 1 closes on a home-ish one)
  const NEG = -1e9;
  const cutAt = (forced: number[]): number[] | null => {
    const sc: number[][] = Array.from({ length: nB + 1 }, () => [NEG, NEG]);
    const from: [number, number][][] = Array.from({ length: nB + 1 }, () => [[-1, 0], [-1, 0]]);
    sc[0] = [0, 0];
    for (let e = 2; e <= nB; e++) {
      for (let l = 2; l <= 4; l++) {
        const j = e - l;
        if (j < 0 || (j !== 0 && j < 2)) continue;
        if (forced.some((c) => j <= c && e > c + 1)) continue; // a phrase may not cross a crest bar's end
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
    let k = sc[nB][0] >= sc[nB][1] ? 0 : 1;
    if (sc[nB][k] <= NEG / 2) return null;
    const out: number[] = [];
    for (let e = nB; e > 0;) { const [j, t] = from[e][k]; out.unshift(e - j); e = j; k = t; }
    return out;
  };
  let lens = cutAt(crests);
  if (!lens && crests.length > 1) { crests = [pb]; lens = cutAt(crests); }
  if (!lens) {
    // (no way through: plain 2s and 3s, and no climax phrase)
    lens = [];
    for (let rem = nB; rem > 0;) { const l = rem === 3 || rem === 5 ? 3 : 2; lens.unshift(Math.min(l, rem)); rem -= l; }
    crests = [];
  }
  // ---- the parts: a phrase ending on a waiting chord asks (call), one ending on home answers
  const ends: number[] = [];
  lens.reduce((a, l) => { ends.push(a + l - 1); return a + l; }, 0);
  let climax = ends.indexOf(pb);
  if (climax === lens.length - 1) climax = -1;
  const roles: PlotRole[] = lens.map((_, k) => (k === lens.length - 1 ? 'end' : k === climax ? 'climax' : endBeat(ends[k]).pull >= 0.4 ? 'call' : 'answer'));
  const peak = climax >= 0 ? pb : -1;

  // ---- the energy by bar: the shape, with the section's slow tension and the chords' pull riding on top
  const mp = mean(pullBar);
  const slowW: Record<ShapeId, number> = { arch: 0.2, climb: 0.2, fall: 0.1, valley: 0.05, level: 0.05, steps: 0.05, rounds: 0.04 };
  const eBar = bars.map((_, b) => {
    const e = 0.75 * line(b) + slowW[shape] * (slow[b] * 2 - 1) + 0.3 * (pullBar[b] - mp);
    return b === peak && shape !== 'level' ? 1 : clamp(e, -1, 0.9);
  });
  if (peak >= 0 && shape === 'level') eBar[peak] = Math.max(eBar[peak], mean(eBar) + 0.25);

  // ---- the card
  const lines = [`plot (${K.word}${on !== K.on ? ', no arrival to land on' : ''}; shape: ${shape}${reason.length ? ` — ${reason.join(', ')}` : ''}): ${lens.length} phrases of ${lens.join(' + ')} bars; the main peak ${peak >= 0 ? `on ${chordName(endBeat(peak))} at the end of bar ${peak + 1}${endBeat(peak).arrival > 0 ? ' (an arrival)' : ''}` : 'none'}${crests.length > 1 ? `; crests at the end of bars ${crests.map((c) => c + 1).join(', ')}` : ''}; energy ${eBar.map((v) => Math.round(v * 9)).join(' ')}`];
  let b0 = 0;
  lens.forEach((l, k) => {
    const eb = endBeat(b0 + l - 1);
    lines.push(`phrase ${k + 1}: bars ${b0 + 1}-${b0 + l}, ${roles[k]}, ends on ${chordName(eb)} (${eb.arrival > 0 ? 'arrival' : eb.role})`);
    b0 += l;
  });
  void total;
  return { lens, roles, climax, peakBar: peak, crests, eBar, amp, shape, why: reason, gap, prom, word: `${shape}: ${K.word}`, lines };
}

/** The plot's energy at a step: the bars' values joined by straight lines between their middles. */
export function plotEnergyAt(p: Plot, bars: { start: number; len: number }[], g: number): number {
  const mid = (b: number) => bars[b].start + bars[b].len / 2;
  if (g <= mid(0)) return p.eBar[0];
  for (let b = 1; b < bars.length; b++) if (g <= mid(b)) { const t = (g - mid(b - 1)) / (mid(b) - mid(b - 1)); return p.eBar[b - 1] + (p.eBar[b] - p.eBar[b - 1]) * t; }
  return p.eBar[bars.length - 1];
}
