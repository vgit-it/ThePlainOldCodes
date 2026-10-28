// The solo expression pass (docs/SOLO-EXPRESSION.md): the Tune first melody played the way a guitarist would, not note for note.
// The melody stays (its goal notes, its beats, its contour); the time between is played again, in windows of any length that start
// and end where they like (not on cells or bars). A window is a few parts, each a held note (bent, with vibrato) or a run (8ths, 16ths,
// 32nds, a pedal note, a wave), cut at random places in random proportions: a bent note for three quarters of a bar and a quick run
// for the last quarter, a flurry into a held note, a held note between two flurries.
// What picks them is not a table by mood: it is a player in motion. `heat` drifts with the solo's energy (and jumps now and then);
// `breath` builds while it plays fast and asks for a held note; `itch` builds while it holds and asks for a flurry. The player's own
// temper (drawn once per solo, mood and genre only nudge it) says how hot, how bendy, how free, how contrasty, how fond of pedal notes.
// Many plans are written; the one that reads best as playing (contrast, mixed bars, no regular pattern, relief after a flurry) is kept,
// then the checker and the hands have the last word: a window that breaks either goes back to the melody's own notes.

import type { GuitarHit } from '../idea';
import type { Guitar2Part } from './guitar2';
import type { Mood } from '../tension';
import { Rng } from '../rng';
import { TUNINGS } from '../theory/fretboard';
import { chordTones } from './guitar2';
import { scaleOf } from './solofigure';
import { type LibLick, licksFor, lickFit, placeLibLick } from './licks';
import { POOL } from './sololibrary';
import { type PEvent, TOL, eventsToHits, readBase, snap, sounding } from './soloevents';
import type { PlayerCtx } from './soloplayer';
import { type VCtx, type Violation, MIN_LEGATO_MS, MIN_PICK_MS, unplayable, verify } from './soloverify';

/** How many plans are written; the best as playing is kept. */
export const EXPRESS_TRIES = 8;
/** The share of the melody's notes that must still be there (same start, same pitch) in a plan to count. */
export const KEEP_MIN = 0.6;

type Genre = 'rock' | 'pop' | 'funk' | 'hardrock' | 'metal' | 'grunge' | 'altmetal';
const FIRE_G: Record<string, number> = { pop: 0.4, funk: 0.5, rock: 0.52, grunge: 0.46, hardrock: 0.62, metal: 0.74, altmetal: 0.66 };
const BEND_G: Record<string, number> = { pop: 0.4, funk: 0.35, rock: 0.7, grunge: 0.6, hardrock: 0.65, metal: 0.45, altmetal: 0.5 };
const PEDAL_G: Record<string, number> = { pop: 0.1, funk: 0.2, rock: 0.35, grunge: 0.3, hardrock: 0.6, metal: 0.8, altmetal: 0.6 };
const FIRE_M: Record<Mood, number> = { angry: 0.14, tense: 0.08, triumphant: 0.08, happy: 0.04, dark: 0, nostalgic: -0.08, melancholic: -0.12, dreamy: -0.16 };
const BEND_M: Record<Mood, number> = { melancholic: 0.2, dark: 0.1, nostalgic: 0.1, dreamy: 0.05, tense: 0, angry: 0.05, happy: -0.05, triumphant: 0 };

/** The player's temper for this solo: each 0 to 1. Mood and genre move the middle; the draw is wide, so a metal solo can sing and a calm one can flare. */
export interface Temper { fire: number; bendy: number; free: number; contrast: number; pedal: number }

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const gauss = (r: Rng) => (r.next() + r.next() + r.next() - 1.5) * 2;

export function temperOf(r: Rng, genre: string, mood: Mood): Temper {
  const g = (k: number, spread: number) => clamp(k + gauss(r) * spread, 0.05, 0.95);
  return {
    fire: g((FIRE_G[genre] ?? 0.5) + FIRE_M[mood], 0.2),
    bendy: g((BEND_G[genre] ?? 0.5) + BEND_M[mood], 0.22),
    free: g(0.35, 0.22),
    contrast: g(0.6, 0.2),
    pedal: g(PEDAL_G[genre] ?? 0.3, 0.22),
  };
}

/** Words for the card. */
export function temperWords(t: Temper): string {
  const w = [t.fire > 0.64 ? 'restless' : t.fire < 0.4 ? 'calm' : 'steady'];
  if (t.bendy > 0.62) w.push('bendy');
  if (t.contrast > 0.7) w.push('loves contrast');
  if (t.pedal > 0.6) w.push('fond of pedal notes');
  if (t.free > 0.55) w.push('plays loose with the tune');
  return w.join(', ');
}

type RunShape = 'stair' | 'arch' | 'seq' | 'pedal';
interface Part {
  kind: 'hold' | 'run';
  a: number;
  b: number;
  /** A run: the step between its notes (2: 8ths, 1: 16ths, 0.5: 32nds), and from `mid` on `sub2` (a run that speeds up). */
  sub?: number;
  mid?: number;
  sub2?: number;
  shape?: RunShape;
  legato?: boolean;
}
export interface Win { i: number; j: number; t0: number; t1: number; pattern: string; parts: Part[]; heat: number }
type Pattern = 'plain' | 'decor' | 'hold+run' | 'run+hold' | 'run' | 'hold' | 'hold+run+hold' | 'run+hold+run';
const KINDS: Record<Pattern, ('hold' | 'run')[]> = {
  plain: [], decor: [], hold: ['hold'], run: ['run'],
  'hold+run': ['hold', 'run'], 'run+hold': ['run', 'hold'], 'hold+run+hold': ['hold', 'run', 'hold'], 'run+hold+run': ['run', 'hold', 'run'],
};

/** What one try came to, for the score and the card. */
export interface Try { wins: Win[]; events: PEvent[][]; score: number; keep: number }

export function expressSolo(base: Guitar2Part, c: PlayerCtx, o: { tries?: number; dials?: boolean; recast?: boolean } = {}): Guitar2Part {
  const { events: ev0, notes } = readBase(base.hits, base.curve);
  if (notes.length < 4) return base;
  const { song } = c;
  const genre = song.partGenres.strum as Genre;
  const s16 = 15000 / song.bpm;
  const tuning = (song.tuning ?? TUNINGS.standard).strings;
  const { pcs: scalePcs } = scaleOf(song);
  const energyAt = (t: number) => base.curve?.energy?.[Math.min(song.total - 1, Math.max(0, Math.floor(t)))] ?? 0;
  const barIx = (t: number) => { for (let i = song.bars.length - 1; i >= 0; i--) if (t >= song.bars[i].start - 1e-6) return i; return 0; };
  const chordAt = (t: number) => (c.chords ? c.chords.timeline[c.chords.chordIdx[Math.min(song.total - 1, Math.max(0, Math.floor(t + 1e-6)))]]?.chord : undefined);
  const cSteps = (c.chords?.timeline ?? []).map((e) => e.step);

  // the ladder: the scale's notes, plus the colour notes the melody itself uses (Mood scale turns a 3rd or a 6th; its twin is left out)
  const melPcs = new Set(notes.map((n) => ((n.midi % 12) + 12) % 12));
  const outPcs = [...melPcs].filter((p) => !scalePcs.has(p));
  const pcs = new Set([...scalePcs].filter((p) => !outPcs.some((q) => Math.abs(p - q) === 1 || Math.abs(p - q) === 11)));
  for (const p of outPcs) pcs.add(p);
  const ladder: number[] = [];
  for (let m = 36; m <= 100; m++) if (pcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  const ixOf = (m: number) => { let b = 0; for (let k = 1; k < ladder.length; k++) if (Math.abs(ladder[k] - m) < Math.abs(ladder[b] - m)) b = k; return b; };
  const lo = Math.max(50, tuning[0] + 5, Math.min(...notes.map((n) => n.midi)) - 5), hi = Math.min(86, tuning[5] + 22, Math.max(...notes.map((n) => n.midi)) + 5);
  const isOut = (m: number) => !scalePcs.has(((m % 12) + 12) % 12);
  /** A pitch is a chord note of every chord that changes inside (s, e). */
  const holdsOver = (m: number, s: number, e: number) => cSteps.every((cs) => {
    if (cs <= s + 1e-6 || cs >= e - 1e-6) return true;
    const ch = chordAt(cs);
    return !ch || chordTones(song.key, ch).includes(((m % 12) + 12) % 12);
  });
  /** A goal note of a phrase (call, answer, climax, end) or the last note: it keeps its start, its pitch and its end. */
  const isGoal = (n: { anchor: string; role: string; frozen: boolean }) => n.anchor === 'all' || n.frozen || ['call', 'answer', 'climax', 'end'].includes(n.role);
  const guide = (w: { i: number; j: number }, t: number) => { for (let k = w.j; k >= w.i; k--) if (notes[k].t <= t + TOL) return notes[k]; return notes[w.i]; };

  const mkHit = (n: number): GuitarHit => {
    const { vib: _v, bend: _b, slide: _s, rake: _r, unbend: _u, lateBend: _l, bendAt: _a, trill: _t, tremolo: _m, harm: _h, dive: _d, feedback: _f, scrape: _sc, shift: _sh, ...rest } = ev0[notes[n].ev].hit;
    return rest as GuitarHit;
  };
  const mkEv = (t: number, len: number, pitch: number, vel: number, baseIx: number, extra: Partial<GuitarHit> = {}): PEvent => {
    const out = isOut(pitch);
    const hit: GuitarHit = { ...mkHit(baseIx), step: Math.floor(t + 1e-6), len: snap(len), notes: [pitch], vel: clamp(vel, 0.15, 1.2), exact: true, art: 'pick', ...extra };
    if (len < 1) hit.quick = true;
    if (out) hit.out = true;
    return { t: snap(t), len: snap(len), base: baseIx, hit, ...(out ? { out: true } : {}) };
  };

  // ---------------------------------------------------------------- planning
  const planOne = (r: Rng, T: Temper): Win[] => {
    const wins: Win[] = [];
    let heat = clamp(T.fire, 0.1, 0.9), breath = 0, itch = 0.3;
    let i = 0;
    while (i < notes.length) {
      const n = notes[i];
      const e01 = (energyAt(n.t) + 1) / 2;
      // the heat drifts toward what the solo's energy and the player's fire say, and now and then jumps
      const target = clamp(T.fire + 0.55 * (e01 - 0.5), 0, 1);
      heat = clamp(heat + 0.35 * (target - heat) + gauss(r) * 0.12 * (0.5 + T.contrast), 0, 1);
      if (r.chance(0.07 * (0.4 + T.contrast))) heat = clamp(heat + (r.chance(0.55) ? 1 : -1) * (0.25 + 0.2 * r.next()), 0, 1);
      // how far the window reaches: over the next note or two when it is free to, never over a goal note
      let j = i;
      const reach = isGoal(n) ? 0 : 0.14 + 0.3 * T.free + 0.2 * (heat - 0.5);
      for (let k = 0; k < 2 && r.chance(k ? reach * 0.45 : reach); k++) {
        const nx = notes[j + 1];
        if (!nx || isGoal(nx) || nx.t - (notes[j].t + notes[j].len) > 0.5 || nx.t + nx.len - n.t > 20) break;
        j++;
      }
      const t0 = n.t, t1 = notes[j].t + notes[j].len;
      const W = t1 - t0;
      const runLike = 0.25 + 1.5 * heat + 0.6 * itch, holdLike = 0.25 + 1.2 * (1 - heat) + 0.9 * breath;
      const both = Math.sqrt(runLike * holdLike);
      const frozenish = isGoal(n) || n.len < 2;
      const wt: [Pattern, number][] = [
        ['plain', 0.7 + 0.5 * (1 - T.fire)],
        ['decor', n.len >= 3 ? holdLike * 0.6 : 0],
        ['hold+run', !frozenish && W >= 4 ? 0.9 * both : 0],
        ['run+hold', !frozenish && W >= 4 ? 0.7 * both : 0],
        ['run', !frozenish && W >= 2 ? 0.8 * runLike : 0],
        ['hold', !frozenish && j > i && W >= 5 ? 0.5 * holdLike * (0.4 + T.free) : 0],
        ['hold+run+hold', !frozenish && W >= 9 ? 0.35 * both : 0],
        ['run+hold+run', !frozenish && W >= 9 ? 0.3 * both : 0],
      ];
      let pat: Pattern = r.weighted(wt.filter(([, x]) => x > 0));
      if (pat === 'plain' || pat === 'decor') { j = i; }
      const w: Win = { i, j, t0: n.t, t1: notes[j].t + notes[j].len, pattern: pat, parts: [], heat };
      if (pat !== 'plain' && pat !== 'decor') {
        const parts = cutParts(r, w, KINDS[pat], T, heat);
        if (parts) w.parts = parts; else { w.pattern = 'plain'; w.j = w.i; w.t1 = n.t + n.len; }
      }
      wins.push(w);
      // the pressures: playing fast builds breath, holding builds itch
      const Wn = (w.t1 - w.t0) / 8;
      const runFrac = w.parts.length ? w.parts.filter((p) => p.kind === 'run').reduce((s, p) => s + (p.b - p.a), 0) / (w.t1 - w.t0) : 0;
      const holdFrac = w.parts.length ? 1 - runFrac : w.pattern === 'plain' && n.len < 4 ? 0.3 : 0.9;
      breath = clamp(breath + 0.55 * runFrac * Wn - 0.9 * holdFrac * Wn * (w.parts.length ? 1 : 0.6), 0, 1.5);
      itch = clamp(itch + 0.45 * holdFrac * Wn - 0.85 * runFrac * Wn, 0, 1.5);
      i = w.j + 1;
    }
    return wins;
  };

  /** Cut a window into parts of the given kinds at random places in random proportions; the cuts like a melody note's start. */
  const cutParts = (r: Rng, w: Win, kinds: ('hold' | 'run')[], T: Temper, heat: number): Part[] | null => {
    const W = w.t1 - w.t0;
    const onsets = new Set(notes.slice(w.i + 1, w.j + 1).map((x) => snap(x.t)));
    for (let tryN = 0; tryN < 10; tryN++) {
      // random proportions (not a fixed 3:1)
      const raw = kinds.map((k) => (k === 'hold' ? 0.5 + r.next() * 1.6 : 0.25 + r.next() * 1.1));
      const sum = raw.reduce((a, b) => a + b, 0);
      const cuts: number[] = [];
      let acc = 0, ok = true, prev = w.t0;
      for (let k = 0; k < kinds.length - 1; k++) {
        acc += raw[k] / sum;
        const want = w.t0 + acc * W;
        const cands: [number, number][] = [];
        for (let x = Math.ceil(prev + 2 - 1e-6); x <= w.t1 - 2 + 1e-6; x++) {
          const d = (x - want) / Math.max(1, W * 0.12);
          cands.push([x, Math.exp(-d * d) * (onsets.has(snap(x)) ? 3 : 1) * ((x - w.t0) % 2 === 0 ? 1.4 : 1)]);
        }
        if (!cands.length) { ok = false; break; }
        const x = r.weighted(cands);
        cuts.push(x);
        prev = x;
      }
      if (!ok) continue;
      const edges = [w.t0, ...cuts, w.t1];
      const parts: Part[] = kinds.map((kind, k) => ({ kind, a: edges[k], b: edges[k + 1] }));
      if (parts.some((p) => p.b - p.a < 2 - 1e-6)) continue;
      let good = true;
      for (const p of parts) if (p.kind === 'run') { good = runSetup(r, p, T, heat); if (!good) break; }
      if (good) return parts;
    }
    return null;
  };

  /**
   * A run's grid, shape and hand. Its speed is a speed in time (notes a second), not a note value: the heat sets how many milliseconds
   * between notes, and the grid that is nearest (8ths, 16ths, 32nds) is taken, so 16ths at 65 bpm are not a flurry and at 170 bpm are.
   */
  const runSetup = (r: Rng, p: Part, T: Temper, heat: number): boolean => {
    const L = p.b - p.a;
    // the quickest the heat asks for: from slow (about 260 ms) to a burst (about 60 ms), the player's fire and a roll on top
    const hot = clamp(heat * (0.55 + 0.6 * T.fire) + gauss(r) * 0.12, 0, 1);
    const wantMs = Math.exp(Math.log(260) + (Math.log(58) - Math.log(260)) * hot ** 1.15);
    const maxNotes = heat > 0.85 ? r.int(6, 14) : r.int(4, 9);
    const opts: [number, number][] = [];
    const fits = (sub: number) => Math.abs(L / sub - Math.round(L / sub)) < 1e-6 && L / sub >= 2 && L / sub <= maxNotes;
    for (const sub of [2, 1, 0.5]) {
      if (!fits(sub) || s16 * sub < MIN_LEGATO_MS + 2) continue;
      const d = Math.log((s16 * sub) / wantMs);
      opts.push([sub, Math.exp(-(d * d) / (2 * 0.4 * 0.4))]);
    }
    if (!opts.length) return false;
    p.sub = r.weighted(opts);
    // a run that speeds up: a grid, then one twice as quick
    if (p.sub >= 1 && L >= 4 && L % 2 === 0 && s16 * (p.sub / 2) >= MIN_LEGATO_MS + 2 && L / p.sub + L / p.sub <= maxNotes + 4 && r.chance(0.3 * T.fire * heat)) { p.mid = p.a + L / 2; p.sub2 = p.sub / 2; }
    const fastest = p.sub2 ?? p.sub;
    const canPick = s16 * fastest >= MIN_PICK_MS + 2;
    p.legato = !canPick || r.chance((0.15 + 0.6 * c.hands.legato) * (s16 * fastest >= 110 ? 0.5 : 1));
    const n = slotTimes(p).length;
    p.shape = r.weighted<RunShape>([['stair', 0.7], ['arch', 0.7 + 0.5 * T.contrast], ['seq', n >= 5 ? 1 : 0], ['pedal', n >= 4 ? 0.2 + 1.5 * T.pedal : 0]]);
    return true;
  };
  const slotTimes = (p: Part): number[] => {
    const out: number[] = [];
    const sub = p.sub!;
    for (let t = p.a; t < (p.mid ?? p.b) - 1e-6; t += sub) out.push(snap(t));
    if (p.mid !== undefined) for (let t = p.mid; t < p.b - 1e-6; t += p.sub2!) out.push(snap(t));
    return out;
  };

  // ------------------------------------------------------------ realizing
  /** The pitches between two known notes: `m` notes strictly between, stepwise mostly, ending a step or a third from the target. */
  const fillPath = (r: Rng, pa: number, pb: number, m: number, shape: RunShape, pedalAt: boolean): number[] | null => {
    if (m <= 0) return [];
    const ia = ixOf(pa), ib = ixOf(pb);
    const okIx = (x: number) => x >= 0 && x < ladder.length && ladder[x] >= lo && ladder[x] <= hi;
    if (shape === 'pedal' && pedalAt && m >= 3) {
      const dir = Math.sign(ib - ia) || (r.chance(0.5) ? 1 : -1);
      const out: number[] = [];
      for (let k = 0; k < m; k++) out.push(k % 2 === 0 ? ia + dir * (1 + Math.floor(k / 2) + (r.chance(0.2) ? 1 : 0)) : ia);
      const lastIx = out[m - 1];
      if (Math.abs(lastIx - ib) < 1 || Math.abs(lastIx - ib) > 2) {
        const x = ib - (Math.sign(ib - ia) || 1);
        if (x !== out[m - 2] && Math.abs(x - (out[m - 2] ?? ia)) <= 4) out[m - 1] = x; else return null;
      }
      if (out.some((x, k) => !okIx(x) || x === (out[k - 1] ?? ia))) return null;
      return out.map((x) => ladder[x]);
    }
    if (shape === 'seq' && m >= 5) {
      const dir = Math.abs(ib - ia) * 3 >= m ? Math.sign(ib - ia) : r.chance(0.5) ? 1 : -1;
      const cells = [[0, 1, 2], [0, 2, 1], [0, 1, 2, 1], [2, 1, 0], [0, 1, 0, 2]];
      const cell = r.pick(cells);
      const out: number[] = [];
      for (let k = 0; k < m; k++) out.push(ia + dir * (1 + Math.floor(k / cell.length) + cell[k % cell.length]));
      const d = Math.abs(out[m - 1] - ib);
      if (d < 1 || d > 2) {
        const x = ib - (Math.sign(ib - out[m - 2]) || 1);
        if (x === out[m - 2] || Math.abs(x - out[m - 2]) > 3) return null;
        out[m - 1] = x;
      }
      if (out.some((x, k) => !okIx(x) || x === (out[k - 1] ?? ia))) return null;
      return out.map((x) => ladder[x]);
    }
    const out: number[] = [];
    let cur = ia;
    // an arch goes up (or down) to a peak first, then to the target; a stair goes straight at the target
    const up = r.chance(0.7);
    const peak = shape === 'arch' ? (up ? Math.max(ia, ib) + r.int(1, 3) : Math.min(ia, ib) - r.int(1, 3)) : ib;
    const kp = Math.max(1, Math.round(m * (0.35 + 0.3 * r.next())));
    const pull = shape === 'arch' ? 2.5 : 3;
    for (let k = 0; k < m; k++) {
      const rem = m - 1 - k;
      const goal = shape === 'arch' && k < kp ? peak : ib;
      const ch: [number, number][] = [];
      for (const d of [-2, -1, 1, 2]) {
        const x = cur + d;
        if (!okIx(x)) continue;
        if (rem === 0 ? Math.abs(x - ib) < 1 || Math.abs(x - ib) > 2 : Math.abs(x - ib) > 2 * rem + 2) continue;
        if (out.length && x === out[out.length - 1]) continue;
        let wt = Math.abs(d) === 1 ? 1 : 0.22;
        if (Math.sign(goal - cur) === Math.sign(d)) wt *= 1 + pull;
        if (out.length >= 2 && x === out[out.length - 2]) wt *= 0.3;
        ch.push([x, wt]);
      }
      if (!ch.length) return null;
      cur = r.weighted(ch);
      out.push(cur);
    }
    return out.map((x) => ladder[x]);
  };

  /** A held note: bends and vibrato by the player's bendiness and the note's place; the pitch it sounds ends on is `pitch`. */
  const decorOf = (r: Rng, pitch: number, len: number, T: Temper, strong: number, thinTo?: number): Partial<GuitarHit> => {
    const out: Partial<GuitarHit> = {};
    if (len >= 3 && r.chance(0.8)) out.vib = r.int(22, 48);
    if (thinTo !== undefined) { out.lateBend = thinTo; delete out.vib; return out; }
    const below = ladder[ixOf(pitch) - 1];
    const d = pitch - below;
    if (!(d >= 1 && d <= 2) || len < 2) return out;
    const b = T.bendy * strong;
    const kind = r.weighted<string>([['none', 1.1], ['pre', len >= 2 ? 0.5 * b : 0], ['late', len >= 6 ? 0.9 * b : 0], ['release', len >= 6 ? 0.5 * b : 0]]);
    if (kind === 'pre') out.bend = d;
    else if (kind === 'late') { out.lateBend = d; delete out.vib; if (r.chance(0.5)) out.vib = r.int(22, 48); }
    else if (kind === 'release') { out.bend = d; out.unbend = d; }
    return out;
  };

  const realize = (w: Win, r: Rng, T: Temper): PEvent[] | null => {
    const n0 = notes[w.i];
    const strong = n0.role === 'climax' ? 1.5 : n0.role === 'end' ? 1.2 : isGoal(n0) ? 1.1 : 0.8 + (n0.len >= 6 ? 0.3 : 0);
    if (w.pattern === 'plain') {
      const ev = ev0[n0.ev];
      return [ev];
    }
    if (w.pattern === 'decor') {
      const dec = decorOf(r, n0.midi, n0.len, T, strong);
      if (!Object.keys(dec).length) return [ev0[n0.ev]];
      if (n0.len < 4 && !dec.bend) return [ev0[n0.ev]];
      return [{ ...ev0[n0.ev], hit: { ...ev0[n0.ev].hit, ...dec } }];
    }
    const out: PEvent[] = [];
    let prevPitch: number | null = null;
    const vel0 = ev0[n0.ev].hit.vel;
    for (let k = 0; k < w.parts.length; k++) {
      const p = w.parts[k];
      const g = guide(w, p.a);
      if (p.kind === 'hold') {
        let pitch = g.midi;
        let thin: number | undefined;
        if (w.pattern === 'hold' && w.parts.length === 1) {
          const dn = notes[w.j].midi - n0.midi;
          if (dn >= 1 && dn <= 2 && r.chance(0.7 * (0.4 + T.bendy))) { pitch = notes[w.j].midi; thin = dn; }
        }
        if (!holdsOver(pitch, p.a, p.b)) return null;
        const dec = decorOf(r, pitch, p.b - p.a, T, strong, thin);
        out.push(mkEv(p.a, p.b - p.a, pitch, vel0 + (k === 0 ? 0.02 : 0), g.i, dec));
        prevPitch = pitch;
      } else {
        const slots = slotTimes(p);
        const nx = notes[w.j + 1] ?? notes[w.j];
        // where the run is going: the next part's note, or the melody's next note
        const target = k === w.parts.length - 1 ? nx.midi : guide(w, w.parts[k + 1].a).midi;
        const fixed = new Map<number, number>();
        slots.forEach((t, s) => { const hit = notes.slice(w.i, w.j + 1).find((x) => Math.abs(x.t - t) <= TOL); if (hit) fixed.set(s, hit.midi); });
        if (prevPitch === null && !fixed.has(0)) fixed.set(0, n0.midi);
        const way: { s: number; m: number }[] = [];
        if (prevPitch !== null) way.push({ s: -1, m: prevPitch });
        for (const [s, m] of [...fixed].sort((a, b) => a[0] - b[0])) way.push({ s, m });
        way.push({ s: slots.length, m: target });
        const pitches: number[] = new Array(slots.length).fill(0);
        for (const [s, m] of fixed) pitches[s] = m;
        for (let q = 0; q + 1 < way.length; q++) {
          const a = way[q], b = way[q + 1];
          const free = b.s - a.s - 1;
          if (free <= 0) continue;
          const got = fillPath(r, a.m, b.m, free, p.shape!, a.s === -1 || q === 0);
          const fb = got ?? fillPath(r, a.m, b.m, free, 'stair', true);
          if (!fb) return null;
          fb.forEach((m, z) => { pitches[a.s + 1 + z] = m; });
        }
        const gi = (t: number) => guide(w, t).i;
        // the legato groups: one pick, then hammered and pulled; when the pick cannot go that fast, the whole run is one group
        const gsize = p.legato ? (s16 * Math.min(p.sub!, p.sub2 ?? 9) >= MIN_PICK_MS + 2 ? r.pick([2, 3, 4]) : 99) : 1;
        slots.forEach((t, s) => {
          const accent = fixed.has(s);
          const len = s + 1 < slots.length ? slots[s + 1] - t : p.b - t;
          const pickIt = s % gsize === 0;
          const rampUp = 1 + 0.1 * (s / Math.max(1, slots.length - 1));
          out.push(mkEv(t, len, pitches[s], vel0 * (accent ? 1.0 : 0.8) * rampUp, gi(t), { art: pickIt ? 'pick' : 'legato' }));
        });
        prevPitch = pitches[slots.length - 1];
      }
    }
    return out;
  };

  // ----------------------------------------------------------- scoring
  const features = (wins: Win[], evs: PEvent[][]) => {
    const per = wins.map((w, k) => {
      const e = evs[k].filter((x) => sounding(x.hit));
      const W = Math.max(1, w.t1 - w.t0);
      return { w, pace: e.length / W, fast: e.filter((x) => x.len * s16 <= 150).length, holdSteps: e.filter((x) => x.len * s16 >= 420).reduce((s, x) => s + x.len, 0), changed: w.pattern !== 'plain' };
    });
    return per;
  };
  const keepOf = (evs: PEvent[][]) => {
    const all = evs.flat();
    let kept = 0;
    for (const n of notes) if (all.some((e) => sounding(e.hit) && Math.abs(e.t - n.t) <= TOL && (e.hit.notes[0] === n.midi || e.hit.notes[0] - (e.hit.lateBend ?? 0) === n.midi))) kept++;
    return kept / notes.length;
  };
  const score = (wins: Win[], evs: PEvent[][]): { score: number; keep: number } => {
    const f = features(wins, evs);
    const keep = keepOf(evs);
    const changedShare = f.filter((x) => x.changed).length / f.length;
    let contrast = 0;
    for (let k = 1; k < f.length; k++) contrast += clamp(Math.abs(Math.log2((f[k].pace + 0.05) / (f[k - 1].pace + 0.05))), 0, 2) / 2;
    contrast /= Math.max(1, f.length - 1);
    const contrastS = clamp(1 - Math.abs(contrast - 0.35) / 0.35, 0, 1);
    // mixed bars: a held note (a beat or more) and three quick notes in the same bar
    let mixed = 0;
    const barFast = song.bars.map(() => 0), barHold = song.bars.map(() => 0);
    for (const e of evs.flat()) if (sounding(e.hit)) { const b = barIx(e.t); if (e.len * s16 <= 150) barFast[b]++; if (e.len * s16 >= 420) barHold[b]++; }
    song.bars.forEach((_, b) => { if (barFast[b] >= 3 && barHold[b] >= 1) mixed++; });
    const mixedShare = mixed / song.bars.length;
    const mixedS = mixedShare < 0.15 ? mixedShare / 0.15 : mixedShare > 0.5 ? clamp(1 - (mixedShare - 0.5) / 0.5, 0, 1) : 1;
    // no regular pattern: the longest stretch of bars in one pace
    const bucket = barFast.map((x) => (x < 2 ? 0 : x < 7 ? 1 : 2));
    let longest = 1, run = 1;
    for (let b = 1; b < bucket.length; b++) { run = bucket[b] === bucket[b - 1] ? run + 1 : 1; longest = Math.max(longest, run); }
    const regularS = song.bars.length < 6 ? 1 : clamp(1 - (longest - 3) / 4, 0, 1);
    const kinds = new Set(wins.filter((w) => w.pattern !== 'plain' && w.pattern !== 'decor').map((w) => w.pattern));
    const varietyS = clamp(kinds.size / 4, 0, 1);
    // relief: after a flurry (six quick notes) a held note comes within the next two windows
    let fl = 0, rel = 0;
    f.forEach((x, k) => { if (x.fast >= 6) { fl++; if (f.slice(k, k + 3).some((y) => y.holdSteps >= 4)) rel++; } });
    const reliefS = fl ? rel / fl : 0.8;
    const s = 0.25 * contrastS + 0.25 * mixedS + 0.2 * regularS + 0.1 * varietyS + 0.2 * reliefS - (keep < KEEP_MIN ? 1 : 0) - (changedShare < 0.25 ? 0.5 : 0);
    return { score: s, keep };
  };

  // ------------------------------------------------------------ the tries
  const T = temperOf(new Rng(`${c.seed}-express-temper`), genre, c.mood);
  const tries = o.tries ?? EXPRESS_TRIES;
  let best: Try | null = null;
  for (let k = 0; k < Math.max(1, tries); k++) {
    const r = new Rng(`${c.seed}-express-${k}`);
    const wins = planOne(r, T);
    const events = wins.map((w, q) => {
      const ev = realize(w, new Rng(`${c.seed}-express-${k}-w${q}`), T);
      if (ev) return ev;
      w.pattern = 'plain'; w.parts = []; w.j = w.i; w.t1 = notes[w.i].t + notes[w.i].len;
      return [ev0[notes[w.i].ev]];
    });
    // (a window that fell back to the plain note leaves the notes it had reached over: they are windows of their own now)
    const fixedWins: Win[] = [], fixedEvents: PEvent[][] = [];
    wins.forEach((w, q) => {
      fixedWins.push(w); fixedEvents.push(events[q]);
    });
    const covered = new Set(fixedWins.flatMap((w) => Array.from({ length: w.j - w.i + 1 }, (_, z) => w.i + z)));
    for (let z = 0; z < notes.length; z++) if (!covered.has(z)) { fixedWins.push({ i: z, j: z, t0: notes[z].t, t1: notes[z].t + notes[z].len, pattern: 'plain', parts: [], heat: 0 }); fixedEvents.push([ev0[notes[z].ev]]); }
    const order = fixedWins.map((_, q) => q).sort((a, b) => fixedWins[a].t0 - fixedWins[b].t0);
    const ws = order.map((q) => fixedWins[q]), es = order.map((q) => fixedEvents[q]);
    const sc = score(ws, es);
    if (!best || sc.score > best.score) best = { wins: ws, events: es, score: sc.score, keep: sc.keep };
  }
  const chosen = best!;

  // --------------------------------------------- the checker and the hands
  const vctx: VCtx = { song, chords: c.chords, gaps: base.curve?.gaps ?? [], hands: c.hands, energy: c.energy, kind: c.kind, curve: base.curve, loose: true };
  const noteEvents = new Set(notes.map((n) => n.ev));
  const others = ev0.filter((_, k) => !noteEvents.has(k));
  const assemble = () => [...others, ...chosen.events.flat()];
  const vkey = (v: Violation) => `${v.code}@${v.at.toFixed(2)}`;
  const baseline = new Set(verify(ev0, notes, vctx).map(vkey));
  const baseBad = new Set(unplayable(ev0, vctx));
  /** The windows that were recast, with what they were before (a miss gives the window its plain run back first, then the tune's notes). */
  const precast = new Map<number, PEvent[]>();
  const fresh = () => ({ lick: 0, roll: 0, pedal: 0, trill: 0, slideIn: 0, heldTrill: 0 });
  /** What each recast window holds (for the card: counted after the checker has had its say). */
  const castOf = new Map<number, ReturnType<typeof fresh>>();
  const revert = (q: number) => {
    const pre = precast.get(q);
    if (pre) { chosen.events[q] = pre; precast.delete(q); castOf.delete(q); return; }
    const w = chosen.wins[q];
    w.pattern = 'plain'; w.parts = [];
    chosen.events[q] = Array.from({ length: w.j - w.i + 1 }, (_, z) => ev0[notes[w.i + z].ev]);
  };
  const winAt = (t: number) => { let b = -1; chosen.wins.forEach((w, q) => { if (t >= w.t0 - 1 - 1e-6 && t <= w.t1 + 1e-6 && w.pattern !== 'plain') b = q; }); return b; };

  // ------------------------------------------------ the recast (docs/SOLO-RECAST.md)
  // After the plan is chosen (so the tune and the windows stay as they were), some runs become something with a name: a lick from the
  // library, a legato roll (picked once per group, the rest hammered and pulled), a pedal figure (a high note again and again between
  // climbing notes), a trill climb; and some held notes slide in or trill. Its own seed per window.
  let cast = fresh();
  const inRange = (x: number) => x >= 0 && x < ladder.length && ladder[x] >= lo && ladder[x] <= hi;
  const dressHold = (r: Rng, e: PEvent): PEvent => {
    const h = e.hit;
    if (!sounding(h) || h.bend || h.lateBend || h.unbend || h.slide || h.trill || e.len < 3) return e;
    const n = notes.find((x) => Math.abs(x.t - e.t) <= TOL);
    const big = n?.role === 'climax' || n?.role === 'end';
    const pitch = h.notes[0];
    const up = (ladder[ixOf(pitch) + 1] ?? 0) - pitch;
    const kind = r.weighted<string>([['none', 2.2], ['slide', 0.25 + 1.5 * c.hands.slide], ['trill', e.len >= 4 && !big && up >= 1 && up <= 2 ? 0.15 + 0.9 * c.hands.legato : 0]]);
    if (kind === 'none') return e;
    const out: GuitarHit = { ...h };
    if (kind === 'slide') { out.slide = r.chance(0.7) ? -r.int(2, 5) : r.int(2, 3); cast.slideIn++; }
    else { out.trill = up; delete out.vib; cast.heldTrill++; }
    return { ...e, hit: out };
  };
  const recast = () => {
    const fit = c.chords ? lickFit(song, c.chords, null) : null;
    const line = assemble().filter((e) => sounding(e.hit)).sort((a, b) => a.t - b.t);
    const used = new Map<string, number>();
    /** Library licks (a fast or mid one, plain enough for the hands) that fit `L` steps over a chord, cut down from the start where they are longer. */
    const lickChoices = (L: number, chord: ReturnType<typeof chordAt>): [{ l: LibLick; from: number }, number][] => {
      if (!chord) return [];
      const ok = new Set<LibLick>();
      for (const who of ['run', 'simple', 'sung', 'blues'] as const) for (const l of licksFor(who, null, chord)) ok.add(l);
      const out: [{ l: LibLick; from: number }, number][] = [];
      for (const l of ok) {
        if (l.speed === 'slow' || l.notes.some((n) => n.dyad !== undefined || n.dead || n.rake || n.harm || n.dive || n.feedback || n.scrape || n.tremolo)) continue;
        const pool = POOL.find((x) => x.lick === l);
        for (let f = 0; f <= l.notes.length - 3; f++) {
          const rem = l.span - l.notes[f].pos;
          if (rem > L + 1e-6) continue;
          if (rem < L - 1.01) break;
          // (the quickest gap between two of its notes must be one the hand can play)
          const tail = l.notes.slice(f);
          if (tail.some((n, k) => k > 0 && (n.pos - tail[k - 1].pos) * s16 < (n.art === 'legato' || n.art === 'slide' ? MIN_LEGATO_MS : MIN_PICK_MS) + 2)) break;
          const w = (pool?.genres.includes(genre) ? 2 : 1) * (pool?.moods.includes(c.mood) ? 1.5 : 1) * (l.speed === 'fast' ? 1.3 : 1) / (1 + 2 * (used.get(l.name) ?? 0));
          out.push([{ l, from: f }, w]);
          break;
        }
      }
      return out;
    };
    const recastRun = (r: Rng, w: Win, p: Part, slice: PEvent[], out: PEvent[]): PEvent[] | null => {
      const n = slice.length, L = p.b - p.a;
      if (n < 3) return null;
      const gi = (t: number) => guide(w, t).i;
      const gaps = slice.map((e, s) => ((slice[s + 1]?.t ?? p.b) - e.t) * s16);
      const minGap = Math.min(...gaps);
      const canLegato = minGap >= MIN_LEGATO_MS + 2, canPick = minGap >= MIN_PICK_MS + 2;
      const after = line.find((e) => e.t >= p.b - TOL);
      const target = after?.hit.notes[0];
      let before: PEvent | undefined;
      for (const e of line) if (e.t < p.a - TOL) before = e;
      const first = slice[0].hit.notes[0];
      const prev = before?.hit.notes[0] ?? first;
      const ia = ixOf(first);
      const rebuild = (pitches: number[], arts: ('pick' | 'legato')[], vels: number[]) => slice.map((e, s) => mkEv(e.t, e.len, pitches[s], vels[s], e.base ?? gi(e.t), { art: arts[s] }));
      const sameAs = (evs: PEvent[]) => evs.every((e, s) => e.hit.notes[0] === slice[s].hit.notes[0] && e.hit.art === slice[s].hit.art);

      const lick = (): PEvent[] | null => {
        const chord = chordAt(p.a);
        if (!fit || L < 4) return null;
        const cand = lickChoices(L, chord);
        for (let tryN = 0; tryN < 3 && cand.length; tryN++) {
          const k = cand.indexOf(r.weighted(cand.map((x) => [x, x[1]] as [typeof x, number])));
          const { l, from } = cand.splice(k, 1)[0][0];
          const placed = placeLibLick(r, fit, song.key, l, p.b, lo, hi, prev, 'any', l.who[0], slice[0].hit.vel * 0.9, from);
          if (!placed || placed.length < 3) continue;
          const gap = placed[0].step - p.a;
          const last = placed[placed.length - 1].midi;
          if (gap < -TOL || gap > 1 + TOL || (gap > TOL && !out.length)) continue;
          if (Math.abs(placed[0].midi - prev) > 7 || placed.some((x) => x.step + x.len > p.b + TOL)) continue;
          if (target !== undefined && (Math.abs(last - target) < 1 || Math.abs(last - target) > 5)) continue;
          // (a one-step gap before it: the note before is held a step longer)
          if (gap > TOL) { const e = out[out.length - 1]; out[out.length - 1] = { ...e, len: snap(e.len + gap), hit: { ...e.hit, len: snap(e.len + gap) } }; }
          used.set(l.name, (used.get(l.name) ?? 0) + 1);
          cast.lick++;
          return placed.map((x, s) => {
            const ex: Partial<GuitarHit> = { art: x.art === 'legato' || x.art === 'slide' ? x.art : 'pick' };
            if (x.bend) ex.bend = x.bend;
            if (x.unbend) ex.unbend = x.unbend;
            if (x.trill) ex.trill = x.trill;
            if (x.vib) ex.vib = x.vib;
            return mkEv(x.step, x.len, x.midi, x.vel, gi(x.step), s === 0 ? { ...ex, art: 'pick' } : ex);
          });
        }
        return null;
      };

      /** A legato roll: the scale in groups (2, 3 or 4), a group picked once and the rest hammered and pulled, each group one step on from the last. */
      const roll = (): PEvent[] | null => {
        if (n < 5 || !canLegato) return null;
        const g = r.pick([2, 3, 3, 4]);
        if (g > 1 && minGap * g < MIN_PICK_MS + 2) return null;
        const ib = target === undefined ? ia : ixOf(target);
        const dir = ib !== ia ? Math.sign(ib - ia) : r.chance(0.5) ? 1 : -1;
        const ix = slice.map((_, s) => ia + dir * (Math.floor(s / g) + (s % g)));
        if (target !== undefined) {
          const d = Math.abs(ix[n - 1] - ib);
          if (d < 1 || d > 2) { const x = ib - (Math.sign(ib - ix[n - 2]) || 1); if (x === ix[n - 2] || Math.abs(x - ix[n - 2]) > 3) return null; ix[n - 1] = x; }
        }
        if (ix.some((x, s) => !inRange(x) || (s > 0 && x === ix[s - 1]))) return null;
        const evs = rebuild(ix.map((x) => ladder[x]), slice.map((_, s) => (s % g === 0 ? 'pick' : 'legato')), slice.map((e) => e.hit.vel));
        if (sameAs(evs)) return null;
        cast.roll++;
        return evs;
      };

      /** A pedal figure: climbing (or falling) notes with a high note struck between them again and again, the last note a step or a third from the target. */
      const pedal = (): PEvent[] | null => {
        if (n < 5 || target === undefined || !canLegato) return null;
        const ib = ixOf(target), P = ib + (Math.sign(ib - ia) || 1) * r.int(1, 2);
        if (!inRange(P)) return null;
        const mv = Math.ceil(n / 2);
        const walk = mv > 1 ? fillPath(r, first, target, mv - 1, 'stair', true) : [];
        if (!walk) return null;
        const movers = [first, ...walk];
        const pitches = slice.map((_, s) => (s % 2 === 0 ? movers[s / 2] : ladder[P]));
        if (pitches.some((m, s) => s > 0 && m === pitches[s - 1])) return null;
        const arts = slice.map((_, s) => (s === 0 || canPick ? 'pick' : 'legato') as 'pick' | 'legato');
        const v0 = slice[0].hit.vel;
        cast.pedal++;
        return rebuild(pitches, arts, slice.map((_, s) => v0 * (s % 2 === 1 ? 1 : 0.88)));
      };

      /** A trill climb: two neighbouring notes traded hammered and pulled, then two quick steps onto the target. */
      const trill = (): PEvent[] | null => {
        if (n < 5 || target === undefined || !canLegato) return null;
        const dir = inRange(ia + 1) && (r.chance(0.5) || !inRange(ia - 1)) ? 1 : -1;
        if (!inRange(ia + dir)) return null;
        const A = first, B = ladder[ia + dir];
        const alt = slice.slice(0, n - 2).map((_, s) => (s % 2 === 0 ? A : B));
        const tail = fillPath(r, alt[alt.length - 1], target, 2, 'stair', true);
        if (!tail) return null;
        const arts = slice.map((_, s) => (s === 0 || (s >= n - 2 && canPick) ? 'pick' : 'legato') as 'pick' | 'legato');
        cast.trill++;
        return rebuild([...alt, ...tail], arts, slice.map((e) => e.hit.vel));
      };

      const how = r.weighted<string>([
        ['none', 1.3],
        ['lick', fit && L >= 4 ? 1.2 : 0],
        ['roll', n >= 5 && canLegato ? 0.5 + 1.2 * c.hands.legato : 0],
        ['pedal', n >= 5 && canLegato ? 0.15 + 1.6 * T.pedal : 0],
        ['trill', n >= 5 && canLegato ? 0.1 + 0.9 * c.hands.legato : 0],
      ]);
      if (how === 'lick') return lick();
      if (how === 'roll') return roll();
      if (how === 'pedal') return pedal();
      if (how === 'trill') return trill();
      return null;
    };
    chosen.wins.forEach((w, q) => {
      if (w.pattern === 'plain') return;
      const r = new Rng(`${c.seed}-express-recast-${q}`);
      const was = chosen.events[q];
      cast = fresh();
      if (w.pattern === 'decor') {
        const e = dressHold(r, was[0]);
        if (e !== was[0]) { precast.set(q, was); castOf.set(q, cast); chosen.events[q] = [e]; }
        return;
      }
      if (was.some((e) => !w.parts.some((p) => e.t >= p.a - TOL && e.t < p.b - TOL))) return;
      const out: PEvent[] = [];
      let changed = false;
      for (const p of w.parts) {
        const slice = was.filter((e) => e.t >= p.a - TOL && e.t < p.b - TOL);
        if (!slice.length) continue;
        if (p.kind === 'hold') {
          const e = dressHold(r, slice[0]);
          if (e !== slice[0]) changed = true;
          out.push(e, ...slice.slice(1));
          continue;
        }
        const got = recastRun(r, w, p, slice, out);
        if (got) { changed = true; out.push(...got); } else out.push(...slice);
      }
      if (changed) { precast.set(q, was); castOf.set(q, cast); chosen.events[q] = out; }
    });
  };
  if (o.recast) recast();
  for (let guard = 0; guard < 8; guard++) {
    const fresh = verify(assemble(), notes, vctx).filter((v) => !baseline.has(vkey(v)));
    if (!fresh.length) break;
    const qs = new Set(fresh.map((v) => winAt(v.at)).filter((q) => q >= 0));
    if (!qs.size) break;
    for (const q of qs) revert(q);
  }
  for (let guard = 0; guard < 12; guard++) {
    const bad = unplayable(assemble(), vctx).filter((e) => !baseBad.has(e));
    if (!bad.length) break;
    const qs = new Set<number>();
    for (const e of bad) chosen.events.forEach((evs, q) => { if (evs.includes(e) && chosen.wins[q].pattern !== 'plain') qs.add(q); });
    if (!qs.size) break;
    for (const q of qs) revert(q);
  }

  // ---------------------------------------------------- the bend dials (docs/SOLO-BENDS.md)
  // How fast each bent note bends, the shape of the bend, and when in the note it happens: from the note's place (the climax and the
  // last note sing, slowly; a goal note leans) and its neighbours (a quick note right after is a snap). Its own seed: the tune,
  // the windows and the bends themselves are as they were, only the way they are played changes.
  let dialed = 0;
  const dialBends = (hs: GuitarHit[]): GuitarHit[] => {
    const live = hs.filter((h) => sounding(h));
    const startOf = (h: GuitarHit) => h.step + (h.shift ?? 0);
    return hs.map((h) => {
      if (!sounding(h) || !(h.bend || h.lateBend || h.unbend)) return h;
      const t = startOf(h), sec = (h.len * s16) / 1000;
      const nx = live[live.indexOf(h) + 1];
      const role = notes.find((n) => Math.abs(n.t - t) <= TOL)?.role ?? '';
      const big = role === 'climax' || role === 'end';
      const goal = big || role === 'call' || role === 'answer';
      // (a quick note straight after: no time for a slow bend)
      const hurry = !!nx && startOf(nx) - (t + h.len) < 1 && nx.len * s16 <= 160;
      const r = new Rng(`${c.seed}-express-dials-${Math.round(t * 8)}`);
      const u = (lo: number, hi: number) => lo + (hi - lo) * r.next();
      const out: GuitarHit = { ...h };
      const late = !!h.lateBend, release = !!h.unbend;
      // when in the note the bend happens (a pre-bend does it at the pick)
      if (late || release) {
        const frac = release ? (big ? u(0.5, 0.75) : u(0.4, 0.65)) : big ? u(0.4, 0.65) : u(0.2, 0.5);
        out.bendAt = Math.max(0.5, Math.round(frac * h.len * 4) / 4);
      }
      const left = sec - (out.bendAt !== undefined ? (out.bendAt * s16) / 1000 : 0);
      let ms: number, ease: number;
      const kind = r.weighted<string>([['snap', hurry || left < 0.3 ? 4 : 1], ['mid', 1.6], ['crawl', left >= 0.55 ? (big ? 3 : goal ? 1.2 : 0.5) : 0]]);
      if (kind === 'snap') { ms = u(35, 85); ease = 0.7; }
      else if (kind === 'mid') { ms = u(120, 250); ease = r.pick([1, 1, 1.25]); }
      else { ms = u(300, 900); ease = r.pick([0.8, 1.4, 1.8]); }
      // a bend can't take longer than what's left of the note
      ms = Math.min(ms, left * 700);
      // (a bend up and let down again: the let-down comes after the bend up)
      if (release && h.bend && out.bendAt !== undefined) ms = Math.min(ms, out.bendAt * s16 * 0.9);
      out.bendRise = Math.max(30, Math.round(ms));
      out.bendEase = ease;
      dialed++;
      return out;
    });
  };

  // (counted after the checker has had its say: a recast window it sent back is not in the tally)
  const recastWords = () => {
    const sum = fresh();
    for (const x of castOf.values()) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += x[k];
    return `${sum.lick} licks, ${sum.roll} legato rolls, ${sum.pedal} pedal figures, ${sum.trill} trill climbs, ${sum.slideIn} slide-ins, ${sum.heldTrill} held-note trills`;
  };

  const events = assemble();
  let hits = eventsToHits(events);
  if (o.dials) hits = dialBends(hits);
  const changed = chosen.wins.filter((w) => w.pattern !== 'plain');
  const tally = new Map<string, number>();
  for (const w of changed) tally.set(w.pattern, (tally.get(w.pattern) ?? 0) + 1);
  const keep = keepOf(chosen.events);
  const words = temperWords(T);
  const fine = hits.some((h) => h.shift || h.exact);
  return {
    hits,
    notes: [...base.notes, `Solo expression (${words}): ${changed.length} of ${chosen.wins.length} windows played another way (${[...tally].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}); ${Math.round(keep * 100)}% of the tune's notes kept where they were${o.dials ? `; ${dialed} bends with their own speed and shape` : ''}${o.recast ? `; recast: ${recastWords()}` : ''}`],
    curve: base.curve ? { ...base.curve, express: chosen.wins.map((w) => ({ t0: w.t0, t1: w.t1, pattern: w.pattern, heat: Math.round(w.heat * 100) / 100 })), ...(fine ? { fine: true } : {}) } : undefined,
  };
}
