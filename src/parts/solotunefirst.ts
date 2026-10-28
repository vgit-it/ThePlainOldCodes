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
import { lickFit, placedHit } from './licks';
import { BUSY, DENSITY, ENERGY_WORDS, energyAt, pickEnergy } from './solo2';
import { type GapNote, findGaps, pickGaps } from './solomelody-gaps';
import { BREATH_GENRE, BREATH_MOOD, type PlanOpts } from './soloplan';
import { tuneScore } from './solotune';

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** How many versions of a solo are written; the best as a tune is played. */
export const TUNE_TRIES = 12;
/** How much the mood's liking of a move counts against the rest of a note's cost. */
const MOOD_W = 0.35;
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

export function generateSoloTune(rng: Rng, song: Song, chords: ChordPart, riff: GuitarHit[] | null, lick: LickKind, intensity = 0.7, o: PlanOpts = {}, tries = TUNE_TRIES): Guitar2Part {
  const { key, bars, total } = song;
  const genre = song.partGenres.strum;
  const t = song.tuning ?? TUNINGS.standard;
  const fit = lickFit(song, chords, riff);
  const mood: Mood = o.mood ?? 'nostalgic';
  const scale = SCALES[song.mode] as readonly number[];
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
  const E = (g: number) => energyAt(en, clamp(g / total, 0, 1));
  const base = 66 + Math.round(3 * intensity);
  const centerAt = (g: number) => base + Math.round(en.pitchC * en.pitch * E(g));
  const rawWindow = (g: number): [number, number] => [Math.max(50, centerAt(g) - 6), Math.min(83, centerAt(g) + 6)];
  const paceAt = (g: number) => 1 + en.paceC * en.pace * E(g);
  const busy = (DENSITY[genre] * BUSY[lick]) / 5.4;
  const vel0 = 0.8 + 0.08 * intensity;
  const breath = BREATH_MOOD[mood] * BREATH_GENRE[genre];

  // the scale as a ladder: a step on it is one scale step
  const ladder: number[] = [];
  for (let m = 40; m <= 96; m++) if (scale.includes(mod(m - key, 12))) ladder.push(m);
  const ixOf = (m: number) => { let best = 0; for (let i = 1; i < ladder.length; i++) if (Math.abs(ladder[i] - m) < Math.abs(ladder[best] - m)) best = i; return best; };
  const L = (i: number) => ladder[clamp(i, 0, ladder.length - 1)];

  // ---- what one note costs: out of the height, a strong place on a note that is not a chord note, a clash, an ugly move
  interface N0 { step: number; len: number; m: number }
  const noteCost = (n: N0, prev: number | null, lastMove: number) => {
    let c = n.m < 50 || n.m > 86 ? 20 : 0;
    const [lo, hi] = rawWindow(n.step);
    if (n.m < lo) c += 0.5 * (lo - n.m); else if (n.m > hi) c += 0.5 * (n.m - hi);
    const strong = strongAt(n.step, n.len);
    if (strong) { if (!coreOver(n.m, n.step, n.len)) c += 4.5 + (fit.rubs(n.m, n.step) ? 1.5 : 0); }
    else if (n.len >= 4 && !coreOver(n.m, n.step, n.len)) c += 1;
    if (fit.clash(n.m, n.step)) c += 1;
    if (prev !== null) {
      c += MOOD_W * intervalCost(prof(n.step), prev, n.m, lastMove, false);
      const a = Math.abs(n.m - prev);
      if (a === 0 && mood !== 'angry' && mood !== 'tense') c += 1.2;
      if (a > 9) c += 2;
    }
    return c;
  };
  const lineCost = (ns: N0[], prevM: number | null, lastMove0 = 0) => {
    let c = 0, prev = prevM, lm = lastMove0;
    for (const n of ns) { c += noteCost(n, prev, lm); lm = prev === null ? 0 : n.m - prev; prev = n.m; }
    return c;
  };
  const pickCost = <T>(r: Rng, items: { v: T; cost: number }[]): T | null => {
    if (!items.length) return null;
    const lo = Math.min(...items.map((x) => x.cost));
    return r.weighted(items.map((x) => [x.v, Math.exp(-(x.cost - lo) / PICK_T)] as [T, number]));
  };

  // ---- a rhythm: note lengths that fill `budget` steps from `from`, ending on beats, never three alike in a row
  const rhythm = (r: Rng, from: number, budget: number): number[] => {
    const W: Record<number, number> = { 2: 1.1 * busy * paceAt(from), 4: 2.4, 6: 1.1, 8: 0.45, 12: 0.05 };
    for (let tries2 = 0; tries2 < 8; tries2++) {
      const out: number[] = [];
      let pos = from, rem = budget, ok = true;
      while (rem > 0) {
        const items: [number, number][] = [];
        for (const l of [2, 4, 6, 8, 12]) {
          if (l > rem || (rem - l === 1)) continue;
          let w = W[l] * (isBeat(pos + l) || pos + l === from + budget ? 3 : 0.7);
          if (l >= 6 && !isBeat(pos)) w *= 0.25;
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

  /** The cell's notes if its first note is on ladder step `anchor`. */
  const place = (from: number, lens: number[], shape: number[], anchor: number, vel = 0): N0[] => {
    let pos = from;
    return lens.map((len, i) => { const n = { step: pos, len, m: L(anchor + shape[i]) }; pos += len; return n; }).map((n) => (vel ? n : n));
  };
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
  const cellAt = (r: Rng, from: number, lens: number[], memoShape: number[] | null, contour: Contour, prevM: number | null, ref: number | null, bias: number | null) => {
    const items: { v: { shape: number[]; anchor: number }; cost: number }[] = [];
    const shapes = memoShape ? [memoShape] : Array.from({ length: 22 }, () => shapeOf(r, lens.length, contour));
    const anchors = anchorsFor(from, lens[0], bias ?? ref, 6);
    for (const shape of shapes) for (const a of anchors) {
      let c = lineCost(place(from, lens, shape, a), prevM);
      if (ref !== null) c += 0.5 * Math.abs(a - ref) + (a === ref ? 1.5 : 0);
      if (bias !== null) c += 0.9 * Math.abs(a - bias);
      items.push({ v: { shape, anchor: a }, cost: c });
    }
    const pick = pickCost(r, items) ?? { shape: shapes[0], anchor: anchors[0] };
    return { ...pick, notes: repair(place(from, lens, pick.shape, pick.anchor), prevM) };
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
  const compose = (r: Rng) => {
    const nB = bars.length;
    // phrases of 2, 3 or 4 bars
    const lens: number[] = [];
    if (nB <= 3) lens.push(nB);
    else for (let rem = nB; rem > 0;) {
      const opts = ([2, 3, 4] as const).filter((l) => l <= rem && (rem - l === 0 || rem - l >= 2));
      const l = r.weighted(opts.map((x) => [x, x === 2 ? 1.3 : x === 3 ? 0.8 : 1.2] as [number, number]));
      lens.push(l); rem -= l;
    }
    const ph: Phrase[] = [];
    let b0 = 0;
    lens.forEach((len, i) => {
      const S = bars[b0].start, E2 = b0 + len >= nB ? total : bars[b0 + len].start;
      ph.push({ b0, b1: b0 + len - 1, S, E: E2, role: i === lens.length - 1 ? 'end' : i % 2 ? 'answer' : 'call', src: -1, cells: [], goalStep: 0, hold: 0, rest: 0, goal: 0, memo: [], notes: [], anchors: [] });
      b0 += len;
    });
    // the climax: the phrase on the energy's crest (not the last, unless it is the only one)
    let climaxAt = -1, crest = -Infinity;
    ph.forEach((p, i) => { if (i === ph.length - 1 && ph.length > 1) return; let e = -Infinity; for (let g = p.S; g < p.E; g += 4) e = Math.max(e, E(g)); if (e > crest) { crest = e; climaxAt = i; } });
    if (climaxAt >= 0 && ph.length > 1) ph[climaxAt].role = 'climax';
    // answers: a phrase as long as the one before plays its cells again
    ph.forEach((p, i) => {
      if (i === 0) return;
      const q = ph[i - 1], same = p.b1 - p.b0 === q.b1 - q.b0;
      if (same && p.role !== 'climax' && r.chance(i % 2 ? 0.8 : 0.5)) p.src = q.src >= 0 ? q.src : i - 1;
      else if (same && p.role !== 'climax' && i >= 2 && r.chance(0.45)) p.src = 0;
      if (p.src >= 0 && ph[p.src].b1 - ph[p.src].b0 !== p.b1 - p.b0) p.src = -1;
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
      const B = p.E - cs, bs = beatOf(cs);
      const holds = [bs * 2, bs * 3, barAt(cs).len].filter((h) => h <= B - (B >= bs * 2 ? bs : 0) && h >= bs * 1.5);
      const hold = holds.length ? r.pick(holds) : Math.max(2, B);
      p.hold = hold; p.goalStep = p.E - hold;
      p.rest = hold - 2 >= bs * 1.5 && r.chance(clamp(0.28 * breath, 0, 0.7)) ? Math.min(beatOf(p.goalStep), r.pick([2, 4])) : 0;
      if (p.goalStep < cs) { p.goalStep = cs; p.hold = p.E - cs; }
    });

    // ---- the skeleton: the strong notes, one path through the chords' notes
    const target = (p: Phrase) => centerAt(p.goalStep) + (p.role === 'climax' ? 5 : p.role === 'call' ? 1.5 : p.role === 'answer' ? -1.5 : -2);
    const cands = (p: Phrase, cap: number): number[] => {
      const near = (m: number, w: number) => m >= 50 && m <= Math.min(86, cap) && m >= target(p) - w && m <= target(p) + w;
      if (p.role === 'end') {
        const root = ladder.filter((m) => near(m, 12) && mod(m - chordPc(key, fit.chordAt(p.goalStep)), 12) === 0 && coreOver(m, p.goalStep, p.hold));
        if (root.length) return root;
      }
      const whole = ladder.filter((m) => near(m, 9) && coreOver(m, p.goalStep, p.hold));
      if (whole.length) return whole;
      const first = ladder.filter((m) => near(m, 9) && isCore(m, p.goalStep));
      if (first.length) return first;
      const any = ladder.filter((m) => isCore(m, p.goalStep));
      return [any.reduce((b, m) => (Math.abs(m - target(p)) < Math.abs(b - target(p)) ? m : b), any[0] ?? ladder[0])];
    };
    let capAll = 86;
    if (climaxAt >= 0 && ph.length > 1) {
      const top = cands(ph[climaxAt], 86).reduce((b, m) => (Math.abs(m - target(ph[climaxAt])) < Math.abs(b - target(ph[climaxAt])) ? m : b));
      ph[climaxAt].goal = top;
      capAll = top - 3;
    }
    const local = (p: Phrase, m: number) => {
      let c = 0.45 * Math.abs(m - target(p));
      const rootPc = chordPc(key, fit.chordAt(p.goalStep));
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
          let tc = best[i - 1][k].c + MOOD_W * 1.4 * intervalCost(prof(ph[i].goalStep), pm, m, 0, true) + (d === 0 ? 3 : 0) + (Math.abs(d) > 7 ? 1.5 : 0);
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
    ph.forEach((p, pi) => {
      const src = p.src >= 0 ? ph[p.src] : null;
      const contour: Contour = p.role === 'call' ? r.pick(['rise', 'arch', 'arch']) : p.role === 'climax' ? 'rise' : p.role === 'answer' ? r.pick(['fall', 'arch', 'fall']) : r.pick(['fall', 'dip']);
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
            // (near the edge of the range the line comes in from the inside)
            if (p.goal <= 56) dir = 1; else if (p.goal >= 80) dir = -1;
            const pool = Array.from({ length: 24 }, () => {
              const off: number[] = [];
              let o = dir * (r.chance(0.7) ? 1 : 2);
              for (let q = lensR.length - 1; q >= 0; q--) { off[q] = o; o += (r.chance(0.65) ? dir : -dir) * r.weighted([[1, 65], [2, 30], [3, 5]] as [number, number][]); }
              return off;
            });
            const items = pool.map((off) => {
              const ns = place(from, lensR, off.map((x) => x), gi);
              return { v: off, cost: lineCost(ns, prevM) + lineCost([{ step: p.goalStep, len: p.hold, m: p.goal }], ns[ns.length - 1]?.m ?? prevM, 0) };
            });
            const off = pickCost(r, items) ?? pool[0];
            place(from, lensR, off, gi).forEach((n) => p.notes.push({ step: n.step, len: n.len, midi: n.m, vel: 0 }));
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
          const c = cellAt(r, from, lens2, memo.shape, contour, prevM, lastIx, memo.anchor + clamp(nearGoal, -3, 3));
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else if (cell.kind === 'seq' && prevCell && prevCell.lens.reduce((s, x) => s + x, 0) === budget) {
          lens2 = prevCell.lens;
          const d = (r.chance(0.75) ? dirPref : -dirPref) * r.pick([1, 1, 2]);
          const c = cellAt(r, from, lens2, prevCell.shape, contour, prevM, lastIx, prevCell.anchor + d);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else if (cell.kind === 'var' && prevCell && prevCell.lens.reduce((s, x) => s + x, 0) === budget) {
          lens2 = prevCell.lens;
          const sh = prevCell.shape.slice();
          const n = sh.length;
          if (n >= 3) { const lastMv = sh[n - 1] - sh[n - 2]; sh[n - 1] = sh[n - 2] + (lastMv > 0 ? -1 : 1) * (r.chance(0.6) ? 1 : 2); }
          const c = cellAt(r, from, lens2, sh, contour, prevM, lastIx, prevCell.anchor + r.pick([0, 0, 1, -1]));
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        } else {
          lens2 = rhythm(r, from, budget);
          if (cell.kind === 'b' && aLens && lens2.join() === aLens.join()) lens2 = rhythm(r, from, budget);
          const opp: Contour = contour === 'rise' ? 'fall' : contour === 'fall' ? 'rise' : contour === 'arch' ? 'dip' : contour === 'dip' ? 'arch' : 'level';
          const c = cellAt(r, from, lens2, null, cell.kind === 'b' ? opp : contour, prevM, lastIx, cell.kind === 'b' && prevCell ? prevCell.anchor + 2 * dirPref * -1 : null);
          shape = c.shape; anchor = c.anchor; placed = c.notes;
        }
        const ns = placed;
        ns.forEach((n) => p.notes.push({ step: n.step, len: n.len, midi: n.m, vel: 0 }));
        p.anchors.push({ step: ns[0].step, len: ns[0].len, midi: ns[0].m, vel: 0 });
        p.memo[ci] = { lens: lens2, shape, anchor };
        if (cell.kind === 'a') aLens = lens2;
        prevCell = { lens: lens2, shape, anchor };
        prevM = ns[ns.length - 1].m;
        lastIx = ixOf(prevM);
      });
      void cellStart;
      prevM = p.goal; lastIx = ixOf(p.goal);
      void pi;
    });
    return ph;
  };

  // ---- many versions; the best as a tune is played
  const seedBase = rng.next();
  const asHits = (ph: Phrase[]) => ph.flatMap((p) => p.notes).map((n) => ({ step: n.step, len: n.len, notes: [n.midi], strings: [0], vel: 0.8 }) as GuitarHit);
  let bestPh: Phrase[] | null = null, bestScore = -1;
  for (let k = 0; k < Math.max(1, tries); k++) {
    const ph = compose(new Rng(`tune-${seedBase}-${k}`));
    const s = tuneScore(asHits(ph), { bars, key, chordAt: fit.chordAt }).score;
    if (s > bestScore + 1e-9) { bestScore = s; bestPh = ph; }
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
    shape: ENERGY_WORDS[en.shape](en), pitchC: en.pitchC, paceC: en.paceC,
    energy: Array.from({ length: total }, (_, g) => r2(E(g))),
    centre: Array.from({ length: total }, (_, g) => centerAt(g)),
    pace: Array.from({ length: total }, (_, g) => r2(paceAt(g))),
    landings, gaps, neck: true,
  };
  const echoes = phrases.filter((p) => p.src >= 0).length;
  return {
    hits, curve,
    notes: [`Guitar 2: a solo (tune first): ${ENERGY_WORDS[en.shape](en)}, ${phrases.length} phrases of ${phrases.map((p) => p.b1 - p.b0 + 1).join(' + ')} bars, ${flat.length} notes${echoes ? `, ${echoes} answers play their call's cells again` : ''}; the best of ${Math.max(1, tries)} as a tune (${bestScore.toFixed(2)})`],
  };
}
