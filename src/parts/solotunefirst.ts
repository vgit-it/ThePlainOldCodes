// The "Tune first" solo writer (docs/SOLO-TUNE.md): a melody before anything else.
// - Phrases of 2, 3 or 4 bars (a lone bar or a half bar never carries it): each is a few cells (a, then a moved up or down
//   the scale, or changed, or a contrast), closed by a cadence that comes down or up to the phrase's strong note and holds it.
// - The skeleton first: the strong note of every phrase is picked as one path through the chords' notes (the mood's liking of
//   each move, the energy's height, a call that ends open and an answer that comes home, one climax on the crest). Each cell
//   then starts on a chord note, and the notes between are scale steps, mostly.
// - A phrase can be an answer to an earlier one: the same cells in the same rhythm, started somewhere else, closed somewhere else.
// - Written many times over (the same dice, different draws); the one that scores best as a tune (src/parts/solotune.ts) is played.
// Played plain here (a pick on every note); the player and the dynamics are put on top by track.ts, as for Melody + player.

import type { ChordPart, GuitarHit, Song, SoloCurve } from '../idea';
import type { LickKind } from '../players/lead';
import { Rng } from '../rng';
import { groupStarts } from '../rhythm';
import { QUALITIES, SCALES, chordPc } from '../theory';
import { TUNINGS } from '../theory/fretboard';
import type { Mood } from '../tension';
import { intervalCost, profileFor } from '../verse/intervals';
import type { Guitar2Part } from './guitar2';
import { chordTones } from './guitar2';
import { lickFit, placedHit } from './licks';
import { BUSY, DENSITY, ENERGY_WORDS, energyAt, pickEnergy } from './solo2';
import { beatAt, readHarmony } from './soloharmony';
import { type StoryIn, planPlot, plotEnergyAt } from './soloplot';
import { type GapNote, findGaps, pickGaps } from './solomelody-gaps';
import { BREATH_GENRE, BREATH_MOOD, type PlanOpts } from './soloplan';
import { SOLO_MOOD, aimFor, moodScale } from './solomood';
import { TUNE_PASS, tuneScore } from './solotune';

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** How many versions of a solo are written; the best as a tune is played. */
export const TUNE_TRIES = 12;
/** Story score: how far under the best tune score a version may be and still win on its story. */
export const STORY_WINDOW = 0.05;
/** Mood scale applies when this share of the solo sits on chords with no third. */
export const MOOD_SCALE_BARE = 0.5;
/** How much the mood's liking of a move counts against the rest of a note's cost. */
const MOOD_W = 0.35;
/** Tension notes (docs/SOLO-HARMONY.md, step 3c): the degrees over the key that want to move (2nd, 4th, flat 5th, flat 6th, 7th; the leading note is 11). The others rest. */
const UNSTABLE = new Set([1, 2, 5, 6, 8, 11]);
/** The pick of a cell: how sharply it follows the costs. */
const PICK_T = 1.3;
const VEL_SWING = 0.14;

interface TNote { step: number; len: number; midi: number; vel: number }
type CellKind = 'a' | 'seq' | 'var' | 'b' | 'cad';
/** A cell is a stretch of the phrase of `w` bars (a half, one or two). */
interface Cell { kind: CellKind; w: number }
/** What a cell was: its rhythm (lengths) and its shape (ladder steps from its first note); an answer plays them again. */
interface Memo { lens: number[]; shape: number[]; anchor: number }
interface Phrase {
  /** First and last bar, the start and the end step. */
  b0: number; b1: number; S: number; E: number;
  role: 'call' | 'answer' | 'climax' | 'end';
  /** The phrase this one answers (same cells, same rhythm), or -1. */
  src: number;
  /** Notes follow the chords: this phrase plays over the same chords as its source, one loop later (it ends the same way too). */
  mate?: boolean;
  cells: Cell[];
  /** The strong note: where the hold starts, how long the hold is, the rest after it, and the note. */
  goalStep: number; hold: number; rest: number; goal: number;
  memo: Memo[];
  notes: TNote[];
  anchors: TNote[];
}

/** Templates of a phrase by its length in bars: [cells, weight]. The last cell is always the cadence. */
const TEMPLATES: Record<number, [Cell[], number][]> = {
  1: [[[{ kind: 'cad', w: 1 }], 1]],
  2: [
    [[{ kind: 'a', w: 1 }, { kind: 'cad', w: 1 }], 6],
    [[{ kind: 'a', w: 0.5 }, { kind: 'seq', w: 0.5 }, { kind: 'cad', w: 1 }], 4],
    [[{ kind: 'a', w: 0.5 }, { kind: 'var', w: 0.5 }, { kind: 'cad', w: 1 }], 2],
  ],
  3: [
    [[{ kind: 'a', w: 1 }, { kind: 'seq', w: 1 }, { kind: 'cad', w: 1 }], 4],
    [[{ kind: 'a', w: 1 }, { kind: 'b', w: 1 }, { kind: 'cad', w: 1 }], 3],
    [[{ kind: 'a', w: 2 }, { kind: 'cad', w: 1 }], 2],
    [[{ kind: 'a', w: 1 }, { kind: 'var', w: 1 }, { kind: 'cad', w: 1 }], 3],
  ],
  4: [
    [[{ kind: 'a', w: 1 }, { kind: 'seq', w: 1 }, { kind: 'b', w: 1 }, { kind: 'cad', w: 1 }], 3],
    [[{ kind: 'a', w: 1 }, { kind: 'var', w: 1 }, { kind: 'seq', w: 1 }, { kind: 'cad', w: 1 }], 3],
    [[{ kind: 'a', w: 2 }, { kind: 'var', w: 1 }, { kind: 'cad', w: 1 }], 2],
    [[{ kind: 'a', w: 2 }, { kind: 'cad', w: 2 }], 2],
    [[{ kind: 'a', w: 1 }, { kind: 'seq', w: 1 }, { kind: 'cad', w: 2 }], 3],
  ],
};

export function generateSoloTune(rng: Rng, song: Song, chords: ChordPart, riff: GuitarHit[] | null, lick: LickKind, intensity = 0.7, o: PlanOpts = {}, x: { tries?: number; moody?: boolean; scale?: boolean; story?: StoryIn | false; storyNotes?: boolean; hand?: number[]; storyScore?: boolean; tense?: boolean } = {}): Guitar2Part {
  // (`moody`, Solo mood: the mood's own character in the intervals, jumps, pace, colour notes and the score; docs/SOLO-MOOD.md)
  const tries = x.tries ?? TUNE_TRIES, moody = !!x.moody;
  const { key, bars, total } = song;
  const genre = song.partGenres.strum;
  const t = song.tuning ?? TUNINGS.standard;
  const fit = lickFit(song, chords, riff);
  const mood: Mood = o.mood ?? 'nostalgic';
  // (Mood scale: over chords with no third the mood turns the scale's 3rd and 6th; a song of full chords keeps its own scale)
  const own = SCALES[song.mode] as readonly number[];
  const thirdless = (() => {
    let bare = 0;
    chords.timeline.forEach((e, i) => { if (new Set((QUALITIES[e.chord.q] as readonly number[]).map((q) => q % 12)).size <= 2) bare += (chords.timeline[i + 1]?.step ?? total) - e.step; });
    return bare / Math.max(1, total);
  })();
  const scale: readonly number[] = moody && x.scale && thirdless >= MOOD_SCALE_BARE ? moodScale(own, o.mood ?? 'nostalgic') : own;
  const PM = SOLO_MOOD[mood];
  const barIx = (g: number) => { for (let i = bars.length - 1; i >= 0; i--) if (g >= bars[i].start) return i; return 0; };
  const profs = bars.map((_, i) => profileFor(mood, 'solo', o.tension?.length ? o.tension[Math.min(o.tension.length - 1, i)] : undefined));
  const prof = (g: number) => profs[barIx(g)];
  const barAt = (g: number) => bars[barIx(g)];
  const beatOf = (g: number) => Math.min(...barAt(g).groups);
  const isBeat = (g: number) => { const b = barAt(g); return groupStarts(b.groups).includes(g - b.start); };
  /** The middle of a bar: its group boundary nearest the half. */
  const halfOf = (b: { start: number; len: number; groups: number[] }) => b.start + groupStarts(b.groups).reduce((best, gs) => (Math.abs(gs - b.len / 2) < Math.abs(best - b.len / 2) ? gs : best), 0);
  /** A strong place: the bar's first beat, its middle, or a held note (a beat and a half or more): there the note must be a chord note. */
  const strongAt = (g: number, len: number) => { const b = barAt(g); return g === b.start || g === halfOf(b) || len >= beatOf(g) * 1.5; };
  const cSteps = chords.timeline.map((e) => e.step).sort((a, b) => a - b);
  const pointsOver = (g: number, l: number) => [g, ...cSteps.filter((c) => c > g && c < g + l)];

  /** A chord note of the chord at `g` (over a two-note chord, the key's own 3rd as well). */
  const isCore = (m: number, g: number) => {
    if (fit.isTone(m, g)) return true;
    const c = fit.chordAt(g);
    if (new Set((QUALITIES[c.q] as readonly number[]).map((x) => x % 12)).size > 2) return false;
    const d = mod(m - chordPc(key, c), 12);
    return (d === 3 || d === 4) && scale.includes(mod(m - key, 12));
  };
  const coreOver = (m: number, g: number, l: number) => pointsOver(g, l).every((x) => isCore(m, x));

  // the energy (as the other melody writers): the height and pace the solo follows
  const en = pickEnergy(rng, genre, bars.length);
  if (en.shape === 'wave' || en.shape === 'saw' || en.shape === 'steps') en.waves = Math.round(2 * en.waves * Math.max(1, bars.length / 8) ** 0.6) / 2;
  en.pitchC = 1;
  en.paceC = 1;
  en.pitch = 7 + 3 * intensity;
  // (Story from chords, docs/SOLO-HARMONY.md: the plot from the chords, the section's tension and the mood takes the place of the random energy shape)
  const hmap = x.story ? readHarmony(chords.timeline, total, song.mode) : null;
  const plot = hmap && x.story ? planPlot({ map: hmap, bars, total, tension: o.tension, mood, genre, rng: new Rng(`plot-${rng.next()}`), story: x.story }) : null;
  // (Notes follow the chords, docs/SOLO-HARMONY.md step 3: each strong note is picked for the chord it lands on)
  const roleNotes = !!(x.storyNotes && hmap && plot);
  const tenseOn = !!(x.tense && hmap && plot);
  if (plot) { en.pitch = (7 + 3 * intensity) * plot.amp; en.pace = clamp(0.15 + 0.45 * plot.amp * 0.6, 0.15, 0.6); }
  const E = plot ? (g: number) => plotEnergyAt(plot, bars, g) : (g: number) => energyAt(en, clamp(g / total, 0, 1));
  const shapeWord = plot ? plot.word : ENERGY_WORDS[en.shape](en);
  const base = 66 + Math.round(3 * intensity);
  const centerAt = (g: number) => base + Math.round(en.pitchC * en.pitch * E(g)) + (moody ? PM.height : 0);
  const rawWindow = (g: number): [number, number] => [Math.max(50, centerAt(g) - 6), Math.min(83, centerAt(g) + 6)];
  const paceAt = (g: number) => 1 + en.paceC * en.pace * E(g);
  const busy = (DENSITY[genre] * BUSY[lick]) / 5.4;
  const vel0 = 0.8 + 0.08 * intensity;
  const breath = BREATH_MOOD[mood] * BREATH_GENRE[genre];

  // the scale as a ladder: a step on it is one scale step
  // (Solo mood: a chord note outside the key is on the ladder too, so a borrowed chord keeps its own notes)
  const outKey = new Set<number>();
  if (moody) for (const e of chords.timeline) for (const pc of chordTones(key, e.chord)) if (!scale.includes(mod(pc - key, 12))) outKey.add(pc);
  const ladder: number[] = [];
  for (let m = 40; m <= 96; m++) if (scale.includes(mod(m - key, 12)) || outKey.has(mod(m, 12))) ladder.push(m);
  const ixOf = (m: number) => { let best = 0; for (let i = 1; i < ladder.length; i++) if (Math.abs(ladder[i] - m) < Math.abs(ladder[best] - m)) best = i; return best; };
  const L = (i: number) => ladder[clamp(i, 0, ladder.length - 1)];

  // ---- what one note costs: out of the height, a strong place on a note that is not a chord note, a clash, an ugly move
  interface N0 { step: number; len: number; m: number }
  /**
   * Tension notes: the notes inside a phrase follow the chord's pull. Over a chord that wants to move the line plays notes that want to move
   * (the leading note, the 2nd, the 4th) and avoids the notes that rest; over home or an arrival it rests. A note on a beat or held counts double.
   */
  const tenseCost = (n: N0): number => {
    if (!tenseOn) return 0;
    const b = beatAt(hmap!, n.step), u = UNSTABLE.has(mod(n.m - key, 12)), w = strongAt(n.step, n.len) ? 1 : 0.5;
    if (b.role === 'tense') return (u ? -1.6 : 0.9) * w * (0.5 + 0.5 * b.pull);
    if (b.arrival > 0 || b.role === 'home') return (u ? 1.3 : -0.3) * w;
    if (b.role === 'away' && b.pull >= 0.4) return (u ? -0.5 : 0.3) * w;
    return 0;
  };
  const noteCost = (n: N0, prev: number | null, lastMove: number) => {
    let c = n.m < 50 || n.m > 86 ? 20 : 0;
    const [lo, hi] = rawWindow(n.step);
    if (n.m < lo) c += 0.5 * (lo - n.m); else if (n.m > hi) c += 0.5 * (n.m - hi);
    const strong = strongAt(n.step, n.len);
    if (strong) { if (!coreOver(n.m, n.step, n.len)) c += 4.5 + (fit.rubs(n.m, n.step) ? 1.5 : 0); }
    else if (n.len >= 4 && !coreOver(n.m, n.step, n.len)) c += 1;
    if (fit.clash(n.m, n.step)) c += 1;
    c += tenseCost(n);
    if (prev !== null) {
      c += (moody ? PM.weight : MOOD_W) * intervalCost(prof(n.step), prev, n.m, lastMove, false);
      const a = Math.abs(n.m - prev);
      if (a === 0) { if (moody) c += 2.6 - 1.2 * PM.repeatNote; else if (mood !== 'angry' && mood !== 'tense') c += 1.2; }
      if (a > (moody ? 12 : 9)) c += 2;
    }
    if (moody) {
      // the mode and the chord: a note off the key that is not the chord's own is out; a colour note is liked on a held note and a rub is not
      const dd = mod(n.m - chordPc(key, fit.chordAt(n.step)), 12), held = n.len >= beatOf(n.step);
      if (!scale.includes(mod(n.m - key, 12)) && !fit.isTone(n.m, n.step)) c += 14;
      if (!isCore(n.m, n.step)) {
        c -= (PM.colour[dd] ?? 0) * (held ? 1.1 : 0.5);
        if (fit.rubs(n.m, n.step) && !PM.colour[dd]) c += (held ? 1.6 : 0.5) * (1 - PM.rough);
      }
    }
    return c;
  };
  const lineCost = (ns: N0[], prevM: number | null, lastMove0 = 0, prevN: N0 | null = null) => {
    let c = 0, prev = prevM, lm = lastMove0;
    // (Solo mood: the note before, if it was a passing note, moves on by a step)
    if (moody && prevN && ns.length && !isCore(prevN.m, prevN.step)) c += Math.abs(ns[0].m - prevN.m) > 4 ? 2.2 : Math.abs(ns[0].m - prevN.m) > 2 ? 0.6 : 0;
    ns.forEach((n, i) => {
      c += noteCost(n, prev, lm);
      // (Tension notes: the leading note over a chord that wants to move goes up to the root, or steps down; it is not jumped away from)
      if (tenseOn && ns[i + 1] && mod(n.m - key, 12) === 11 && beatAt(hmap!, n.step).role === 'tense') { const dm = ns[i + 1].m - n.m; c += dm === 1 ? -0.4 : dm === -1 || dm === -2 ? 0 : Math.abs(dm) > 2 ? 0.7 : 0.3; }
      if (moody) {
        // a note that is not a chord note is passing: it moves on by a step, and is not jumped into; the leading tone goes up to the root
        const nx = ns[i + 1];
        if (!isCore(n.m, n.step)) {
          if (nx) c += Math.abs(nx.m - n.m) > 4 ? 2.2 : Math.abs(nx.m - n.m) > 2 ? 0.6 : 0;
          if (prev !== null && Math.abs(n.m - prev) >= 5) c += 1.4;
          if (mod(n.m - key, 12) === 11 && nx && nx.m - n.m !== 1) c += 1 - 0.5 * PM.rough;
        }
      }
      lm = prev === null ? 0 : n.m - prev; prev = n.m;
    });
    return c;
  };
  const pickCost = <T>(r: Rng, items: { v: T; cost: number }[]): T | null => {
    if (!items.length) return null;
    const lo = Math.min(...items.map((x) => x.cost));
    return r.weighted(items.map((x) => [x.v, Math.exp(-(x.cost - lo) / PICK_T)] as [T, number]));
  };

  // ---- a rhythm: note lengths that fill `budget` steps from `from`, ending on beats, never three alike in a row
  const rhythm = (r: Rng, from: number, budget: number, feel?: { q: number; shift?: 'qs' | 'sq' }): number[] => {
    // (Solo mood: `q` is the feel, -1 slow to 1 quick; `shift` is a change inside the cell: quick then slow, or slow then quick)
    const q = feel?.q ?? 0;
    const W: Record<number, number> = { 2: 1.1 * busy * paceAt(from) * Math.exp(2 * q), 4: 2.4 * Math.exp(-0.4 * q), 6: 1.1 * Math.exp(-1.2 * q), 8: 0.45 * Math.exp(-1.4 * q), 12: 0.05 * Math.exp(-1.4 * q) };
    for (let tries2 = 0; tries2 < 8; tries2++) {
      const out: number[] = [];
      let pos = from, rem = budget, ok = true;
      while (rem > 0) {
        const items: [number, number][] = [];
        for (const l of [2, 4, 6, 8, 12]) {
          if (l > rem || (rem - l === 1)) continue;
          let w = W[l] * (isBeat(pos + l) || pos + l === from + budget ? 3 : 0.7);
          if (l >= 6 && !isBeat(pos)) w *= 0.25;
          if (feel?.shift) { const f = (pos - from) / budget, early = feel.shift === 'qs' ? f < 0.5 : f >= 0.5; if (l === 2) w *= early ? 2.2 : 0.3; else if (l >= 6) w *= early ? 0.4 : 2; }
          if (out.length >= 2 && out[out.length - 1] === l && out[out.length - 2] === l) w = 0;
          if (pointsOver(pos, l).length > 1) { let k = 0; for (let pc = 0; pc < 12; pc++) if (pointsOver(pos, l).every((x) => isCore(pc, x))) k++; w *= k >= 2 ? 0.6 : k === 1 ? 0.2 : 0; }
          if (rem - l === 0 || rem - l >= 2) items.push([l, w]);
        }
        if (!items.length || items.every(([, w]) => w <= 0)) { ok = false; break; }
        const l = r.weighted(items);
        out.push(l); pos += l; rem -= l;
      }
      if (ok && (out.length < 3 || new Set(out).size >= 2)) return out;
    }
    const out: number[] = []; for (let rem = budget; rem > 0; rem -= Math.min(4, rem)) out.push(Math.min(4, rem)); return out;
  };

  // ---- a shape: the steps up and down the ladder from a cell's first note
  type Contour = 'rise' | 'fall' | 'arch' | 'dip' | 'level';
  const shapeOf = (r: Rng, n: number, contour: Contour): number[] => {
    const pUp = (i: number) => (contour === 'rise' ? 0.68 : contour === 'fall' ? 0.32 : contour === 'level' ? 0.5 : contour === 'arch' ? (i < n / 2 ? 0.72 : 0.28) : i < n / 2 ? 0.28 : 0.72);
    const big = clamp((profs[0].size - 2.5) / 3, 0, 1);
    for (let k = 0; k < 20; k++) {
      const s = [0];
      let last = 0;
      for (let i = 1; i < n; i++) {
        let mag = r.weighted([[1, 58 - 15 * big], [2, 28], [3, 10 + 8 * big], [4, 4 + 7 * big]] as [number, number][]);
        let dir = r.chance(pUp(i)) ? 1 : -1;
        if (Math.abs(last) >= 3 && r.chance(0.85)) { dir = -sign(last); mag = r.chance(0.75) ? 1 : 2; }
        if (r.chance(0.05) && Math.abs(last) < 3) mag = 0;
        last = dir * mag;
        s.push(s[i - 1] + last);
      }
      if (Math.max(...s) - Math.min(...s) <= 6) return s;
    }
    return Array.from({ length: n }, (_, i) => (i % 2 ? 1 : 0));
  };

  /**
   * Solo mood: a cell walked note by note from its anchor, each step picked by what the note costs (the mood's intervals, the chord,
   * the key, the height), pulled the way the contour goes and toward the jumps the mood likes. The shape is the steps from the anchor.
   */
  const walkCell = (r: Rng, from: number, lens: number[], anchor: number, contour: Contour, prevM: number | null): number[] => {
    const n = lens.length;
    const pUp = (i: number) => (contour === 'rise' ? 0.68 : contour === 'fall' ? 0.32 : contour === 'level' ? 0.5 : contour === 'arch' ? (i < n / 2 ? 0.72 : 0.28) : i < n / 2 ? 0.28 : 0.72);
    const shape = [0];
    let idx = anchor, pm = L(anchor), lm = prevM === null ? 0 : pm - prevM, pos = from + lens[0];
    for (let i = 1; i < n; i++) {
      const items: { v: number; cost: number }[] = [];
      for (let d = -5; d <= 5; d++) {
        const m = L(idx + d);
        let c = noteCost({ step: pos, len: lens[i], m }, pm, lm);
        c -= 0.8 * Math.log(d === 0 ? 0.5 : d > 0 ? pUp(i) : 1 - pUp(i));
        if (Math.abs(m - pm) >= 5) c -= 0.8 * Math.log(clamp(PM.leap / 0.25, 0.25, 3));
        items.push({ v: d, cost: c });
      }
      const d = pickCost(r, items) ?? 1;
      idx += d; lm = L(idx) - pm; pm = L(idx); pos += lens[i];
      shape.push(idx - anchor);
    }
    return shape;
  };
  /** The cell's notes if its first note is on ladder step `anchor`. */
  const place = (from: number, lens: number[], shape: number[], anchor: number, vel = 0): N0[] => {
    let pos = from;
    return lens.map((len, i) => { const n = { step: pos, len, m: L(anchor + shape[i]) }; pos += len; return n; }).map((n) => (vel ? n : n));
  };
  /** Solo mood: a note off the key that is not a note of the chord sounding moves to the nearest note that is. */
  const offKey = (n: N0) => !scale.includes(mod(n.m - key, 12)) && !fit.isTone(n.m, n.step);
  const tidy = (ns: N0[]): N0[] => (!moody ? ns : ns.map((n) => {
    let out = n;
    // (and back inside the range: down or up the ladder from a note that went over or under)
    for (let k = 0; k < 6 && (out.m > 86 || out.m < 50); k++) out = { ...out, m: L(ixOf(out.m) + (out.m > 86 ? -1 : 1)) };
    if (!offKey(out)) return out;
    const ix = ixOf(out.m);
    for (const d of [1, -1, 2, -2, 3, -3]) { const m = L(ix + d); if (!offKey({ ...out, m }) && m >= 50 && m <= 86) return { ...out, m }; }
    return out;
  }));
  /** A strong place (a beat, or a held note) that landed on a note that is not a chord note moves to the nearest chord note on the ladder. */
  const repair = (ns: N0[], prevM: number | null): N0[] => {
    let prev = prevM;
    return ns.map((n) => {
      const strong = strongAt(n.step, n.len);
      let out = n;
      if (strong && !coreOver(n.m, n.step, n.len)) {
        const ix = ixOf(n.m);
        let best: number | null = null;
        for (const d of [1, -1, 2, -2, 3, -3]) {
          const m = L(ix + d);
          if (m === prev || m < 50 || m > 86 || !coreOver(m, n.step, n.len)) continue;
          if (best === null || (prev === null ? 0 : Math.abs(m - prev)) < (prev === null ? 0 : Math.abs(best - prev))) best = m;
        }
        if (best !== null) out = { ...n, m: best };
      }
      prev = out.m;
      return out;
    });
  };
  /** Anchors for a cell: ladder steps in the window whose note is a chord note at its start. */
  const anchorsFor = (g: number, len: number, near: number | null, reach: number): number[] => {
    const [lo, hi] = rawWindow(g);
    const out: number[] = [];
    for (let i = 0; i < ladder.length; i++) if (ladder[i] >= lo - 2 && ladder[i] <= hi + 2 && coreOver(ladder[i], g, Math.min(len, 4)) && (near === null || Math.abs(i - near) <= reach)) out.push(i);
    if (out.length) return out;
    const all: number[] = [];
    for (let i = 0; i < ladder.length; i++) if (ladder[i] >= lo - 4 && ladder[i] <= hi + 4 && isCore(ladder[i], g)) all.push(i);
    return all.length ? all : [ixOf(centerAt(g))];
  };

  /**
   * One cell: its rhythm and shape (made, or the memo's), on the best anchor. `ref` is the ladder step of the note before, `bias`
   * the ladder step the first note is pulled to.
   */
  const cellAt = (r: Rng, from: number, lens: number[], memoShape: number[] | null, contour: Contour, prevM: number | null, ref: number | null, bias: number | null, jump = 0, prevN: N0 | null = null) => {
    const items: { v: { shape: number[]; anchor: number }; cost: number }[] = [];
    let anchors = anchorsFor(from, lens[0], bias ?? ref, 6);
    // (Solo mood: a jump to the cell's first note, up or down, 5 to 12 semitones from the note before)
    if (jump && prevM !== null) {
      const far = anchorsFor(from, lens[0], null, 99).filter((a) => (L(a) - prevM) * jump >= 5 && (L(a) - prevM) * jump <= 12);
      if (far.length) anchors = far;
      else jump = 0;
    }
    if (moody && !memoShape && anchors.length > 6) {
      const at = bias ?? ref ?? ixOf(centerAt(from));
      anchors = anchors.slice().sort((a, b) => Math.abs(a - at) - Math.abs(b - at)).slice(0, 6);
    }
    const shapesFor = (a: number): number[][] => [walkCell(r, from, lens, a, contour, prevM), walkCell(r, from, lens, a, contour, prevM)];
    const shared = memoShape || moody ? null : Array.from({ length: 22 }, () => shapeOf(r, lens.length, contour));
    const add = (shape: number[], a: number) => {
      let c = lineCost(place(from, lens, shape, a), prevM, 0, prevN);
      if (jump && prevM !== null) c += 0.3 * Math.abs(Math.abs(L(a) - prevM) - 7);
      else if (ref !== null) c += 0.5 * Math.abs(a - ref) + (a === ref ? 1.5 : 0);
      if (bias !== null) c += 0.9 * Math.abs(a - bias);
      // (Solo mood: a cell ends on a chord note, or leaves its last note for the next cell to answer)
      if (moody) { const ln = place(from, lens, shape, a).pop()!; if (!isCore(ln.m, ln.step)) c += 1.5; }
      items.push({ v: { shape, anchor: a }, cost: c });
    };
    // (the same order as before for the plain writer: the shapes, then the anchors)
    if (moody && !memoShape) for (const a of anchors) for (const shape of shapesFor(a)) add(shape, a);
    else for (const shape of shared ?? [memoShape!]) for (const a of anchors) add(shape, a);
    const shapes = shared ?? [memoShape ?? [0]];
    const pick = pickCost(r, items) ?? { shape: shapes[0], anchor: anchors[0] };
    return { ...pick, notes: tidy(repair(place(from, lens, pick.shape, pick.anchor), prevM)) };
  };

  /** Steps of bar position `p` (bars, in halves) from the phrase's first bar. */
  const posOf = (b0: number, p: number) => {
    const bi = b0 + Math.floor(p + 1e-9), f = p - Math.floor(p + 1e-9);
    if (bi >= bars.length) return total;
    const b = bars[bi];
    if (f < 0.25) return b.start;
    const cut = halfOf(b) - b.start;
    return b.start + cut;
  };

  // ---- the whole solo, once
  /** Story score (docs/SOLO-HARMONY.md, step 4): how well each version tells the plot, kept beside it (a version is a list of phrases). */
  const storyOf = new WeakMap<Phrase[], number>();
  const compose = (r: Rng) => {
    const nB = bars.length;
    // phrases of 2, 3 or 4 bars
    const lens: number[] = plot ? [...plot.lens] : [];
    if (plot) { /* (the plot's cuts: each phrase ends where the chords make an ending) */ }
    else if (nB <= 3) lens.push(nB);
    else for (let rem = nB; rem > 0;) {
      const opts = ([2, 3, 4] as const).filter((l) => l <= rem && (rem - l === 0 || rem - l >= 2));
      const l = r.weighted(opts.map((x) => [x, x === 2 ? 1.3 : x === 3 ? 0.8 : 1.2] as [number, number]));
      lens.push(l); rem -= l;
    }
    const ph: Phrase[] = [];
    let b0 = 0;
    lens.forEach((len, i) => {
      const S = bars[b0].start, E2 = b0 + len >= nB ? total : bars[b0 + len].start;
      ph.push({ b0, b1: b0 + len - 1, S, E: E2, role: plot ? plot.roles[i] : i === lens.length - 1 ? 'end' : i % 2 ? 'answer' : 'call', src: -1, cells: [], goalStep: 0, hold: 0, rest: 0, goal: 0, memo: [], notes: [], anchors: [] });
      b0 += len;
    });
    // the climax: the phrase on the energy's crest (not the last, unless it is the only one)
    let climaxAt = -1, crest = -Infinity;
    if (plot) climaxAt = plot.climax;
    else ph.forEach((p, i) => { if (i === ph.length - 1 && ph.length > 1) return; let e = -Infinity; for (let g = p.S; g < p.E; g += 4) e = Math.max(e, E(g)); if (e > crest) { crest = e; climaxAt = i; } });
    if (climaxAt >= 0 && ph.length > 1) ph[climaxAt].role = 'climax';
    // answers: a phrase as long as the one before plays its cells again
    ph.forEach((p, i) => {
      if (i === 0) return;
      const q = ph[i - 1], same = p.b1 - p.b0 === q.b1 - q.b0;
      const ak = moody ? PM.answers : 1;
      if (same && p.role !== 'climax' && r.chance(clamp((i % 2 ? 0.8 : 0.5) * ak, 0, 0.95))) p.src = q.src >= 0 ? q.src : i - 1;
      else if (same && p.role !== 'climax' && i >= 2 && r.chance(clamp(0.45 * ak, 0, 0.9))) p.src = 0;
      if (p.src >= 0 && ph[p.src].b1 - ph[p.src].b0 !== p.b1 - p.b0) p.src = -1;
    });
    // (Notes follow the chords: when the chords loop, a phrase one loop later plays the figure of the phrase over the same chords again,
    // so each round says it again, moved to where its strong note goes)
    if (roleNotes && hmap!.loop > 0) ph.forEach((p, i) => {
      if (p.role === 'climax') return;
      for (let j = i - 1; j >= 0; j--) {
        const d = p.S - ph[j].S;
        if (d > 0 && Math.abs(d % hmap!.loop) < 1e-6 && ph[j].b1 - ph[j].b0 === p.b1 - p.b0) { if (r.chance(0.85)) { p.src = j; p.mate = true; } break; }
      }
    });
    // cells
    ph.forEach((p, i) => {
      const len = p.b1 - p.b0 + 1;
      const tmpl = p.src >= 0 ? ph[p.src].cells.map((c) => ({ ...c })) : r.weighted(TEMPLATES[Math.min(4, len)].map(([c, w]) => [c, w] as [Cell[], number])).map((c) => ({ ...c }));
      if (i === ph.length - 1) while (tmpl.length > 1 && tmpl[tmpl.length - 1].w < 1.5) { const x = tmpl.splice(tmpl.length - 2, 1)[0]; tmpl[tmpl.length - 1].w += x.w; }
      p.cells = tmpl;
    });
    // the holds: where each phrase's strong note starts
    ph.forEach((p, i) => {
      const last = i === ph.length - 1;
      const cadW = p.cells[p.cells.length - 1].w;
      const cs = posOf(p.b0, p.b1 - p.b0 + 1 - cadW);
      if (last) { p.goalStep = bars[nB - 1].start; p.hold = bars[nB - 1].len; p.rest = 0; return; }
      // (a phrase one loop after its source ends the same way: the same hold, the same rest)
      if (p.mate && p.src >= 0 && p.src < i && ph[p.src].hold > 0 && p.E - ph[p.src].hold >= cs) { p.hold = ph[p.src].hold; p.rest = ph[p.src].rest; p.goalStep = p.E - p.hold; return; }
      const B = p.E - cs, bs = beatOf(cs);
      const holds = [bs * 2, bs * 3, barAt(cs).len].filter((h) => h <= B - (B >= bs * 2 ? bs : 0) && h >= bs * 1.5);
      const hold = holds.length ? (moody ? r.weighted(holds.map((h, q) => [h, PM.hold ** q] as [number, number])) : r.pick(holds)) : Math.max(2, B);
      p.hold = hold; p.goalStep = p.E - hold;
      p.rest = hold - 2 >= bs * 1.5 && r.chance(clamp(0.28 * breath, 0, 0.7)) ? Math.min(beatOf(p.goalStep), r.pick([2, 4])) : 0;
      if (p.goalStep < cs) { p.goalStep = cs; p.hold = p.E - cs; }
    });

    // ---- the skeleton: the strong notes, one path through the chords' notes
    // (Solo mood: an open ending may land on a colour note, the 9th or the 6th, where one chord sounds under the whole hold)
    const wantColour = ph.map((p) => moody && p.role === 'call' && r.chance(PM.colourGoal));
    const target = (p: Phrase) => centerAt(p.goalStep) + (p.role === 'climax' ? 5 * (plot ? plot.prom : 1) : p.role === 'call' ? 1.5 : p.role === 'answer' ? -1.5 : -2);
    /**
     * Hand-over (docs/SOLO-HARMONY.md, step 3b): the last note rings on into the next section's first chord, so it is picked to be a note of that
     * chord, or a semitone from one (the bend at the bar line, `carrySolo`, then has little to travel). `hand` is that chord's notes, as pitch classes.
     */
    const lastPh = ph[ph.length - 1];
    const handCost = (p: Phrase, m: number): number => {
      if (!x.hand?.length || p !== lastPh) return 0;
      let near = 6;
      for (const t of x.hand) { const d = mod(m - t, 12); near = Math.min(near, d, 12 - d); }
      return near === 0 ? 0 : near === 1 ? 0.8 : near === 2 ? 2 : near === 3 ? 3 : 3.6;
    };
    /** The chord a phrase's strong note ends on. */
    const endBeat = (p: Phrase) => beatAt(hmap!, clamp(p.goalStep + p.hold - p.rest - 1, 0, total - 1));
    /**
     * Notes follow the chords: what a strong note costs by the part its chord plays. A place to rest (home, an arrival) is a root or a 3rd;
     * a chord that wants to move (V, a 7th, a suspended chord) is a note that leans (the 3rd, the leading note of V, the 7th) and not the root;
     * a calm or away chord asks (a call: the 3rd or 5th) or answers (the root or 3rd). A deceptive turn (V to vi) is a 3rd.
     */
    const roleCost = (p: Phrase, m: number): number => {
      const b = endBeat(p), d = mod(m - chordPc(key, b.chord), 12), sus = b.chord.q === 'sus4' || b.chord.q === 'sus2';
      const root = d === 0, third = d === 3 || d === 4, fifth = d === 7, lean = third || d === 10 || d === 11 || (sus && (d === 5 || d === 2));
      if (b.twist) return third ? 0 : root ? 0.9 : fifth ? 1.4 : 2.5;
      if (b.arrival > 0 || b.role === 'home') return p.role === 'climax' ? (third ? 0 : root ? 0.3 : fifth ? 1.4 : 2.8) : p.role === 'end' ? (root ? 0 : third ? 1.8 : fifth ? 3 : 4) : root ? 0 : third ? 0.6 : fifth ? 2.4 : 3.5;
      if (b.role === 'tense') return lean ? 0 : fifth ? 1.7 : root ? 2.8 : 3.5;
      if (p.role === 'answer' || p.role === 'end') return root ? 0.2 : third ? 0.3 : fifth ? 1.2 : 2.5;
      return third ? 0 : fifth ? 0.5 : root ? 1.8 : 2.5;
    };
    /**
     * Story score (step 4): how well one version tells the plot, 0 to 1.
     *  - the build: the bars' mean height follows the plot's energy;
     *  - the peak: the solo's highest note is in the peak phrase, and the peak's strong note stands above the others' by the plot's gap;
     *  - the ends: each phrase's strong note is what its chord asks for (the cost of Notes follow the chords, whether that switch is on or not).
     */
    const storyFit = (v: Phrase[]): number => {
      const all = v.flatMap((p, i) => p.notes.map((n) => ({ step: n.step, midi: n.midi, i })));
      const played = bars.map((b) => { const ns = all.filter((n) => n.step >= b.start && n.step < b.start + b.len); return ns.length ? ns.reduce((a, n) => a + n.midi, 0) / ns.length : NaN; });
      const q = played.map((m, k) => (Number.isNaN(m) ? -1 : k)).filter((k) => k >= 0);
      const a = q.map((k) => played[k]), e = q.map((k) => plot!.eBar[k]);
      const ma = a.reduce((t, y) => t + y, 0) / Math.max(1, a.length), me = e.reduce((t, y) => t + y, 0) / Math.max(1, e.length);
      let cv = 0, va = 0, ve = 0;
      a.forEach((y, k) => { cv += (y - ma) * (e[k] - me); va += (y - ma) ** 2; ve += (e[k] - me) ** 2; });
      // (a level plot has no build to follow: neutral)
      const build = a.length >= 3 && va > 1e-9 && ve > 1e-9 ? clamp((cv / Math.sqrt(va * ve) - 0.1) / 0.7, 0, 1) : 0.5;
      let peak = 1;
      if (plot!.climax >= 0 && v.length > 1) {
        const top = Math.max(...all.map((n) => n.midi));
        const others = Math.max(...v.filter((_, i) => i !== plot!.climax).map((p) => p.goal));
        peak = 0.5 * (all.some((n) => n.i === plot!.climax && n.midi === top) ? 1 : 0.3) + 0.5 * clamp((v[plot!.climax].goal - others) / Math.max(1, plot!.gap), 0, 1);
      }
      const ends = v.reduce((t, p) => t + Math.exp(-roleCost(p, p.goal) / 1.5), 0) / v.length;
      return 0.4 * build + 0.3 * peak + 0.3 * ends;
    };
    const cands = (p: Phrase, cap: number): number[] => {
      const near = (m: number, w: number) => m >= 50 && m <= Math.min(86, cap) && m >= target(p) - w && m <= target(p) + w;
      // (Notes follow the chords: the last note still rests on the root, unless its chord wants to move on)
      if (p.role === 'end' && !(x.hand?.length && p === lastPh) && (!roleNotes || (endBeat(p).role !== 'tense' && !endBeat(p).twist))) {
        const root = ladder.filter((m) => near(m, 12) && mod(m - chordPc(key, fit.chordAt(p.goalStep)), 12) === 0 && coreOver(m, p.goalStep, p.hold));
        if (root.length) return root;
      }
      const whole = ladder.filter((m) => near(m, 9) && coreOver(m, p.goalStep, p.hold));
      if (moody && wantColour[ph.indexOf(p)] && pointsOver(p.goalStep, p.hold).length === 1) {
        const rootPc = chordPc(key, fit.chordAt(p.goalStep));
        const col = ladder.filter((m) => near(m, 9) && scale.includes(mod(m - key, 12)) && (PM.colour[mod(m - rootPc, 12)] ?? 0) >= 0.5 && !(fit.rubs(m, p.goalStep) && PM.rough < 0.5));
        if (col.length) return [...new Set([...whole, ...col])];
      }
      if (whole.length) return whole;
      const first = ladder.filter((m) => near(m, 9) && isCore(m, p.goalStep));
      if (first.length) return first;
      const any = ladder.filter((m) => isCore(m, p.goalStep));
      return [any.reduce((b, m) => (Math.abs(m - target(p)) < Math.abs(b - target(p)) ? m : b), any[0] ?? ladder[0])];
    };
    let capAll = 86;
    if (climaxAt >= 0 && ph.length > 1) {
      // (Notes follow the chords: among the notes near the peak's height, the one its chord asks for)
      const distCost = (m: number) => Math.abs(m - target(ph[climaxAt])) * (roleNotes ? 0.45 : 1) + (roleNotes ? roleCost(ph[climaxAt], m) : 0) + handCost(ph[climaxAt], m);
      const top = cands(ph[climaxAt], 86).reduce((b, m) => (distCost(m) < distCost(b) ? m : b));
      ph[climaxAt].goal = top;
      capAll = top - (plot ? plot.gap : 3);
    }
    const local = (p: Phrase, m: number) => {
      let c = 0.45 * Math.abs(m - target(p));
      const rootPc = chordPc(key, fit.chordAt(p.goalStep));
      if (moody && !isCore(m, p.goalStep)) c -= 2.5 * (PM.colour[mod(m - rootPc, 12)] ?? 0);
      c += handCost(p, m);
      if (roleNotes) return c + roleCost(p, m);
      if (p.role === 'answer' || p.role === 'end') c += mod(m - rootPc, 12) === 0 ? 0 : 2.5; else if (p.role === 'call') c += mod(m - rootPc, 12) === 0 ? 1.8 : 0;
      return c;
    };
    const sets = ph.map((p) => (p.goal ? [p.goal] : cands(p, capAll)));
    const best: { c: number; from: number }[][] = [];
    sets.forEach((set, i) => {
      best.push(set.map((m) => {
        if (i === 0) return { c: local(ph[i], m), from: -1 };
        let lo = Infinity, at = 0;
        sets[i - 1].forEach((pm, k) => {
          const d = m - pm;
          let tc = best[i - 1][k].c + (moody ? PM.weight : MOOD_W) * 1.4 * intervalCost(prof(ph[i].goalStep), pm, m, 0, true) + (d === 0 ? (moody ? 3 * (1 - 0.8 * PM.repeatNote) : 3) : 0) + (Math.abs(d) > 7 ? (moody ? Math.max(0, 1.5 * (1 - 1.5 * PM.leap)) : 1.5) : 0);
          if (ph[i].role === 'answer' && d > 0) tc += 2; else if (ph[i].role === 'call' && d < 0 && i > 1) tc += 1;
          if (tc < lo) { lo = tc; at = k; }
        });
        return { c: lo + local(ph[i], m), from: at };
      }));
    });
    let k = 0;
    for (let q = 1; q < best[best.length - 1].length; q++) if (best[best.length - 1][q].c < best[best.length - 1][k].c) k = q;
    for (let i = ph.length - 1; i >= 0; i--) { ph[i].goal = sets[i][k]; k = best[i][k].from; }

    // ---- the cells, in order, each on a chord note
    let prevM: number | null = null;
    let lastIx: number | null = null;
    let lastN: N0 | null = null;
    ph.forEach((p, pi) => {
      const src = p.src >= 0 ? ph[p.src] : null;
      const contour: Contour = moody ? (p.role === 'climax' ? 'rise' : r.weighted(p.role === 'call' ? PM.call : PM.answer)) : p.role === 'call' ? r.pick(['rise', 'arch', 'arch']) : p.role === 'climax' ? 'rise' : p.role === 'answer' ? r.pick(['fall', 'arch', 'fall']) : r.pick(['fall', 'dip']);
      // (Solo mood: the feel of this phrase's rhythm, now and then turned the other way: a busy phrase, then a sparse one)
      const qBase = moody ? (r.chance(PM.contrast * 0.6) ? -PM.quick * 0.8 : PM.quick) : 0;
      let cellStart = p.S;
      let prevCell: { lens: number[]; shape: number[]; anchor: number } | null = null;
      let aLens: number[] | null = null;
      let pos = 0;
      const dirPref = p.role === 'answer' || p.role === 'end' ? -1 : 1;
      p.cells.forEach((cell, ci) => {
        const from = posOf(p.b0, pos);
        const to = posOf(p.b0, pos + cell.w);
        pos += cell.w;
        cellStart = from;
        const budget = to - from;
        const memo = src && src.memo[ci] && src.cells[ci]?.kind === cell.kind ? src.memo[ci] : null;
        if (cell.kind === 'cad') {
          // the run-up to the strong note (the rhythm of the first cell again), then the hold
          const runUp = p.goalStep - from;
          const gi = ixOf(p.goal);
          const lensR: number[] = [];
          const ref = aLens ?? (memo?.lens ?? rhythm(r, from, Math.max(2, runUp)));
          for (let q = 0, s = 0; s < runUp; q++) { const x = Math.min(ref[q % ref.length], runUp - s); if (x < 2 && lensR.length) lensR[lensR.length - 1] += x; else lensR.push(x); s += x; }
          if (runUp >= 2 && lensR.length) {
            let dir = p.role === 'call' || p.role === 'climax' ? (r.chance(0.65) ? -1 : 1) : (r.chance(0.8) ? 1 : -1);
            // (Notes follow the chords: into a chord that wants to move the line leans up to the note; into a place to rest it comes down)
            if (roleNotes && p.role !== 'climax') { const eb = endBeat(p); if (eb.role === 'tense') dir = r.chance(0.8) ? -1 : 1; else if (eb.arrival > 0 || eb.role === 'home') dir = r.chance(0.85) ? 1 : -1; }
            // (near the edge of the range the line comes in from the inside)
            if (p.goal <= 56) dir = 1; else if (p.goal >= 80) dir = -1;
            // (Solo mood: now and then a jump into the held note, from below or above, instead of a run of steps)
            const leapIn = moody && r.chance(PM.cadLeap);
            if (leapIn) dir = r.chance(PM.jumpUp) ? -1 : 1;
            if (p.goal <= 56) dir = 1; else if (p.goal >= 80) dir = -1;
            const pool = Array.from({ length: 24 }, () => {
              const off: number[] = [];
              let o = dir * (leapIn ? r.int(3, 5) : r.chance(0.7) ? 1 : 2);
              for (let q = lensR.length - 1; q >= 0; q--) { off[q] = o; o += (r.chance(0.65) ? dir : -dir) * r.weighted([[1, 65], [2, 30], [3, 5]] as [number, number][]); }
              return off;
            });
            const items = pool.map((off) => {
              const ns = place(from, lensR, off.map((x) => x), gi);
              const goalN = { step: p.goalStep, len: p.hold, m: p.goal };
              return { v: off, cost: moody ? lineCost([...ns, goalN], prevM, 0, lastN) + (leapIn && ns.length && !isCore(ns[ns.length - 1].m, ns[ns.length - 1].step) ? 2.5 : 0) : lineCost(ns, prevM) + lineCost([goalN], ns[ns.length - 1]?.m ?? prevM, 0) };
            });
            const off = pickCost(r, items) ?? pool[0];
            tidy(place(from, lensR, off, gi)).forEach((n) => p.notes.push({ step: n.step, len: n.len, midi: n.m, vel: 0 }));
            p.memo[ci] = { lens: lensR, shape: off, anchor: gi };
          }
          p.notes.push({ step: p.goalStep, len: p.hold - p.rest, midi: p.goal, vel: 0 });
          p.anchors.push({ step: p.goalStep, len: p.hold - p.rest, midi: p.goal, vel: 0 });
          return;
        }
        let lens2: number[], shape: number[], anchor: number, placed: N0[];
        if (memo && (cell.kind === 'a' || cell.kind === 'b' || cell.kind === 'seq' || cell.kind === 'var') && memo.lens.reduce((s, x) => s + x, 0) === budget) {
          // (an answer: the same rhythm and shape, started elsewhere)
          lens2 = memo.lens;
          const nearGoal = src ? ixOf(p.goal) - ixOf(ph[p.src].goal) : 0;
          const c = cellAt(r, from, lens2, memo.shape, contour, prevM, lastIx, memo.anchor + clamp(nearGoal, -3, 3), 0, lastN);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else if (cell.kind === 'seq' && prevCell && prevCell.lens.reduce((s, x) => s + x, 0) === budget) {
          lens2 = prevCell.lens;
          const d = (r.chance(0.75) ? dirPref : -dirPref) * r.pick([1, 1, 2]);
          const c = cellAt(r, from, lens2, prevCell.shape, contour, prevM, lastIx, prevCell.anchor + d, 0, lastN);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else if (cell.kind === 'var' && prevCell && prevCell.lens.reduce((s, x) => s + x, 0) === budget) {
          lens2 = prevCell.lens;
          const sh = prevCell.shape.slice();
          const n = sh.length;
          if (n >= 3) { const lastMv = sh[n - 1] - sh[n - 2]; sh[n - 1] = sh[n - 2] + (lastMv > 0 ? -1 : 1) * (r.chance(0.6) ? 1 : 2); }
          const c = cellAt(r, from, lens2, sh, contour, prevM, lastIx, prevCell.anchor + r.pick([0, 0, 1, -1]), 0, lastN);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else {
          const feel = moody ? { q: cell.kind === 'b' && r.chance(PM.contrast) ? -sign(qBase || PM.quick) * 0.7 : qBase, shift: r.chance(PM.shift) ? (r.chance(0.6) ? 'qs' as const : 'sq' as const) : undefined } : undefined;
          lens2 = rhythm(r, from, budget, feel);
          if (cell.kind === 'b' && aLens && lens2.join() === aLens.join()) lens2 = rhythm(r, from, budget, feel);
          const opp: Contour = contour === 'rise' ? 'fall' : contour === 'fall' ? 'rise' : contour === 'arch' ? 'dip' : contour === 'dip' ? 'arch' : 'level';
          const jump = moody && prevM !== null && r.chance(PM.leap * (ci === 0 ? 1.1 : 0.7)) ? (r.chance(PM.jumpUp) ? 1 : -1) : 0;
          const c = cellAt(r, from, lens2, null, cell.kind === 'b' ? opp : contour, prevM, lastIx, cell.kind === 'b' && prevCell ? prevCell.anchor + 2 * dirPref * -1 : null, jump, lastN);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        }
        const ns = placed;
        ns.forEach((n) => p.notes.push({ step: n.step, len: n.len, midi: n.m, vel: 0 }));
        p.anchors.push({ step: ns[0].step, len: ns[0].len, midi: ns[0].m, vel: 0 });
        p.memo[ci] = { lens: lens2, shape, anchor };
        if (cell.kind === 'a') aLens = lens2;
        prevCell = { lens: lens2, shape, anchor };
        prevM = ns[ns.length - 1].m;
        lastN = ns[ns.length - 1];
        lastIx = ixOf(prevM);
      });
      void cellStart;
      prevM = p.goal; lastIx = ixOf(p.goal); lastN = { step: p.goalStep, len: p.hold, m: p.goal };
      void pi;
    });
    if (x.storyScore && plot && hmap) storyOf.set(ph, storyFit(ph));
    return ph;
  };

  // ---- many versions; the best as a tune is played
  const seedBase = rng.next();
  const asHits = (ph: Phrase[]) => ph.flatMap((p) => p.notes).map((n) => ({ step: n.step, len: n.len, notes: [n.midi], strings: [0], vel: 0.8 }) as GuitarHit);
  const aim = moody ? aimFor(mood, profs[0].w) : undefined;
  let bestPh: Phrase[] | null = null, bestScore = -1, bestStory = 0;
  const tried: { ph: Phrase[]; s: number; st: number }[] = [];
  for (let k = 0; k < Math.max(1, tries); k++) {
    const ph = compose(new Rng(`tune-${seedBase}-${k}`));
    tried.push({ ph, s: tuneScore(asHits(ph), { bars, key, chordAt: fit.chordAt }, aim).score, st: storyOf.get(ph) ?? 0 });
  }
  const top = Math.max(...tried.map((t) => t.s));
  // (Story score: among the versions that sound nearly as much like a tune as the best one, and pass as a tune if the best does, the one that tells the plot best)
  const floor = x.storyScore ? Math.max(top - STORY_WINDOW, top >= TUNE_PASS ? TUNE_PASS : -1) : top;
  for (const t of tried) {
    if (t.s < floor - 1e-9) continue;
    if (!bestPh || (x.storyScore ? t.st > bestStory + 1e-9 || (Math.abs(t.st - bestStory) <= 1e-9 && t.s > bestScore + 1e-9) : t.s > bestScore + 1e-9)) { bestPh = t.ph; bestScore = t.s; bestStory = t.st; }
  }
  const phrases = bestPh!;

  // ---- velocities and the hands' places
  const flat = phrases.flatMap((p, pi) => p.notes.map((n, j) => ({ p, pi, n, j })));
  for (const { p, n, j } of flat) {
    const isGoal = j === p.notes.length - 1;
    n.vel = Math.min(1, vel0 + VEL_SWING * E(n.step) + (isBeat(n.step) ? 0.03 : 0) + (n.len > beatOf(n.step) ? 0.03 : 0) + (isGoal && p.role === 'climax' ? 0.12 : 0) + (rng.next() - 0.5) * 0.04);
  }
  const pos = rng.int(5, 12);
  const hits = flat.map(({ n }) => placedHit({ step: n.step, midi: n.midi, len: n.len, vel: n.vel, bend: 0, art: 'pick' }, t, pos)).sort((a, b) => a.step - b.step);

  const gapNotes: GapNote[] = flat.map(({ p, pi, n, j }) => ({ step: n.step, len: n.len, midi: n.midi, phrase: pi, j, role: p.role === 'end' ? 'answer' : p.role, peak: p.role === 'climax' && j === p.notes.length - 1 }));
  const gaps = findGaps(gapNotes, song);
  pickGaps(rng, gaps, { mood, genre, lick, pace: paceAt, echoOf: (q) => (phrases[q]?.src >= 0 ? phrases[q].src : undefined) });

  const r2 = (v: number) => Math.round(v * 100) / 100;
  const landings = phrases.flatMap((p) => {
    const g = p.notes[p.notes.length - 1];
    return [...p.anchors.slice(0, -1).map((a) => ({ step: a.step, midi: a.midi, len: a.len, role: 'mid' as string })), { step: g.step, midi: g.midi, len: g.len, role: p.role as string }];
  });
  const curve: SoloCurve = {
    shape: shapeWord, pitchC: en.pitchC, paceC: en.paceC,
    energy: Array.from({ length: total }, (_, g) => r2(E(g))),
    centre: Array.from({ length: total }, (_, g) => centerAt(g)),
    pace: Array.from({ length: total }, (_, g) => r2(paceAt(g))),
    landings, gaps, neck: true,
  };
  const echoes = phrases.filter((p) => p.src >= 0).length;
  return {
    hits, curve,
    notes: [`Guitar 2: a solo (tune first${moody ? `, ${mood} character` : ''}${plot ? ', story from chords' : ''}${roleNotes ? ', notes follow the chords' : ''}${tenseOn ? ', tension notes' : ''}${x.hand?.length ? ', last note leads into the next chord' : ''}): ${shapeWord}, ${phrases.length} phrases of ${phrases.map((p) => p.b1 - p.b0 + 1).join(' + ')} bars, ${flat.length} notes${echoes ? `, ${echoes} answers play their call's cells again` : ''}; the best of ${Math.max(1, tries)} as a tune${x.storyScore && plot ? ' and a story' : ''} (${bestScore.toFixed(2)}${x.storyScore && plot ? `, story ${bestStory.toFixed(2)}` : ''})`, ...(plot ? plot.lines : [])],
  };
}
