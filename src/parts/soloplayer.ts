// The solo player (docs/SOLO-PLAYER.md): the melody (with its gaps and joins) handed to a guitarist. The director: reads the melody into
// spans, lets every rule that fits offer a way to play each one, picks by chance, and keeps a pick only if the checker passes it (and the
// hands can finger it). A pick that fails goes to the next, and in the end to the note as it is, so a performance is never worse than the
// melody it was given. Step 1: the frame and the plain rule; the rules that change anything come next.

import type { ChordPart, DrumPart, Feel, SectionKind, Song, SoloMove } from '../idea';
import type { Hands } from '../players/hands';
import type { LeadPlayer } from '../players/lead';
import { Rng } from '../rng';
import type { Mood } from '../tension';
import type { Guitar2Part } from './guitar2';
import { type PEvent, eventsToHits, readBase } from './soloevents';
import { readSolo } from './soloread';
import { type Rule, type Span, covers, fitOf } from './solorules';
import { type Intent, composeFigures } from './solofigure';
import { intentWeights } from './solointent';
import { profileFor } from '../verse/intervals';
import { LIVE_RULES } from './solorules-live';
import { personOf, signaturesOf } from './soloperson';
import { type VCtx, type Violation, unplayable, verify } from './soloverify';

/** Everything the player knows about the song around the solo. */
export interface PlayerCtx {
  /** The track's seed: the same seed gives the same performance. */
  seed: string;
  /** The band's seed: the same player is the same person in every solo of the track (the solo's seed when missing). */
  band?: string;
  song: Song;
  chords?: ChordPart;
  lead: LeadPlayer;
  hands: Hands;
  mood: Mood;
  tension: number[];
  drums?: DrumPart;
  /** The section's energy level and kind. */
  energy: number;
  kind: SectionKind;
}

export interface PlayerOpts {
  /** For checks: always try this rule first where it applies. */
  force?: string;
}

const violationKey = (v: Violation) => `${v.code}@${v.at.toFixed(2)}`;

export function performSolo(base: Guitar2Part, c: PlayerCtx, rules: Rule[] = LIVE_RULES, o: PlayerOpts = {}): Guitar2Part {
  const { events: ev0, notes } = readBase(base.hits, base.curve);
  const plainOf = (i: number): PEvent[] => [ev0[notes[i].ev]];
  const vctx: VCtx = { song: c.song, chords: c.chords, gaps: base.curve?.gaps ?? [], hands: c.hands, energy: c.energy, kind: c.kind, curve: base.curve };

  // the melody read: the situation of every note, joint, cell and phrase
  const read = readSolo(notes, { song: c.song, chords: c.chords, drums: c.drums, mood: c.mood, tension: c.tension, curve: base.curve });

  // the pieces: each melody note as the events that play it now; the muted scratches and other hits that are no note of the melody stay
  const groups: PEvent[][] = notes.map((_, i) => plainOf(i));
  const noteEvents = new Set(notes.map((n) => n.ev));
  const others = ev0.filter((_, k) => !noteEvents.has(k));
  const assemble = () => [...others, ...groups.flat()];

  // what the melody itself already breaks (it should be nothing) is not held against a rewrite
  const baseline = new Set(verify(assemble(), notes, vctx).map(violationKey));
  const fresh = () => verify(assemble(), notes, vctx).filter((v) => !baseline.has(violationKey(v)));

  const moves: SoloMove[] = notes.map((n) => ({ step: Math.floor(n.t), midi: n.midi, rule: 'plain', options: ['plain'] }));
  const person = personOf(c.band ?? c.seed, c.lead);
  const signatures = new Set(signaturesOf(person, c.seed));
  const phraseOf = (i: number) => read.phrases.find((p) => i >= p.from && i <= p.to);
  const barOf = (t: number) => Math.max(0, c.song.bars.findIndex((b) => t >= b.start && t < b.start + b.len));
  const used = new Map<string, number>();
  interface Choice { intent: Intent | 'plain'; name: string; contour?: string; cell?: string }
  const chosen: Choice[] = notes.map(() => ({ intent: 'plain', name: 'plain' }));
  const recent: string[] = [];
  let lastRule = { i: -9, name: '' };
  // the notes the hands cannot finger as they are (a rewrite is only held against what it breaks itself)
  const baseBad = new Set(unplayable(ev0, vctx).map((e) => e.base));
  const handsOk = () => !unplayable(assemble(), vctx).some((e) => e.base !== undefined && !baseBad.has(e.base));

  notes.forEach((note, i) => {
    const nr = read.notes[i];
    const span: Span = {
      note, event: ev0[note.ev], read: nr, prev: notes[i - 1] ?? null, next: notes[i + 1] ?? null,
      before: i ? Math.max(0, note.t - (notes[i - 1].t + notes[i - 1].len)) : note.t,
      after: notes[i + 1] ? Math.max(0, notes[i + 1].t - (note.t + note.len)) : 0,
      ctx: c,
    };
    const tagw = (id: string) => nr.tags.find((t) => t.id === id)?.w ?? 0;
    const e01 = (Number(nr.facts.energy ?? 0) + 1) / 2;
    // what the moment wants, with the player's own lean
    const want = {} as Feel;
    for (const k of Object.keys(nr.feel) as (keyof Feel)[]) want[k] = Math.max(-1, Math.min(1, nr.feel[k] + person.lean[k]));
    const rng = new Rng(`${c.seed}-player-${note.t}-${note.midi}`);
    if (note.frozen) { moves[i].note = 'the last note is carried into the next section'; return; }

    // the rules that play the note itself (held with expression, or struck again and again), scored: fit x taste x a pet move x not the same again
    const scored = rules
      .filter((r) => r.name !== 'plain' && covers(r, note))
      .map((r) => {
        const fit = fitOf(r, span, want);
        const novelty = (i - lastRule.i <= 3 && lastRule.name === r.name ? 0.4 : 1) / (1 + 0.25 * (used.get(r.name) ?? 0));
        return { r, fit, w: fit * (o.force === r.name ? 1 : person.taste[r.name] ?? 1) * (signatures.has(r.name) ? 2.5 : 1) * novelty };
      })
      .filter((x) => x.fit > 0 && x.w > 0)
      .sort((a, b) => b.w - a.w);
    moves[i].options = scored.map((x) => x.r.name);
    moves[i].scores = scored.slice(0, 5).map((x) => [x.r.name, Math.round(x.w * 100) / 100]);

    /** Puts events in the note's place; they stay only if the checker (and, for a figure, the hands) find nothing new. */
    const attempt = (evs: PEvent[] | null, hands: boolean): boolean => {
      if (!evs) return false;
      groups[i] = evs.map((e) => ({ ...e, base: note.i }));
      if (!fresh().length && (!hands || handsOk())) return true;
      groups[i] = plainOf(i);
      return false;
    };
    const drawn = <T,>(items: { v: T; w: number }[]): T[] => {
      const rest = [...items], out: T[] = [];
      while (rest.length) { const pick = rng.weighted(rest.map((x) => [x, x.w] as [typeof x, number])); out.push(pick.v); rest.splice(rest.indexOf(pick), 1); }
      return out;
    };
    const done = (choice: Choice, intent: string, fig?: string) => {
      moves[i].rule = choice.name; moves[i].intent = intent; if (fig) moves[i].fig = fig;
      chosen[i] = choice;
      if (choice.intent !== 'plain') { used.set(choice.name, (used.get(choice.name) ?? 0) + 1); lastRule = { i, name: choice.name }; }
    };
    const byGroup = (g: 'stay' | 'flurry') => scored.filter((x) => x.r.profile?.group === g);

    // a note too short for a figure: held, now and then with expression
    if (note.len < 4) {
      const stay = byGroup('stay');
      if (!stay.length || !rng.chance(0.5 * person.density)) { moves[i].note = 'short: left plain'; return; }
      for (const r of drawn(stay.map((x) => ({ v: x.r, w: x.w })))) {
        if (attempt(r.realise(span, new Rng(`${c.seed}-rule-${r.name}-${note.t}-${note.midi}`)), false)) { done({ intent: 'stay', name: r.name }, 'stay'); return; }
      }
      return;
    }

    // what the note is for
    const flurry = byGroup('flurry');
    const figuresOn = rules.some((r) => r.name === 'figures');
    const canBridge = figuresOn && note.anchor !== 'all' && !!span.next && span.after <= 2;
    const weights = intentWeights({ mood: c.mood, e01, tag: tagw, person, canBridge, flurryFit: flurry.length ? flurry[0].w : 0 });
    if (!figuresOn) weights.return = 0;
    if (i >= 1 && chosen[i - 1].intent === 'flurry') weights.flurry = 0;
    if (i >= 2 && chosen[i - 2].intent === 'flurry') weights.flurry *= 0.5;
    if (o.force) {
      // (for the checks: the named rule, or every figure of a named intention)
      if (rules.some((r) => r.name === o.force)) { for (const k of Object.keys(weights) as Intent[]) weights[k] = 0; weights[rules.find((r) => r.name === o.force)!.profile?.group ?? 'stay'] = 1; }
      else if (o.force === 'return' || o.force === 'bridge') { for (const k of Object.keys(weights) as Intent[]) weights[k] = 0; weights[o.force] = 1; }
    }
    if (weights.stay + weights.return + weights.bridge + weights.flurry <= 0) { moves[i].note = 'no rule to play it with'; return; }
    const order: Intent[] = drawn((Object.keys(weights) as Intent[]).filter((k) => weights[k] > 0).map((k) => ({ v: k, w: weights[k] })));
    // the same move as the phrase this one repeats (mostly)
    const ph = phraseOf(i);
    const src = ph?.copyOf !== undefined ? read.phrases[ph.copyOf] : undefined;
    const srcI = src && ph ? src.from + (i - ph.from) : -1;
    const copy: Choice | null = src && srcI <= src.to && rng.chance(0.85) && !o.force ? chosen[srcI] : null;
    if (copy && copy.intent !== 'plain') { const k = order.indexOf(copy.intent); if (k > 0) { order.splice(k, 1); order.unshift(copy.intent); } }
    else if (copy && !o.force) { moves[i].note = 'as the phrase it repeats'; moves[i].intent = 'stay'; return; }

    const tension = c.tension[barOf(note.t)];
    const failed: string[] = [];
    for (const intent of order) {
      if (intent === 'stay' || intent === 'flurry') {
        const pool = byGroup(intent).map((x) => ({ v: x.r, w: x.w * (copy?.name === x.r.name ? 6 : 1) }));
        // (a held note is only sometimes plain: the weight of the plain hold is the weight of an average way to decorate it)
        if (intent === 'stay' && !o.force) {
          if (rng.chance(0.3) || !pool.length) { done({ intent: 'stay', name: 'plain' }, 'stay'); if (failed.length) moves[i].note = `held: no ${failed.join(' or ')} fit`; return; }
        }
        for (const r of drawn(pool)) {
          if (attempt(r.realise(span, new Rng(`${c.seed}-rule-${r.name}-${note.t}-${note.midi}`)), false)) { done({ intent, name: r.name }, intent); if (failed.length) moves[i].note = `no ${failed.join(' or ')} fit`; return; }
        }
        failed.push(intent);
        continue;
      }
      const figs = composeFigures(span, {
        intent, person, want, profile: profileFor(c.mood, 'solo', tension), avoid: recent.slice(-3),
        prefer: copy && copy.intent === intent ? { contour: copy.contour, cell: copy.cell } : undefined,
      }, new Rng(`${c.seed}-fig-${intent}-${note.t}-${note.midi}`));
      if (!figs.length) { failed.push(intent); continue; }
      moves[i].scores = [...figs].sort((a, b) => b.w - a.w).slice(0, 5).map((f) => [`${f.contour} ${f.cell}`, Math.round(f.w * 100) / 100]);
      const list = drawn(figs.map((f) => ({ v: f, w: f.w })));
      for (const f of list.slice(0, 10)) {
        if (attempt(f.events, true)) {
          recent.push(f.contour);
          done({ intent, name: `${intent}·${f.contour}`, contour: f.contour, cell: f.cell }, intent, f.label);
          return;
        }
      }
      failed.push(intent);
    }
    moves[i].note = 'every try failed the check';
  });

  // the hands have the last word: a note with no place on the neck goes back to being played as it was
  for (let guard = 0; guard < notes.length; guard++) {
    const bad = unplayable(assemble(), vctx).filter((e) => e.base !== undefined && !baseBad.has(e.base));
    if (!bad.length) break;
    for (const e of bad) { groups[e.base!] = plainOf(e.base!); moves[e.base!].rule = 'plain'; moves[e.base!].note = 'no place on the neck'; }
  }

  const events = assemble();
  const hits = eventsToHits(events);
  const changed = moves.filter((m) => m.rule !== 'plain');
  const fine = hits.some((h) => h.shift || h.exact);
  const tally = new Map<string, number>();
  for (const m of changed) tally.set(m.intent ?? m.rule, (tally.get(m.intent ?? m.rule) ?? 0) + 1);
  return {
    hits,
    notes: [...base.notes, changed.length
      ? `Solo player: ${changed.length} of ${notes.length} notes played another way (${[...tally].map(([k, n]) => `${k} ${n}`).join(', ')})`
      : `Solo player: all ${notes.length} notes played as written${rules.length > 1 ? ' (nothing was worth playing another way)' : ''}`],
    curve: base.curve ? { ...base.curve, moves, read, ...(fine ? { fine: true } : {}) } : undefined,
  };
}
