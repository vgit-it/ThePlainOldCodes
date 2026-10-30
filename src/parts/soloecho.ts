// Solo echo (docs/SOLO-ECHO.md): the expression played as a motif, not as a scatter. Only plans; src/parts/soloexpress.ts plays them.
//  - An answer plays its call's figure again: counted back from the goal note, its windows take the call's cuts and kinds of part,
//    the same speed and shape and the same seed, laid on the answer's own time and notes (so the figure comes back at the answer's
//    pitches, usually another way up or down), now and then with one window of its own ("changed"). The goal note takes the same kind
//    of dress (a bend into it, a late bend, a let-down, or just vibrato).
//  - One signature figure per solo: a run from the first half that comes back at the end of the climax phrase and of the last phrase.
// A window only takes another's parts; the tune's notes and the windows stay where they are.
import type { Rng } from '../rng';
import type { BaseNote } from './soloevents';
import type { Win } from './soloexpress';

/** The notes that end a phrase of the tune. */
const GOAL_ROLES = ['call', 'answer', 'climax', 'end'];

export interface Phrase { a: number; b: number; role: string }
/** One window that plays another window's figure. */
export interface EchoCopy {
  /** The window it plays again (index in the windows). */
  from: number;
  /** The copy: the source's cuts and kinds, laid on this window's time. */
  win: Win;
  /** True: this window plays the figure with a seed of its own (changed); false: the source's seed (the same figure). */
  own: boolean;
  via: 'answer' | 'signature';
}
export interface EchoPlan {
  /** By window index (the window that gets the copy). */
  copies: Map<number, EchoCopy>;
  /** The window the signature figure comes from, or -1. */
  signature: number;
}

/** The phrases of the tune: the notes up to and including each goal note (indexes into `notes`). */
export function phrasesOf(notes: BaseNote[]): Phrase[] {
  const out: Phrase[] = [];
  let a = 0;
  notes.forEach((n, k) => {
    if (!GOAL_ROLES.includes(n.role)) return;
    out.push({ a, b: k, role: n.role });
    a = k + 1;
  });
  return out;
}

/** The windows that lie inside notes a..b, in time order. */
const winsIn = (wins: Win[], a: number, b: number): number[] => wins.flatMap((w, q) => (w.i >= a && w.j <= b ? [q] : [])).sort((x, y) => wins[x].t0 - wins[y].t0);

/**
 * The source's parts laid on another window's time: each part keeps its kind, its speed and its shape, and its length goes with the
 * window (a run stays on its grid, a held part stays two steps or more). Null when that cannot be done.
 */
export function transplant(src: Win, to: Win): Win | null {
  const W = to.t1 - to.t0, Ws = src.t1 - src.t0;
  if (!src.parts.length || W < 2 || Ws <= 0) return null;
  const k = W / Ws;
  // (a run's length is a whole number of its steps; with a speed-up, of two of them)
  const unit = (p: Win['parts'][number]) => (p.mid !== undefined ? 2 * p.sub! : p.kind === 'run' ? p.sub! : 1);
  const lens = src.parts.map((p) => {
    const u = unit(p);
    const want = (p.b - p.a) * k;
    return p.kind === 'run' ? Math.max(2 * (p.sub ?? 1), Math.round(want / u) * u) : Math.max(2, Math.round(want));
  });
  // (a run keeps to its note count: never more than the source had, and 14 at most)
  src.parts.forEach((p, z) => { if (p.kind === 'run') { const cap = Math.min(14, Math.max(4, Math.round((p.b - p.a) / p.sub!))) * p.sub!; if (lens[z] > cap) lens[z] = Math.floor(cap / unit(p)) * unit(p); } });
  // the remainder goes to a held part, or a run takes it a step at a time
  let rest = W - lens.reduce((a, b) => a + b, 0);
  const holds = src.parts.map((p, z) => (p.kind === 'hold' ? z : -1)).filter((z) => z >= 0);
  if (rest !== 0 && holds.length) {
    const z = holds[holds.length - 1];
    if (lens[z] + rest >= 2) { lens[z] += rest; rest = 0; }
  }
  for (let guard = 0; rest !== 0 && guard < 40; guard++) {
    const runs = src.parts.map((p, z) => (p.kind === 'run' ? z : -1)).filter((z) => z >= 0);
    const z = runs.find((x) => (rest > 0 ? lens[x] + unit(src.parts[x]) <= 14 * src.parts[x].sub! : lens[x] - unit(src.parts[x]) >= 2 * src.parts[x].sub!) && Math.abs(rest) >= unit(src.parts[x]));
    if (z === undefined) break;
    const u = unit(src.parts[z]);
    lens[z] += rest > 0 ? u : -u;
    rest += rest > 0 ? -u : u;
  }
  if (rest !== 0 || lens.some((l) => l < 2)) return null;
  let at = to.t0;
  const parts = src.parts.map((p, z) => {
    const a = at, b = at + lens[z];
    at = b;
    const out = { ...p, a, b };
    if (p.kind === 'run' && p.mid !== undefined) out.mid = a + lens[z] / 2;
    return out;
  });
  return { i: to.i, j: to.j, t0: to.t0, t1: to.t1, pattern: src.pattern, heat: src.heat, parts };
}

/** A run of 4+ notes with a character of its own (a shape other than a stair, or hammered and pulled): the stuff a signature is made of. */
const figureWeight = (w: Win): number => {
  let best = 0;
  for (const p of w.parts) {
    if (p.kind !== 'run') continue;
    const L = p.b - p.a;
    // (a figure is a handful of notes: two quick notes are not one)
    if (L < 4 || L / p.sub! < 4) continue;
    best = Math.max(best, (L >= 6 ? 1.3 : 1) * (p.shape === 'seq' || p.shape === 'pedal' ? 1.6 : p.shape === 'arch' ? 1.2 : 0.6) * (p.legato ? 1.25 : 1));
  }
  return best;
};

/**
 * Who plays whose figure. `strength` (per solo, drawn from the seed): how likely a call/answer pair is to echo; `vary`: how likely
 * a copied window takes a seed of its own. Answers first; the signature only goes where an answer has not.
 */
export function echoPlan(notes: BaseNote[], wins: Win[], r: Rng, o: { strength?: number; vary?: number; light?: boolean } = {}): EchoPlan {
  const strength = o.strength ?? 0.55 + 0.45 * r.next();
  const vary = o.vary ?? 0.3;
  const copies = new Map<number, EchoCopy>();
  const phrases = phrasesOf(notes);
  const goalOf = (n: BaseNote) => n.anchor === 'all' || n.frozen || GOAL_ROLES.includes(n.role);
  /** A phrase's windows, nearest the goal first: the goal note's window, then the others. */
  const fromGoal = (ph: Phrase) => winsIn(wins, ph.a, ph.b).reverse();

  // ---- calls and answers: a call (or the climax) and the answer right after it, counted back from the goal note
  phrases.forEach((ph, s) => {
    const nx = phrases[s + 1];
    if (!nx || nx.role !== 'answer' || (ph.role !== 'call' && ph.role !== 'climax')) return;
    if (!r.chance(strength)) return;
    const cs = fromGoal(ph), as = fromGoal(nx);
    for (let k = 0; k < Math.min(cs.length, as.length, 4); k++) {
      const qc = cs[k], qa = as[k];
      const wc = wins[qc], wa = wins[qa];
      if (wc.pattern === 'plain' || wc.pattern === 'burst' || wa.pattern === 'burst') continue;
      const own = r.chance(vary);
      if (k === 0) {
        // the goal note: the same kind of dress, if it is a held note that can take it
        if (wc.pattern === 'decor' && wc.dress && wc.dress !== 'none' && wa.t1 - wa.t0 >= 3 && wa.i === wa.j) {
          copies.set(qa, { from: qc, win: { ...wa, pattern: 'decor', parts: [], dress: wc.dress }, own, via: 'answer' });
        }
        continue;
      }
      if (goalOf(notes[wa.i])) continue;
      const win = transplant(wc, wa);
      if (win) copies.set(qa, { from: qc, win, own, via: 'answer' });
    }
  });

  // ---- the signature: a figure from the first half, played again at the end of the climax phrase and of the last phrase
  const end = notes.length ? notes[notes.length - 1].t + notes[notes.length - 1].len : 0;
  const cand: [number, number][] = [];
  wins.forEach((w, q) => {
    if (w.pattern === 'plain' || w.pattern === 'decor' || w.pattern === 'burst' || goalOf(notes[w.i]) || w.t0 >= end * 0.5) return;
    const f = figureWeight(w);
    if (f > 0) cand.push([q, f]);
  });
  if (!cand.length) return { copies, signature: -1 };
  const sig = r.weighted(cand);
  let got = 0;
  for (const ph of phrases.filter((x) => x.role === 'climax' || x.role === 'end')) {
    // (the window nearest the goal note that is not a goal itself, and has room for the figure)
    const q = fromGoal(ph).find((x) => !goalOf(notes[wins[x].i]));
    if (q === undefined || q === sig || copies.has(q) || wins[q].t0 < wins[sig].t0) continue;
    // (Light expression: the signature only goes where the window was already played another way, never over a plain one)
    if (wins[q].pattern === 'burst' || (o.light && wins[q].pattern === 'plain')) continue;
    const win = transplant(wins[sig], wins[q]);
    if (!win) continue;
    copies.set(q, { from: sig, win, own: false, via: 'signature' });
    got++;
  }
  return { copies, signature: got ? sig : -1 };
}
