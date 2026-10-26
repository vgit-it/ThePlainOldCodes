// The story, told in licks (docs/SOLO-RECIPES.md, stage 2). Each part of the story (docs/SOLO-STORY.md) gets its own recipe instead of a
// move picked from the list: a sung phrase (8ths and quarters, one slight bend) ending in a held note and a quick tag (a bend let down and
// pulled off, a unison bend, a quick run); a ramp of fast notes climbing from the bottom of the range into the climax; a short rising build;
// a long note falling, pulled off, after the climax. Gaps the size of the opening play it again, with the tag changed. Link gaps and gaps
// too short for a phrase stay silent. The cores are not touched. Same story, same seed: same notes.
// With the library on (docs/SOLO-LIBRARY.md) the named licks of the recipe lab join the recipes, and the gaps are strung together: wherever
// more than a beat would be left silent, recipes are laid end to end until no rest is longer than a beat.

import type { StoryGap, StoryPart } from '../idea';
import { Rng } from '../rng';
import { NOTE_NAMES } from '../theory';
import { intervalCost } from '../verse/intervals';
import type { Role } from '../recipes/library';
import { type PlacedNote, placeLibLick } from './licks';
import type { Core } from './solocore';
import { GENRE_ORDER, type MoveCtx, envOf, moveWindow, scaleSteps, weightOf } from './solomoves';
import { JOBS, poolFor } from './sololibrary';
import { PHRASE_MIN, RAMP_MIN } from './solostory';

/** A place to lead into: a core, or a note along the way. */
type Pt = { step: number; midi: number };
/** The longest rest the library allows in a solo (16ths): a beat. */
export const BEAT = 4;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const nearest = (list: number[], m: number) => { let b = 0, bd = Infinity; for (let i = 0; i < list.length; i++) { const d = Math.abs(list[i] - m); if (d < bd) { bd = d; b = i; } } return b; };

/** A ramp is at most this long (16ths) when cut from a longer gap, and never more than RAMP_HARD. */
export const RAMP_MAX = 12;
export const RAMP_HARD = 16;
/** A sung phrase with its tag is at most this long (16ths). */
const PHRASE_MAX = 24;

// ---------------------------------------------------------------- the parts

/** A stretch of the story: a gap, or a piece of one. */
export interface Part { into: number; from: number; to: number; role: StoryGap['role']; label: string; repeatOf?: number }

/**
 * The gaps cut into parts. A long gap into the climax holds two: with no statement told yet, the opening phrase (A) and then the ramp;
 * with one, a build and then the ramp. The ramp is RAMP_MAX long at most.
 */
export function storyParts(gaps: StoryGap[]): Part[] {
  const told = gaps.some((g) => g.role === 'statement');
  const out: Part[] = [];
  for (const g of gaps) {
    const len = g.to - g.from, whole: Part = { into: g.into, from: g.from, to: g.to, role: g.role, label: g.label, repeatOf: g.repeatOf };
    if (g.role !== 'ramp') { out.push(whole); continue; }
    if (!told && len >= PHRASE_MIN + RAMP_MIN) {
      const ramp = clamp(len - PHRASE_MIN, RAMP_MIN, RAMP_MAX), cut = g.to - ramp;
      out.push({ ...whole, to: cut, role: 'statement', label: 'A' }, { ...whole, from: cut });
    } else if (told && len > RAMP_MAX + RAMP_MIN) {
      const cut = g.to - RAMP_MAX;
      out.push({ ...whole, to: cut, role: 'build', label: 'build' }, { ...whole, from: cut });
    } else out.push(whole);
  }
  return out;
}

// ---------------------------------------------------------------- the recipes' numbers

type Tag = 'pull-offs' | 'unison' | 'run';
const TAG_WORDS: Record<Tag, string> = { 'pull-offs': 'a bend, let down, pulled off', unison: 'a unison bend, then quick notes', run: 'a held note, then a quick run' };
const TAG_BIT: Record<Tag, string> = { 'pull-offs': 'bend + pull-offs', unison: 'unison bend', run: 'held + quick run' };
/** How much each genre likes each tag (3 leans in, 2 normal, 1 rare): rock, pop, funk, hardrock, metal, grunge, altmetal. Every one is possible in every genre. */
const TAG_LEAN: Record<Tag, number[]> = { 'pull-offs': [3, 1, 1, 3, 3, 2, 2], unison: [2, 1, 1, 2, 1, 3, 2], run: [2, 2, 3, 2, 3, 1, 2] };
const TAGS = Object.keys(TAG_LEAN) as Tag[];

type Rise = 'scale' | 'threes' | 'fours' | 'cascade' | 'twos';
const RISE_WORDS: Record<Rise, string> = {
  scale: 'a plain run up', threes: 'groups of three, each a step higher', fours: 'groups of four, each a step higher',
  cascade: 'three-note pull-off cascades, each a step higher', twos: 'pairs, each a step higher',
};
const RAMP_LEAN: Record<'scale' | 'threes' | 'fours' | 'cascade', number[]> = {
  scale: [2, 2, 2, 2, 2, 2, 2], threes: [2, 1, 1, 3, 3, 1, 3], fours: [1, 1, 1, 2, 3, 1, 2], cascade: [2, 1, 1, 3, 3, 2, 3],
};
const GROUP: Record<Rise, number> = { scale: 1, threes: 3, fours: 4, cascade: 3, twos: 2 };
/** How much each genre hammers and pulls the notes of a run rather than picking each (x 0.25 = the chance). */
const LEGATO_LEAN = [2, 1, 2, 3, 3, 1, 3];

/** The rhythm of a sung lead-in (16ths), by the number of notes, and its shape in scale steps from the held note. */
const CELLS: Record<number, number[][]> = {
  2: [[4, 4], [2, 6], [6, 2], [2, 4]],
  3: [[2, 2, 4], [4, 2, 2], [2, 4, 2], [3, 1, 4], [2, 2, 2]],
  4: [[2, 2, 2, 2], [4, 2, 1, 1], [2, 2, 4, 2], [1, 1, 2, 4]],
};
const SHAPES: Record<number, number[][]> = {
  2: [[-2, -1], [2, 1], [-1, 1], [1, -1], [0, -1], [0, 1]],
  3: [[-1, 0, -1], [1, 0, 1], [-2, -1, 1], [2, 1, -1], [-1, -2, -1], [1, 2, 1], [0, -1, 1]],
  4: [[-2, -1, 0, -1], [2, 1, 0, 1], [-1, 0, 1, 2], [-3, -2, -1, 1], [0, -1, 0, 1], [1, -1, -2, -1], [2, 0, 1, -1]],
};

/** A phrase as it was played, kept so the opening can be played again. */
interface Phrase { cell: number[]; shape: number[]; tag: Tag; H: number; k: number; sgn: 1 | -1; bendAt: number }
interface Cand { notes: PlacedNote[]; recipe: string; bits: StoryPart['bits']; memo?: Phrase; extra?: number }

export interface StoryOut { notes: PlacedNote[]; parts: StoryPart[]; lines: string[] }

// ---------------------------------------------------------------- the writer

/** Writes every part of the story. `prev` for the first part is the note the solo starts around. */
export function writeStory(c: MoveCtx, parts: Part[], cores: Core[], library = false): StoryOut {
  const env = envOf(c), { full } = env;
  const seed = 'recipes-' + c.rng.next();
  const gi = Math.max(0, GENRE_ORDER.indexOf(c.song.partGenres.strum));
  const at = (i: number) => full[clamp(i, 0, full.length - 1)];
  /** The bend into a scale note from the one below it: 1 or 2 semitones. */
  const bendTo = (i: number) => clamp(at(i) - at(i - 1), 1, 2);
  const note = (step: number, len: number, midi: number, o: Partial<PlacedNote> = {}): PlacedNote => ({ step, midi, len, vel: clamp(c.vel(step), 0.3, 1), bend: 0, art: 'pick', ...o });
  const loud = (step: number, d = 0.05) => clamp(c.vel(step) + d, 0.3, 1);

  /** The scale notes a core's lead-in may use (indexes into the key's notes). */
  const rangeIdx = (core: Pt): [number, number] => {
    const [lo, hi] = moveWindow(c, core);
    let h = 0;
    for (let i = full.length - 1; i >= 0; i--) if (full[i] <= hi) { h = i; break; }
    return [Math.max(0, full.findIndex((m) => m >= lo)), h];
  };
  /**
   * Where the tag ends (a scale note within 2 of the core): the first, by the weights, whose held note (starting at `ts`) sits inside the
   * range and does not rub the chord. `T` gives the held note's place for an end note.
   */
  const pickEnd = (rng: Rng, core: Pt, ws: [number, number][], T: (e: number) => number, ts: number, unison = false): number | null => {
    const ci = nearest(full, core.midi), [loI, hiI] = rangeIdx(core), left = ws.slice();
    while (left.length) {
      const q = rng.weighted(left.map(([o, w]) => [o, w] as [number, number]));
      left.splice(left.findIndex(([o]) => o === q), 1);
      const e = ci + q, t = T(e);
      if (e < loI || e > hiI || t < loI || t > hiI) continue;
      if (c.fit.rubs(at(t), ts) || c.fit.clash(at(t), ts)) continue;
      if (unison && bendTo(t) !== 2) continue;
      return e;
    }
    return null;
  };
  /** Whether the notes fit: window, key, no overlap, held notes that do not rub, the last note leading into the core. */
  const fits = (ns: PlacedNote[], p: Part, core: Pt): boolean => {
    const s = ns.slice().sort((a, b) => a.step - b.step);
    if (!s.length) return false;
    const [lo, hi] = moveWindow(c, core);
    let end = p.from;
    for (const n of s) {
      if (n.step < end || n.step + n.len > p.to || n.len < 1) return false;
      end = n.step + n.len;
      for (const m of [n.midi, n.midi - (n.dyad ?? 0)]) if (m < lo || m > hi || !c.fit.inKey(m)) return false;
      if (n.len >= 4 && (c.fit.rubs(n.midi, n.step) || c.fit.clash(n.midi, n.step))) return false;
    }
    const z = s[s.length - 1];
    return scaleSteps(c.song, z.midi, core.midi) <= 2 || z.art === 'slide' || z.bend > 0;
  };
  /** The mood's liking of the way in and the way out, and a chord note on the beats. */
  const costOf = (ns: PlacedNote[], p: Part, core: Pt, prev: number) => {
    const s = ns.slice().sort((a, b) => a.step - b.step), P = c.profile(p.to), z = s[s.length - 1];
    let cost = intervalCost(P, prev, s[0].midi, 0, false) + intervalCost(P, z.midi, core.midi, s.length > 1 ? z.midi - s[s.length - 2].midi : 0, false);
    for (const n of s) if (n.len >= 2 && env.isBeat(n.step) && !c.fit.isTone(n.midi, n.step)) cost += 0.4;
    return cost;
  };

  // ---- a sung phrase: lead-in notes, then the tag
  const sung = (p: Part, core: Pt, rng: Rng, last: Tag | null, memo?: Phrase, again?: 'same' | 'new'): Cand | null => {
    const end = p.to;
    let tag: Tag;
    if (memo) {
      const other = TAGS.filter((t) => t !== memo.tag);
      tag = again === 'new' ? rng.pick(other) : memo.tag;
    } else tag = rng.weighted(TAGS.map((t) => [t, weightOf(TAG_LEAN[t][gi]) * (t === last ? 0.3 : 1)] as [Tag, number]));
    // (the lead-in is the opening's; the tag's own numbers only come back when the tag does)
    const tm = memo && memo.tag === tag ? memo : undefined;
    const EW: [number, number][] = [[-1, 5], [1, 3], [0, 2], [-2, 1], [2, 1]];
    let T = 0, e: number | null, H: number, k: number, sgn: 1 | -1 = 1, len: number, build: (s: number) => PlacedNote[];
    if (tag === 'pull-offs') {
      k = tm?.k ?? rng.pick([2, 2, 3]); H = tm?.H ?? rng.pick([4, 5, 6]); len = H + k;
      e = pickEnd(rng, core, EW, (x) => x + 1 + k, end - len);
      if (e === null) return null;
      T = e + 1 + k;
      const b = bendTo(T);
      build = (s) => [note(s, H, at(T), { bend: b, unbend: b, vel: loud(s) }), ...Array.from({ length: k }, (_, j) => note(s + H + j, 1, at(T - 2 - j), { art: 'legato' }))];
    } else if (tag === 'unison') {
      k = tm?.k ?? rng.pick([1, 2]); H = tm?.H ?? rng.pick([4, 6, 8]); len = H + k;
      e = pickEnd(rng, core, EW, (x) => x + k, end - len, true);
      if (e === null) return null;
      T = e + k;
      build = (s) => [note(s, H, at(T), { bend: 2, dyad: 0, vel: loud(s) }), ...Array.from({ length: k }, (_, j) => note(s + H + j, 1, at(T - 1 - j)))];
    } else {
      k = tm?.k ?? rng.pick([3, 4]); H = tm?.H ?? rng.pick([4, 6, 8]); sgn = tm?.sgn ?? (rng.chance(0.7) ? 1 : -1); len = H + k;
      const sg = sgn;
      e = pickEnd(rng, core, EW, (x) => x + sg * k, end - len);
      if (e === null) return null;
      T = e + sgn * k;
      const hammer = sgn === 1 && rng.chance(0.25 * LEGATO_LEAN[gi]), slight = bendTo(T) === 1, e2 = e;
      build = (s) => [note(s, H, at(T), { vib: 12, vel: loud(s), ...(slight ? { bend: 1 } : {}) }), ...Array.from({ length: k }, (_, j) => note(s + H + j, 1, at(e2 + sg * (k - 1 - j)), hammer ? { art: 'legato' } : {}))];
    }
    const m = memo ? memo.cell.length : rng.weighted([[0, 1], [2, 3], [3, 4], [4, 3]] as [number, number][]);
    const cell = memo?.cell ?? (m ? rng.pick(CELLS[m]) : []);
    const [loI, hiI] = rangeIdx(core), flip = rng.chance(0.5) ? 1 : -1;
    const shapeIn = (sh: number[]) => sh.every((x) => T + x >= loI && T + x <= hiI);
    const base = memo?.shape ?? (m ? rng.pick(SHAPES[m]) : []);
    const shape = memo ? base : [base.map((x) => x * flip), base.map((x) => x * -flip)].find(shapeIn) ?? base;
    const S = cell.reduce((a, b) => a + b, 0), ts = end - len, start0 = ts - S;
    if (start0 < p.from || S + len > Math.min(p.to - p.from, PHRASE_MAX)) return null;
    // (one slight bend on a long lead-in note)
    const longs = cell.map((l, j) => (l >= 4 ? j : -1)).filter((j) => j >= 0);
    const bendAt = memo ? memo.bendAt : longs.length && rng.chance(0.5) ? rng.pick(longs) : -1;
    let s = start0;
    const lead = cell.map((l, j) => { const n = note(s, l, at(T + shape[j]), j === bendAt ? { bend: 1 } : {}); s += l; return n; });
    return {
      notes: [...lead, ...build(ts)],
      recipe: `${m ? `${m} sung notes${bendAt >= 0 ? ' (one bent)' : ''}` : 'no lead-in'}, then ${TAG_WORDS[tag]}`,
      bits: [...(m ? [{ from: start0, to: ts, what: 'sung phrase' }] : []), { from: ts, to: end, what: TAG_BIT[tag] }],
      memo: { cell, shape, tag, H, k, sgn, bendAt },
      extra: m ? 0 : 1,
    };
  };

  // ---- a ramp or a build: fast notes climbing in groups, each a step higher, ending right under the core
  const rising = (p: Part, core: Pt, rng: Rng, ramp: boolean): Cand | null => {
    const end = p.to, room = Math.min(end - p.from, ramp ? RAMP_HARD : 10), ci = nearest(full, core.midi);
    const [lo] = moveWindow(c, core);
    const lowIdx = Math.max(0, full.findIndex((m) => m >= lo));
    const kind: Rise = ramp
      ? rng.weighted((Object.keys(RAMP_LEAN) as (keyof typeof RAMP_LEAN)[]).map((k) => [k, weightOf(RAMP_LEAN[k][gi])] as [Rise, number]))
      : rng.pick(['twos', 'threes'] as Rise[]);
    const u = ramp || c.E((p.from + p.to) / 2) > 0.5 ? 1 : 2, g = GROUP[kind];
    const last = clamp(ci + rng.weighted([[-1, 5], [-2, 2], [0, 2]] as [number, number][]), 0, full.length - 1);
    let n = 0, s = 0;
    if (kind === 'scale') {
      for (let q = Math.min(Math.floor(room / u), ramp ? 14 : 8); q >= (ramp ? RAMP_MIN : 3); q--) { if (last - (q - 1) >= lowIdx) { n = q; s = last - (q - 1); break; } }
    } else {
      for (let G = ramp ? 8 : 3; G >= (kind === 'cascade' ? 3 : 2); G--) {
        const low = kind === 'cascade' ? last - (G - 1) : last - (G - 1) - (g - 1);
        if (G * g * u <= room && low >= lowIdx) { n = G * g; s = low; break; }
      }
      if (ramp && n < 6) n = 0;
    }
    if (!n) return null;
    const start0 = end - n * u, v = c.vel(end);
    const hammer = rng.chance(0.25 * LEGATO_LEAN[gi]);
    const ns: PlacedNote[] = [];
    for (let q = 0; q < n; q++) {
      const j = kind === 'scale' ? q : Math.floor(q / g), m = kind === 'scale' ? q % 3 : q % g;
      const idx = kind === 'scale' ? s + q : kind === 'cascade' ? s + j + (g - 1 - m) : s + j + m;
      const f = n > 1 ? q / (n - 1) : 1;
      ns.push(note(start0 + q * u, u, at(idx), { vel: clamp(ramp ? v - 0.12 + 0.17 * f : v - 0.05 + 0.05 * f, 0.3, 1), ...(hammer && m > 0 ? { art: 'legato' as const } : {}) }));
    }
    return {
      notes: ns,
      recipe: ramp ? `${n} fast notes climbing from the bottom, ${RISE_WORDS[kind]}${hammer ? ', hammered' : ''}` : `rising ${u === 1 ? '16ths' : '8ths'}: ${n} notes, ${RISE_WORDS[kind]}`,
      bits: [{ from: start0, to: end, what: ramp ? 'ramp ↑' : 'build ↑' }],
    };
  };

  // ---- a fall: one long note (bent and let down, or with vibrato), pulled off down into the core
  const fall = (p: Part, core: Pt, rng: Rng): Cand | null => {
    const end = p.to;
    const k = p.label === 'close' ? 1 : p.label === 'fall' ? rng.pick([1, 2]) : rng.pick([2, 3]), H = rng.pick([6, 8]), bent = rng.chance(0.5), ts = end - H - k;
    if (ts < p.from) return null;
    const e = pickEnd(rng, core, [[-1, 4], [0, 3], [1, 2], [-2, 1], [2, 1]], (x) => x + 1 + k, ts);
    if (e === null) return null;
    const T = e + 1 + k, b = bendTo(T);
    const ns = [note(ts, H, at(T), bent ? { bend: b, unbend: b, vel: loud(ts) } : { vib: 14, vel: loud(ts) }), ...Array.from({ length: k }, (_, j) => note(ts + H + j, 1, at(T - (bent ? 2 : 1) - j), { art: 'legato' as const }))];
    return { notes: ns, recipe: `a long note ${bent ? 'bent and let down' : 'with vibrato'}, then ${k} pulled off`, bits: [{ from: ts, to: end, what: 'fall' }] };
  };

  // ---- a named lick from the recipe lab (docs/SOLO-LIBRARY.md), placed to end where the part ends; cut down from its start if it is too long
  const libOf = (p: Part, core: Pt, rng: Rng, jobs: Role[], prevMidi: number): Cand | null => {
    const room = p.to - p.from, pool = poolFor(jobs, GENRE_ORDER[gi], c.mood, room);
    if (!pool.length) return null;
    const l = rng.weighted(pool).lick;
    let from = 0;
    while (from < l.notes.length - 2 && l.span - l.notes[from].pos > room) from++;
    if (l.span - l.notes[from].pos > room) return null;
    const [lo, hi] = moveWindow(c, core);
    const ns = placeLibLick(rng, c.fit, c.song.key, l, p.to, lo, hi, prevMidi, 'any', l.who[0], clamp(c.vel(p.to), 0.3, 1), from);
    if (!ns) return null;
    return { notes: ns, recipe: `the lick "${l.name}"${from ? ' (cut down)' : ''}`, bits: [{ from: ns[0].step, to: p.to, what: `lick: ${l.name}` }] };
  };

  // ---- a short walk through the key, in 8ths (some 16ths and dotted 8ths), ending right by the core: the piece that always fits
  const walk = (p: Part, core: Pt, rng: Rng, prevMidi: number): Cand | null => {
    const durs: number[] = [];
    for (let rem = p.to - p.from; rem > 0;) { const d = Math.min(rem, rng.weighted([[1, 3], [2, 6], [3, 1]] as [number, number][])); durs.push(d); rem -= d; }
    const [loI, hiI] = rangeIdx(core), n = durs.length, ci = nearest(full, core.midi);
    const a = clamp(nearest(full, prevMidi), loI, hiI), e = clamp(ci + rng.pick([-1, -1, 0, 1]), loI, hiI);
    let idx = a, s = p.from;
    const ns = durs.map((d, q) => {
      let t = q === n - 1 ? e : clamp(Math.round(a + ((e - a) * (q + 1)) / n) + rng.pick([-1, 0, 0, 1]), loI, hiI);
      if (q < n - 1 && t === idx) t = clamp(t + (t < hiI ? 1 : -1), loI, hiI);
      idx = t;
      const x = note(s, d, at(t), q > 0 && d === 1 && rng.chance(0.25 * LEGATO_LEAN[gi]) ? { art: 'legato' } : {});
      s += d;
      return x;
    });
    return { notes: ns, recipe: `a short walk, ${n} notes`, bits: [{ from: p.from, to: p.to, what: 'walk' }], extra: 1 };
  };

  /** The best of a few tries at a recipe (by the mood's liking of the way in and out): the same dice for the same key. */
  const choose = (key: string, p: Part, core: Pt, prevMidi: number, make: (rng: Rng) => Cand | null, tries = 12, ok: (x: Cand) => boolean = () => true): Cand | null => {
    const cands: { x: Cand; cost: number }[] = [];
    for (let a = 0; a < tries; a++) {
      const x = make(new Rng(`${seed}:${key}:${a}`));
      if (!x || !fits(x.notes, p, core) || !ok(x)) continue;
      cands.push({ x, cost: costOf(x.notes, p, core, prevMidi) + (x.extra ?? 0) });
    }
    if (!cands.length) return null;
    const lo = Math.min(...cands.map((q) => q.cost));
    return new Rng(`${seed}:${key}:pick`).weighted(cands.map((q) => [q.x, Math.exp(-(q.cost - lo) / 1.5)] as [Cand, number]));
  };

  // ---- the parts, in order
  const memos = new Map<number, Phrase>();
  const outParts: StoryPart[] = [], notes: PlacedNote[] = [], lines: string[] = [];
  let prev = env.start, last: Tag | null = null;
  const barOf = (g: number) => { for (let i = c.song.bars.length - 1; i >= 0; i--) if (g >= c.song.bars[i].start) return i; return 0; };
  const where = (from: number, to: number) => { const a = barOf(from) + 1, b = barOf(Math.max(from, to - 1)) + 1; return a === b ? 'bar ' + a : `bars ${a}-${b}`; };
  parts.forEach((p, i) => {
    const core = cores[p.into], room = p.to - p.from;
    if (i === 0 || parts[i - 1].into !== p.into) prev = p.into > 0 ? cores[p.into - 1].midi : env.start;
    const attempt = (make: (rng: Rng) => Cand | null, tries = 12): Cand | null => choose(String(i), p, core, prev, make, tries);
    /** With the library on, some of the tries are a named lick that does the part's job. */
    const mixed = (q: Part, jobs: Role[], make: (rng: Rng) => Cand | null) => (r: Rng) => (library && r.chance(0.4) ? libOf(q, core, r, jobs, prev) : make(r));
    let cand: Cand | null = null, again = '';
    if (p.role === 'link' || room < 3) cand = null;
    else if (p.role === 'ramp') cand = attempt(mixed(p, JOBS.ramp, (r) => rising(p, core, r, true)));
    else if (p.role === 'build' && p.repeatOf === undefined) {
      // (a build climbs; where the core sits too low to climb to, and there is room, a short sung phrase instead)
      cand = room >= 4 ? attempt(mixed(p, JOBS.build, (r) => rising(p, core, r, false))) : null;
      if (!cand && room >= PHRASE_MIN) cand = attempt(mixed(p, JOBS.build, (r) => sung(p, core, r, last)));
    }
    else if (p.role === 'release') {
      // (a long release: first a note falling straight from the core before, then the fall into the next; the first only with the second)
      let q = p, early: PlacedNote[] = [];
      if (room >= 20) {
        const from0 = cores[p.into - 1]?.midi ?? prev, ix = nearest(full, from0) - new Rng(`${seed}:${i}:early`).pick([1, 2]);
        const one = [note(p.from + 2, 8, at(ix), { vib: 14, vel: loud(p.from + 2, 0.02) })];
        if (fits(one, { ...p, to: p.from + 12 }, cores[Math.max(0, p.into - 1)])) { early = one; q = { ...p, from: p.from + 12 }; }
      }
      cand = attempt(mixed(q, JOBS.release, (r) => fall(q, core, r)));
      if (cand && early.length) cand = { ...cand, notes: [...early, ...cand.notes], bits: [{ from: early[0].step, to: early[0].step + 8, what: 'fall' }, ...cand.bits], recipe: 'a long note falling from the core, then ' + cand.recipe };
    } else if (p.role === 'answer' || p.role === 'statement' || p.role === 'return' || p.role === 'build') {
      const memo = p.repeatOf !== undefined ? memos.get(p.repeatOf) : undefined;
      if (memo) {
        const way = p.role === 'return' ? 'same' : 'new';
        cand = attempt((r) => sung(p, core, r, last, memo, way));
        if (cand) again = way === 'same' ? ' (the opening phrase again)' : ' (the opening phrase again, tag changed)';
      }
      if (!cand && p.role !== 'build') cand = attempt(mixed(p, JOBS[p.role], (r) => sung(p, core, r, last)));
      if (!cand && p.role === 'build') cand = room >= 4 ? attempt((r) => rising(p, core, r, false)) : null;
    }
    if (cand) {
      notes.push(...cand.notes);
      const sorted = cand.notes.slice().sort((a, b) => a.step - b.step);
      prev = sorted[sorted.length - 1].midi;
      if (cand.memo) { last = cand.memo.tag; if (p.role === 'statement') memos.set(p.into, cand.memo); }
      outParts.push({ into: p.into, from: p.from, to: p.to, role: p.role, label: p.label, recipe: cand.recipe + again, bits: cand.bits, notes: cand.notes.length });
      lines.push(`${where(p.from, p.to)}: ${p.label !== p.role ? p.label + ' = ' : ''}${p.role}: ${cand.recipe}${again} (${cand.notes.length} notes), into ${NOTE_NAMES[((core.midi % 12) + 12) % 12]}`);
    } else if (p.role !== 'link') {
      outParts.push({ into: p.into, from: p.from, to: p.to, role: p.role, label: p.label, recipe: 'space', bits: [], notes: 0 });
    }
  });

  // ---- the library: no rest longer than a beat. Where one is left, recipes are strung end to end across it
  if (library && cores.length) {
    interface Ev { s: number; e: number; midi: number }
    const restsOf = () => {
      const evs: Ev[] = [...cores.map((k) => ({ s: k.step, e: k.step + k.len, midi: k.midi })), ...notes.map((n) => ({ s: n.step, e: n.step + n.len, midi: n.midi }))].sort((a, b) => a.s - b.s);
      const out: { from: number; to: number; prev: Ev; next: Ev }[] = [];
      let cover = Math.min(parts.length ? parts[0].from : Infinity, evs[0].s), before: Ev = { s: cover, e: cover, midi: env.start };
      for (const ev of evs) {
        if (ev.s > cores[cores.length - 1].step) break;
        if (ev.s - cover > BEAT) out.push({ from: cover, to: ev.s, prev: before, next: ev });
        if (ev.e > cover) { cover = ev.e; before = ev; }
      }
      return out;
    };
    /** Strings pieces across one rest: a sung phrase, a climb, a named lick or a walk, each leading on from the one before and the last into what follows. */
    const stringRest = (gap: ReturnType<typeof restsOf>[number], n: number, walkOnly: boolean) => {
      const core = cores.find((k) => k.step >= gap.to) ?? cores[cores.length - 1], into = cores.indexOf(core);
      const rng = new Rng(`${seed}:rest${n}${walkOnly ? 'w' : ''}`);
      const a0 = nearest(full, gap.prev.midi), t0 = nearest(full, gap.next.midi);
      let cur = gap.from + Math.min(rng.pick([0, 0, 1, 2]), gap.to - gap.from - 1), from = gap.prev.midi, k = 0;
      const out: PlacedNote[] = [], bits: StoryPart['bits'] = [], names: string[] = [];
      while (cur < gap.to) {
        const R = gap.to - cur, opts = [8, 10, 12].filter((x) => R - x >= 4), L = R > 14 && opts.length ? rng.pick(opts) : R, end = cur + L, lastPiece = end >= gap.to;
        // (on the way, a waypoint between where the rest begins and where it leads)
        const way = lastPiece ? gap.next.midi : at(clamp(Math.round(a0 + ((t0 - a0) * (end - gap.from)) / (gap.to - gap.from)) + rng.pick([-1, 0, 0, 1]), 0, full.length - 1));
        const pc: Pt = { step: end, midi: way }, pp: Part = { into, from: cur, to: end, role: 'link', label: 'strung' };
        const tight = (x: Cand) => x.notes.reduce((m, q) => Math.min(m, q.step), Infinity) - cur <= 2;
        const all: [string, number][] = [['sung', L >= PHRASE_MIN ? 3 : 0], ['rise', L >= 4 ? 2 : 0], ['lick', 4], ['walk', 2]];
        const kinds = walkOnly ? ([['walk', 1]] as [string, number][]) : all.filter(([, w]) => w > 0);
        let cand = choose(`rest${n}.${k}${walkOnly ? 'w' : ''}`, pp, pc, from, (r) => {
          const kind = r.weighted(kinds);
          return kind === 'sung' ? sung(pp, pc, r, last) : kind === 'rise' ? rising(pp, pc, r, false) : kind === 'lick' ? libOf(pp, pc, r, JOBS.fill, from) : walk(pp, pc, r, from);
        }, 12, tight);
        cand ??= choose(`rest${n}.${k}.walk`, pp, pc, from, (r) => walk(pp, pc, r, from), 12, tight);
        if (!cand) break;
        out.push(...cand.notes);
        names.push(cand.recipe);
        bits.push(...cand.bits);
        from = cand.notes.slice().sort((x, y) => x.step - y.step)[cand.notes.length - 1].midi;
        cur = end; k++;
      }
      if (!out.length) return;
      notes.push(...out);
      const whole = outParts.find((q) => q.recipe === 'space' && q.from <= gap.from && gap.to <= q.to);
      const recipe = 'strung: ' + names.join(' + ');
      if (whole) Object.assign(whole, { recipe, bits, notes: out.length });
      else outParts.push({ into, from: gap.from, to: gap.to, role: 'link', label: 'strung', recipe, bits, notes: out.length });
      lines.push(`${where(gap.from, gap.to)}: ${gap.to - gap.from} 16ths left open, ${recipe} (${out.length} notes)`);
    };
    restsOf().forEach((g, n) => stringRest(g, n, false));
    // (whatever is still open, a walk across it)
    for (let pass = 1; pass <= 3; pass++) restsOf().forEach((g, n) => stringRest(g, 100 * pass + n, true));
  }
  notes.sort((a, b) => a.step - b.step);
  return { notes, parts: outParts, lines };
}
