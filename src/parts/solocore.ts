// Core notes for the melody step (docs/SOLO-CORE.md, step 1): not every bar gets one. About half the bars are chosen, by how much the
// bar deserves it (a chord arrives, the mood likes the chord, the energy and tension crest, the drums hit, the section's turning
// points), and each gets one note that stands out (the chord's 3rd or 7th over the root, the mood's colour note, a note new to the
// chord, a note that says the key). Held long and played louder; the climax's is the highest, the last bar's is home.
// Step 1 only picks and plays the cores, so the skeleton can be heard alone.

import type { ChordPart, Song } from '../idea';
import type { Rng } from '../rng';
import type { Mood } from '../tension';
import { type Mode, NOTE_NAMES, QUALITIES, SCALES, chordPc } from '../theory';
import { type Profile, intervalCost } from '../verse/intervals';
import { groupStarts } from '../rhythm';
import { chordTones } from './guitar2';
import type { LickFit } from './licks';

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The share of bars that get a core note (the climax bar and the last bar always do). */
export const CORE_SHARE = 0.5;
/** The most bars in a row with a core note, and the most bars in a row without one. */
const MAX_RUN = 2;
const MAX_GAP = 3;
/** How sharply a pick follows its costs (as the melody step's). */
const PICK_T = 1.5;
/** How much the mood's liking of the move from the core before counts, and how hard the energy's height pulls (per semitone). */
const MOOD_K = 1.0;
const HEIGHT_K = 0.35;

/**
 * The chords a mood likes, by the chord root's semitones above the key (0-1; other roots 0.2). Mood decides which chord shows the
 * mood, not how many cores there are.
 */
const MOOD_CHORD: Record<Mood, Record<number, number>> = {
  happy: { 0: 1, 5: 0.7, 7: 0.8, 9: 0.5 },
  triumphant: { 0: 1, 7: 1, 5: 0.7, 10: 0.7 },
  nostalgic: { 9: 0.8, 8: 0.8, 5: 0.8, 0: 0.6 },
  melancholic: { 8: 1, 5: 0.8, 0: 0.7, 10: 0.5 },
  dreamy: { 5: 1, 9: 0.7, 0: 0.6, 2: 0.6 },
  tense: { 7: 1, 1: 0.8, 11: 0.7, 6: 0.6, 8: 0.5 },
  angry: { 1: 0.8, 7: 0.8, 8: 0.6, 10: 0.6, 0: 0.5 },
  dark: { 1: 1, 8: 0.9, 0: 0.6, 10: 0.5, 5: 0.5 },
};
/** A mood's colour notes, in semitones above the key (as the vocal's, src/verse/emotion.ts), and how much each is wanted (0-3). */
export const MOOD_COLOUR: Record<Mood, Record<number, number>> = {
  happy: {},
  triumphant: { 11: 3 },
  nostalgic: { 8: 2, 9: 2 },
  dreamy: { 6: 3, 9: 1 },
  tense: { 11: 3, 1: 1.5, 6: 1 },
  angry: { 1: 2, 11: 1 },
  melancholic: { 8: 3, 9: 0.5 },
  dark: { 1: 3, 8: 1.5 },
};
/** The notes that say the key or the mode (semitones above the key). */
const KEY_NOTES: Partial<Record<Mode, number[]>> = { major: [4], minor: [3, 8], dorian: [9], mixolydian: [10], phrygian: [1], lydian: [6] };

export interface Core {
  bar: number; step: number; len: number; midi: number;
  role: 'mid' | 'climax' | 'end';
  /** How much the bar deserved a core note, and how much the note stands out. */
  barScore: number; noteScore: number;
  /** In words, why the bar and why the note. */
  barWhy: string[]; noteWhy: string[];
}

export interface CoreCtx {
  rng: Rng; song: Song; chords: ChordPart; fit: LickFit; mood: Mood;
  tension: (bar: number) => number;
  E: (g: number) => number;
  centerAt: (g: number) => number;
  window: (g: number) => [number, number];
  profile: (g: number) => Profile;
  drums?: { kick: number[]; snare: number[] };
}

export function pickCores(c: CoreCtx): Core[] {
  const { rng, song, chords, fit, mood } = c;
  const { key, mode, bars, total } = song;
  const scale = SCALES[mode] as readonly number[];
  const timeline = chords.timeline;
  const rel = (m: number) => mod(m - key, 12);
  const sameChord = (a: { root: number; q: string }, b: { root: number; q: string }) => a.root === b.root && a.q === b.q;
  const barOf = (g: number) => { for (let i = bars.length - 1; i >= 0; i--) if (g >= bars[i].start) return i; return 0; };
  const changesIn = (a: number, b: number) => timeline.filter((e) => e.step > a && e.step < b).map((e) => e.step);
  const isBeat = (g: number) => { const b = bars[barOf(g)]; return groupStarts(b.groups).includes(g - b.start); };

  // ---- a core note of the chord at `g` (as the melody step's: a chord note; over a power chord the key's 3rd as well)
  const isCore = (m: number, g: number) => {
    if (fit.isTone(m, g)) return true;
    const ch = fit.chordAt(g);
    if (new Set((QUALITIES[ch.q] as readonly number[]).map((x) => x % 12)).size > 2) return false;
    const d = mod(m - chordPc(key, ch), 12);
    return (d === 3 || d === 4) && scale.includes(rel(m));
  };

  // ---- A: how much each bar deserves a core note
  const peakStep = (() => {
    let crest = Math.floor(total * 0.4), best = -Infinity;
    for (let g = Math.floor(total * 0.15); g < total - 12; g += 2) { const e = c.E(g) + 0.01 * rng.next(); if (e > best) { best = e; crest = g; } }
    return crest;
  })();
  const lastBar = bars.length - 1;
  const chordFit = (ch: { root: number; q: string }) => {
    const deg = MOOD_CHORD[mood][mod(ch.root, 12)] ?? 0.2;
    const tones = (QUALITIES[ch.q as keyof typeof QUALITIES] as readonly number[]).map((i) => mod(ch.root + i, 12));
    const col = Math.max(0, ...tones.map((t) => MOOD_COLOUR[mood][t] ?? 0)) / 3;
    return { v: 0.6 * deg + 0.5 * col, deg, col };
  };
  const accent = (b: number) => {
    const d = c.drums, bar = bars[b];
    if (!d) return 0;
    const starts = groupStarts(bar.groups).map((x) => bar.start + x);
    return starts.filter((s) => (d.kick[s] ?? 0) > 0 || (d.snare[s] ?? 0) > 0).length / Math.max(1, starts.length);
  };
  const barScores = bars.map((bar, b) => {
    const why: string[] = [];
    const ch = fit.chordAt(bar.start), prev = b > 0 ? fit.chordAt(bar.start - 1) : null;
    let arrive = 0;
    if (b === 0) arrive = 0.6;
    else if (prev && !sameChord(prev, ch)) { arrive = 1; why.push('a new chord'); }
    else if (changesIn(bar.start, bar.start + bar.len).length) { arrive = 0.5; why.push('a chord change inside'); }
    const cf = chordFit(ch);
    if (cf.col > 0) why.push(`a chord with the ${mood} colour`);
    else if (cf.deg >= 0.8) why.push(`a ${mood} chord`);
    const spot = b === 0 ? 0.6 : b === Math.floor(bars.length / 2) ? 0.4 : 0;
    if (spot) why.push(b === 0 ? 'the start' : 'the turn');
    const ten = c.tension(b), en = (c.E(bar.start + bar.len / 2) + 1) / 2;
    if (ten >= 0.7) why.push('high tension');
    const acc = accent(b);
    if (acc >= 0.75) why.push('the drums hit');
    return { b, score: arrive + 0.8 * cf.v + 0.5 * spot + 0.9 * ten + 0.4 * en + 0.4 * acc, why };
  });

  // ---- B: which bars: the climax's and the last, then the best of the rest, with no run of 3 and no gap of 4
  const climaxBar = (() => {
    const cand = bars.map((_, i) => i).filter((i) => i < lastBar && bars[i].len >= 8);
    if (!cand.length) return -1;
    return cand.reduce((a, b) => (Math.abs(bars[b].start + bars[b].len / 2 - peakStep) < Math.abs(bars[a].start + bars[a].len / 2 - peakStep) ? b : a));
  })();
  const chosen = new Set<number>([lastBar]);
  if (climaxBar >= 0) chosen.add(climaxBar);
  const want = clamp(Math.round(bars.length * CORE_SHARE), Math.min(2, bars.length), bars.length);
  const run = (b: number) => { let n = 1; for (let i = b - 1; chosen.has(i); i--) n++; for (let i = b + 1; chosen.has(i); i++) n++; return n; };
  const ranked = barScores.filter((x) => !chosen.has(x.b)).map((x) => ({ ...x, j: x.score + 0.25 * rng.next() })).sort((a, b) => b.j - a.j);
  for (const x of ranked) {
    if (chosen.size >= want) break;
    chosen.add(x.b);
    if (run(x.b) > MAX_RUN) chosen.delete(x.b);
  }
  // (a gap of more than 3 bars gets the best bar in it)
  for (let guard = 0; guard < bars.length; guard++) {
    const picked = [...chosen].sort((a, b) => a - b);
    let from = -1, at = -1;
    for (const b of [-1, ...picked]) {
      const nxt = picked.find((x) => x > b);
      if (nxt !== undefined && nxt - b - 1 > MAX_GAP) { from = b; at = nxt; break; }
    }
    if (from < 0 && at < 0) break;
    // (not beside a core that is already one of a pair)
    const fits = barScores.filter((x) => { if (x.b <= from || x.b >= at) return false; chosen.add(x.b); const ok = run(x.b) <= MAX_RUN; chosen.delete(x.b); return ok; });
    const mid = (fits.length ? fits : barScores.filter((x) => x.b > from && x.b < at)).sort((a, b) => b.score - a.score)[0];
    if (!mid) break;
    chosen.add(mid.b);
  }

  // ---- C: the note of each chosen bar, and when and how long it is held
  const roleOf = (b: number): Core['role'] => (b === lastBar ? 'end' : b === climaxBar ? 'climax' : 'mid');
  const placeOf = (b: number): { step: number; len: number } => {
    const bar = bars[b], end = bar.start + bar.len;
    if (b === lastBar) return { step: bar.start, len: total - bar.start };
    // (on the bar line; or, when the bar opens on the chord before, on the chord change that lands on a beat)
    let step = bar.start;
    const prev = b > 0 ? fit.chordAt(bar.start - 1) : null;
    if (prev && sameChord(prev, fit.chordAt(bar.start))) { const ch = changesIn(bar.start, end).find(isBeat); if (ch !== undefined) step = ch; }
    // (held to the next chord, or the end of the bar)
    const stop = changesIn(step, end)[0] ?? end;
    return { step, len: Math.max(2, stop - step) };
  };
  /** How much a note stands out over the chord at `g`, and why. */
  const stand = (m: number, g: number, role: Core['role'], b: number) => {
    const ch = fit.chordAt(g), rootPc = chordPc(key, ch), d = mod(m - rootPc, 12);
    const ivs = (QUALITIES[ch.q] as readonly number[]).map((x) => x % 12);
    const why: string[] = [];
    let s = 0;
    if (d === 0) {
      s += role === 'end' ? 1.2 : b === 0 && rel(m) === 0 ? 0.7 : 0.3;
      why.push('root');
    } else if ((d === 3 || d === 4) && (ivs.includes(d) || ivs.length <= 2)) { s += 1; why.push('3rd'); }
    else if (ivs.includes(d) && (d === 10 || d === 11)) { s += 0.9; why.push('7th'); }
    else if (d === 7) { s += 0.4; why.push('5th'); }
    const col = MOOD_COLOUR[mood][rel(m)] ?? 0;
    if (col > 0) { s += 0.5 * col; why.push(`${mood} colour`); }
    const before = g > 0 ? fit.chordAt(g - 1) : null;
    if (before && !sameChord(before, ch) && !chordTones(key, before).includes(mod(m, 12))) { s += 0.6; why.push('new to the chord'); }
    if ((KEY_NOTES[mode] ?? []).includes(rel(m))) { s += 0.4; why.push('says the key'); }
    return { s, why };
  };

  const picked = [...chosen].sort((a, b) => a - b);
  const cores: Core[] = picked.map((b) => ({ bar: b, ...placeOf(b), midi: 0, role: roleOf(b), barScore: barScores[b].score, noteScore: 0, barWhy: barScores[b].why, noteWhy: [] }));
  const tonesOver = (k: Core, m: number) => [k.step, ...changesIn(k.step, k.step + k.len)].every((g) => isCore(m, g));
  interface Item { v: number; cost: number; why: string[]; s: number }
  const pickCost = (items: Item[]): Item | null => {
    if (!items.length) return null;
    const lo = Math.min(...items.map((x) => x.cost));
    return rng.weighted(items.map((x) => [x, Math.exp(-(x.cost - lo) / PICK_T)] as [Item, number]));
  };

  // the climax first: the highest note, then the others under it
  let peak: number | null = null;
  const climax = cores.find((k) => k.role === 'climax');
  if (climax) {
    const [lo, hi] = c.window(climax.step), ctr = c.centerAt(climax.step);
    const items: Item[] = [];
    for (let m = lo; m <= hi; m++) {
      if (!tonesOver(climax, m) || fit.clash(m, climax.step)) continue;
      const st = stand(m, climax.step, 'climax', climax.bar);
      items.push({ v: m, cost: 0.5 * Math.abs(m - (hi - 1)) + Math.max(0, ctr + 3 - m) - 1.2 * st.s, why: st.why, s: st.s });
    }
    const p = pickCost(items);
    if (p) { peak = p.v; climax.midi = p.v; climax.noteScore = p.s; climax.noteWhy.push(...p.why); }
  }
  let prev: number | null = null, lastMove = 0;
  for (const k of cores) {
    if (k.midi) { lastMove = prev === null ? 0 : k.midi - prev; prev = k.midi; continue; }
    const [lo, hi0] = c.window(k.step), ctr = c.centerAt(k.step), P = c.profile(k.step);
    const hi = peak !== null ? Math.min(hi0, peak - 2) : hi0;
    const build = (strict: boolean) => {
      const items: Item[] = [];
      for (let m = Math.min(lo, hi - 9); m <= hi; m++) {
        if (!tonesOver(k, m) || (strict && fit.clash(m, k.step))) continue;
        const st = stand(m, k.step, k.role, k.bar);
        let cost = HEIGHT_K * Math.abs(m - ctr) - 1.2 * st.s;
        if (prev !== null) cost += MOOD_K * intervalCost(P, prev, m, lastMove, k.role === 'end');
        if (m === prev) cost += 3;
        items.push({ v: m, cost, why: st.why, s: st.s });
      }
      return items;
    };
    let p = pickCost(build(true)) ?? pickCost(build(false));
    if (!p) {
      // (nothing fits: the nearest note of the chord)
      let m = ctr;
      for (let d = 0; d < 12; d++) { const x = [ctr + d, ctr - d].find((y) => isCore(y, k.step)); if (x !== undefined) { m = x; break; } }
      const st = stand(m, k.step, k.role, k.bar);
      p = { v: m, cost: 0, why: st.why, s: st.s };
    }
    k.midi = p.v; k.noteScore = p.s; k.noteWhy.push(...p.why);
    lastMove = prev === null ? 0 : k.midi - prev; prev = k.midi;
  }
  // a weaker note is held for half the bar, a strong one the bar (the last is held to the end)
  for (const k of cores) {
    if (k.role === 'end' || k.noteScore >= 1.3 || k.role === 'climax') continue;
    const half = Math.max(2, 2 * Math.round(k.len / 4));
    if (half < k.len) k.len = half;
  }
  return cores;
}

/** One line for a core: "bar 3 Bb: 3rd, new to the chord (a new chord)". */
export function coreLine(k: Core): string {
  return `bar ${k.bar + 1} ${NOTE_NAMES[mod(k.midi, 12)]}${k.role === 'mid' ? '' : ` (${k.role})`}: ${k.noteWhy.join(', ') || 'chord note'}${k.barWhy.length ? ` (${k.barWhy.join(', ')})` : ''}`;
}
