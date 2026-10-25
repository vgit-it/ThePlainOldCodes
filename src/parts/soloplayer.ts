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
import { type PEvent, TOL, endOf, eventsToHits, readBase, snap } from './soloevents';
import { readSolo } from './soloread';
import { type Rule, type Span, covers, fitOf } from './solorules';
import { type Intent, composeFigures, composeTrill } from './solofigure';
import { intentWeights } from './solointent';
import { SHORT_KINDS, composeShort } from './soloshort';
import { JOINT_KINDS, composeJoint } from './solojoint';
import { REST_KINDS, composeRest } from './solorest';

/** Every way of dressing a short note, for a check to force: a touch, a joint into the next note, or a run (a cell of short notes all leaning in). */
export const DRESS_KINDS: string[] = [...SHORT_KINDS, ...JOINT_KINDS, 'run'];
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
  /** Breath switch (docs/SOLO-MELODY.md, step 0f): after a busy stretch of quick notes, the next note (and the rest before it) is left as written. */
  breath?: boolean;
}

/** Breath switch: this many quick events (under a beat) in a row count as a busy stretch. */
const BREATH_AFTER = 6;

export interface PlayerOpts {
  /** For checks: always try this rule first where it applies. */
  force?: string;
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
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
  /** What is added in the rests, by the note that follows the rest (section 18, step 4c). */
  const extras = new Map<number, PEvent[]>();
  const assemble = () => [...others, ...groups.flat(), ...[...extras.values()].flat()];

  // what the melody itself already breaks (it should be nothing) is not held against a rewrite
  const baseline = new Set(verify(assemble(), notes, vctx).map(violationKey));
  const fresh = () => verify(assemble(), notes, vctx).filter((v) => !baseline.has(violationKey(v)));

  const moves: SoloMove[] = notes.map((n) => ({ step: Math.floor(n.t), midi: n.midi, rule: 'plain', options: ['plain'] }));
  const person = personOf(c.band ?? c.seed, c.lead);
  const signatures = new Set(signaturesOf(person, c.seed));
  const phraseOf = (i: number) => read.phrases.find((p) => i >= p.from && i <= p.to);
  const barOf = (t: number) => Math.max(0, c.song.bars.findIndex((b) => t >= b.start && t < b.start + b.len));
  const used = new Map<string, number>();
  interface Choice { intent: Intent | 'dress' | 'plain'; name: string; contour?: string; cell?: string; kind?: string }
  const chosen: Choice[] = notes.map(() => ({ intent: 'plain', name: 'plain' }));
  const recent: string[] = [];
  let lastRule = { i: -9, name: '' };
  /** How many short notes are dressed in each bar (no piling up). */
  const dressedIn = new Map<number, number>();
  // the notes the hands cannot finger as they are (a rewrite is only held against what it breaks itself)
  const baseBad = new Set(unplayable(ev0, vctx).map((e) => e.base));
  const handsOk = () => !unplayable(assemble(), vctx).some((e) => e.extra || (e.base !== undefined && !baseBad.has(e.base)));

  const spanFor = (k: number): Span => ({
    note: notes[k], event: ev0[notes[k].ev], read: read.notes[k], prev: notes[k - 1] ?? null, next: notes[k + 1] ?? null,
    before: k ? Math.max(0, notes[k].t - (notes[k - 1].t + notes[k - 1].len)) : notes[k].t,
    after: notes[k + 1] ? Math.max(0, notes[k + 1].t - (notes[k].t + notes[k].len)) : 0,
    ctx: c,
  });
  /** Notes already played as part of a run begun on an earlier note. */
  const claimed = new Set<number>();
  /** Breath switch: how many quick sounding events in a row end just before note `i` (what its earlier notes, and the fills before them, play now). */
  const quickBefore = (i: number): number => {
    const evs = [...groups.slice(0, i).flat(), ...[...extras].filter(([k]) => k < i).flatMap(([, v]) => v)].filter((e) => !e.hit.mute).sort((a, b) => a.t - b.t);
    let n = 0;
    for (let k = evs.length - 1; k >= 0 && evs[k].len < 4; k--) n++;
    return n;
  };

  notes.forEach((note, i) => {
    if (claimed.has(i)) return;
    const nr = read.notes[i];
    const span = spanFor(i);
    const tagw = (id: string) => nr.tags.find((t) => t.id === id)?.w ?? 0;
    const e01 = (Number(nr.facts.energy ?? 0) + 1) / 2;
    // what the moment wants, with the player's own lean
    const want = {} as Feel;
    for (const k of Object.keys(nr.feel) as (keyof Feel)[]) want[k] = Math.max(-1, Math.min(1, nr.feel[k] + person.lean[k]));
    const rng = new Rng(`${c.seed}-player-${note.t}-${note.midi}`);
    if (note.frozen) { moves[i].note = 'the last note is carried into the next section'; return; }
    if (c.breath && !o.force && quickBefore(i) >= BREATH_AFTER) { moves[i].note = 'a breath after a busy stretch'; return; }

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
    const attempt = (evs: PEvent[] | null, hands: boolean, push = 0): boolean => {
      if (!evs) return false;
      // a push: the note before gives up the time (its last event ends that much sooner)
      const before = i ? groups[i - 1] : null;
      if (push > 0) {
        if (!before || notes[i - 1].anchor === 'all') return false;
        const k = before.reduce((best, e, j) => (endOf(e) > endOf(before[best]) ? j : best), 0);
        const e = before[k];
        if (!e || Math.abs(endOf(e) - note.t) > TOL || e.len - push < 0.5) return false;
        groups[i - 1] = before.map((x, j) => (j === k ? { ...x, len: snap(x.len - push), hit: { ...x.hit, len: snap(x.len - push) } } : x));
      }
      groups[i] = evs.map((e) => ({ ...e, base: note.i }));
      if (!fresh().length && (!hands || handsOk())) return true;
      groups[i] = plainOf(i);
      if (push > 0 && before) groups[i - 1] = before;
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

    // a note too short for a figure: dressed with a small touch (a grace note, a mordent, a quick bend, a slide, a scratch, a hair late or early), a third of the time
    if (note.len < 4) {
      const figuresOn0 = rules.some((r) => r.name === 'figures');
      if (!figuresOn0) {
        const stay = scored;
        if (!stay.length || !rng.chance(0.5 * person.density)) { moves[i].note = 'short: left plain'; return; }
        for (const r of drawn(stay.map((x) => ({ v: x.r, w: x.w })))) {
          if (attempt(r.realise(span, new Rng(`${c.seed}-rule-${r.name}-${note.t}-${note.midi}`)), false)) { done({ intent: 'stay', name: r.name }, 'stay'); return; }
        }
        return;
      }
      const forced = DRESS_KINDS.includes(o.force as string) ? o.force : undefined;
      if (o.force && !forced) { moves[i].note = 'short: left plain'; return; }
      const prevC = i ? chosen[i - 1] : null;
      const prevBend = !!prevC && (!!prevC.contour?.startsWith('bend-') || prevC.name === 'bend-in' || prevC.name === 'late-bend');
      // the phrase this one repeats: dressed as it was (mostly), or left plain as it was
      const ph0 = phraseOf(i);
      const src0 = ph0?.copyOf !== undefined ? read.phrases[ph0.copyOf] : undefined;
      const srcI0 = src0 && ph0 ? src0.from + (i - ph0.from) : -1;
      const copy0: Choice | null = !forced && src0 && srcI0 <= src0.to && rng.chance(0.85) ? chosen[srcI0] : null;
      if (copy0 && copy0.intent !== 'dress') { moves[i].note = 'as the phrase it repeats'; moves[i].intent = 'stay'; return; }
      let only: string | undefined = forced ?? copy0?.kind;
      if (!forced) {
        // (a short note is the breath between the busy ones: it stays plain after a dressed note or a flourish, and at most two to a bar)
        const busy = !!prevC && (prevC.intent === 'dress' || prevC.contour === 'trill' || !!prevC.contour?.startsWith('bend-'));
        if (busy) { moves[i].note = 'short: a breath after a busy note'; return; }
        if ((dressedIn.get(barOf(note.t)) ?? 0) >= 2) { moves[i].note = 'short: the bar is busy enough'; return; }
        if (!only && !rng.chance(clamp(0.58 * person.density * (0.65 + 0.7 * e01), 0, 0.65))) { moves[i].note = 'short: left plain'; return; }
      }
      const profile = profileFor(c.mood, 'solo', c.tension[barOf(note.t)]);

      // a run: a cell of 3 or 4 short notes that touch, each leaning into the next
      const cell = read.cells.filter((cl) => cl.from === i && cl.to - cl.from >= 2).sort((a, b) => b.w - a.w)[0];
      if (cell && (only === 'run' || (!only && rng.chance(clamp(0.3 * (person.join.run ?? 1), 0, 0.6))))) {
        const last = Math.min(cell.to, cell.from + 3);
        const changes: { k: number; m: ReturnType<typeof composeJoint>[number] }[] = [];
        for (let k = i; k < last; k++) {
          const nk = notes[k];
          if (nk.len >= 4 || nk.frozen || claimed.has(k)) break;
          const cj = composeJoint(spanFor(k), { person, want, profile, mood: c.mood, prevPitch: null, onDrum: false, prevBend: false }, new Rng(`${c.seed}-run-${nk.t}-${nk.midi}`));
          if (!cj.length) break;
          const pick = new Rng(`${c.seed}-runpick-${nk.t}-${nk.midi}`).weighted(cj.map((x) => [x, x.w] as [typeof x, number]));
          changes.push({ k, m: pick });
        }
        if (changes.length >= 2) {
          for (const ch of changes) groups[ch.k] = ch.m.events.map((e) => ({ ...e, base: notes[ch.k].i }));
          if (!fresh().length && handsOk()) {
            for (const ch of changes) {
              chosen[ch.k] = { intent: 'dress', name: 'dress·run', contour: 'run', kind: 'run' };
              moves[ch.k].rule = 'dress·run'; moves[ch.k].intent = 'dress'; moves[ch.k].fig = `run, ${ch.m.label}`;
              if (ch.k > i) claimed.add(ch.k);
            }
            used.set('dress·run', (used.get('dress·run') ?? 0) + 1); lastRule = { i, name: 'dress·run' };
            dressedIn.set(barOf(note.t), (dressedIn.get(barOf(note.t)) ?? 0) + changes.length);
            return;
          }
          for (const ch of changes) groups[ch.k] = plainOf(ch.k);
        }
        if (only === 'run') { moves[i].note = 'short: no run fits'; return; }
        only = undefined;
      }
      const lastOfPrev = i ? groups[i - 1].filter((e) => !e.hit.mute).reduce<PEvent | null>((b, e) => (!b || endOf(e) > endOf(b) ? e : b), null) : null;
      const onDrum = ['on-snare', 'on-crash'].some((id) => tagw(id) >= 0.5);
      const dressAsk = { person, want, profile, mood: c.mood, prevPitch: lastOfPrev?.hit.notes[0] ?? null, onDrum, prevBend, only };
      const shortRng = new Rng(`${c.seed}-short-${note.t}-${note.midi}`);
      // (a touch on the note, or a lean into the next one)
      const cands = [...composeShort(span, dressAsk, shortRng), ...composeJoint(span, dressAsk, shortRng)];
      if (!cands.length) { moves[i].note = 'short: no touch fits'; return; }
      moves[i].scores = [...cands].sort((a, b) => b.w - a.w).slice(0, 5).map((m) => [m.kind, Math.round(m.w * 100) / 100]);
      for (const m of drawn(cands.map((x) => ({ v: x, w: x.w }))).slice(0, 4)) {
        if (attempt(m.events, true, m.push)) {
          done({ intent: 'dress', name: `dress·${m.kind}`, contour: m.kind === 'bend' ? 'bend-short' : m.kind, kind: m.kind }, 'dress', m.label);
          dressedIn.set(barOf(note.t), (dressedIn.get(barOf(note.t)) ?? 0) + 1);
          return;
        }
      }
      moves[i].note = 'short: every touch failed the check';
      return;
    }

    // (a check that forces one way of dressing a short note leaves the long ones as they are)
    if (DRESS_KINDS.includes(o.force as string) || REST_KINDS.includes(o.force as string)) { moves[i].note = 'long: left plain'; return; }

    // what the note is for
    const figuresOn = rules.some((r) => r.name === 'figures');
    const canBridge = figuresOn && note.anchor !== 'all' && !!span.next && span.after <= 2;
    const weights = intentWeights({ mood: c.mood, e01, tag: tagw, person, canBridge });
    if (!figuresOn) weights.return = 0;
    if (o.force) {
      // (for the checks: the named rule, or every figure of a named intention)
      if (rules.some((r) => r.name === o.force)) { for (const k of Object.keys(weights) as Intent[]) weights[k] = 0; weights.stay = 1; }
      else if (o.force === 'return' || o.force === 'bridge' || o.force === 'bend-run' || o.force === 'trill') { for (const k of Object.keys(weights) as Intent[]) weights[k] = 0; weights[o.force === 'bridge' ? 'bridge' : 'return'] = 1; }
    }
    if (weights.stay + weights.return + weights.bridge <= 0) { moves[i].note = 'no rule to play it with'; return; }
    const order: Intent[] = drawn((Object.keys(weights) as Intent[]).filter((k) => weights[k] > 0).map((k) => ({ v: k, w: weights[k] })));
    // the same move as the phrase this one repeats (mostly)
    const ph = phraseOf(i);
    const src = ph?.copyOf !== undefined ? read.phrases[ph.copyOf] : undefined;
    const srcI = src && ph ? src.from + (i - ph.from) : -1;
    const copy: Choice | null = src && srcI <= src.to && rng.chance(0.85) && !o.force && chosen[srcI].intent !== 'dress' ? chosen[srcI] : null;
    if (copy && copy.intent !== 'plain' && copy.intent !== 'dress') { const k = order.indexOf(copy.intent); if (k > 0) { order.splice(k, 1); order.unshift(copy.intent); } }
    else if (copy && !o.force) { moves[i].note = 'as the phrase it repeats'; moves[i].intent = 'stay'; return; }

    const tension = c.tension[barOf(note.t)];
    const failed: string[] = [];
    for (const intent of order) {
      if (intent === 'stay') {
        const pool = scored.map((x) => ({ v: x.r, w: x.w * (copy?.name === x.r.name ? 6 : 1) }));
        // (a held note is only sometimes plain: the weight of the plain hold is the weight of an average way to decorate it)
        if (!o.force) {
          if (rng.chance(0.3) || !pool.length) { done({ intent: 'stay', name: 'plain' }, 'stay'); if (failed.length) moves[i].note = `held: no ${failed.join(' or ')} fit`; return; }
        }
        for (const r of drawn(pool)) {
          if (attempt(r.realise(span, new Rng(`${c.seed}-rule-${r.name}-${note.t}-${note.midi}`)), false)) { done({ intent, name: r.name }, intent); if (failed.length) moves[i].note = `no ${failed.join(' or ')} fit`; return; }
        }
        failed.push(intent);
        continue;
      }
      const profile = profileFor(c.mood, 'solo', tension);
      const prevBend = i >= 1 && !!chosen[i - 1].contour?.startsWith('bend-');
      const prevTrill = i >= 1 && chosen[i - 1].contour === 'trill';
      const copied = copy && copy.intent === intent && !(prevBend && copy.contour?.startsWith('bend-')) ? { contour: copy.contour, cell: copy.cell } : undefined;
      // a quick bend into the note, then a flourish: the player's taste for it, the mood, a pet move; not twice running, not on the final landing
      const bendP = intent !== 'return' || prevBend || tagw('final-landing') >= 0.5 ? 0
        : Math.min(0.92, 0.85 * (person.taste['bend-run'] ?? 1) * (signatures.has('bend-run') ? 1.5 : 1) * (['angry', 'triumphant', 'happy', 'tense'].includes(c.mood) ? 1.1 : c.mood === 'dreamy' ? 0.7 : 1) * (0.7 + 0.6 * e01) * (span.before >= 1 ? 1.15 : 1));
      const forceBend = o.force === 'bend-run';
      const ask = { intent, person, want, profile, mood: c.mood, avoid: recent.slice(-3), prefer: copied, bend: forceBend ? 1 : bendP };
      const figs = [];
      // a trill (written as notes at the tempo): the player's taste, more with energy; not twice running
      if (intent === 'return' && !forceBend && !copied?.contour?.startsWith('bend-') && (o.force === 'trill' || copied?.contour === 'trill' || (!o.force && !prevTrill && rng.chance(Math.min(0.3, 0.07 * (person.taste.trill ?? 1) * (signatures.has('trill') ? 1.6 : 1) * (0.5 + e01)))))) {
        figs.push(...composeTrill(span, ask, new Rng(`${c.seed}-trill-${note.t}-${note.midi}`)));
      }
      if (!(o.force === 'trill' && figs.length)) figs.push(...composeFigures(span, ask, new Rng(`${c.seed}-fig-${intent}-${note.t}-${note.midi}`)));
      if (!figs.length) { failed.push(intent); continue; }
      moves[i].scores = [...figs].sort((a, b) => b.w - a.w).slice(0, 5).map((f) => [`${f.contour} ${f.cell}`, Math.round(f.w * 100) / 100]);
      const list = drawn(figs.map((f) => ({ v: f, w: f.contour === 'trill' ? 1000 : f.w })));
      for (const f of list.slice(0, 10)) {
        if (attempt(f.events, true)) {
          recent.push(f.contour);
          done({ intent, name: `${intent}·${f.contour}`, contour: f.contour, cell: f.cell }, intent, f.lens ? `${f.label} · lengths ${f.lens}` : f.label);
          return;
        }
      }
      failed.push(intent);
    }
    moves[i].note = 'every try failed the check';
  });

  // ---- rests (step 4c): the silence before a note is mostly left as the breath; now and then a pickup leans into the note, or a muted scratch
  if (rules.some((r) => r.name === 'figures') && (!o.force || REST_KINDS.includes(o.force))) {
    const lastSounding = (g: PEvent[]) => g.filter((e) => !e.hit.mute).reduce<PEvent | null>((b, e) => (!b || endOf(e) > endOf(b) ? e : b), null);
    const firstSounding = (g: PEvent[]) => g.filter((e) => !e.hit.mute).reduce<PEvent | null>((b, e) => (!b || e.t < b.t ? e : b), null);
    notes.forEach((note, i) => {
      if (note.frozen) return;
      const span = spanFor(i);
      if (span.before < 2 - 1e-6) return;
      if (c.breath && !o.force && quickBefore(i) >= BREATH_AFTER) { moves[i].note = moves[i].note ?? 'the rest before it stays silent: a breath after a busy stretch'; return; }
      const rng = new Rng(`${c.seed}-rest-${note.t}-${note.midi}`);
      const nr = read.notes[i];
      const e01 = (Number(nr.facts.energy ?? 0) + 1) / 2;
      // (most rests stay the breath they are)
      if (!o.force && !rng.chance(clamp(0.75 * person.density * (0.6 + 0.8 * e01), 0, 0.75))) { moves[i].note = moves[i].note ?? 'the rest before it stays silent'; return; }
      const want = {} as Feel;
      for (const k of Object.keys(nr.feel) as (keyof Feel)[]) want[k] = Math.max(-1, Math.min(1, nr.feel[k] + person.lean[k]));
      const prev = i ? lastSounding(groups[i - 1]) : null;
      const first = firstSounding(groups[i]);
      if (!first) return;
      const cands = composeRest(span, { person, want, profile: profileFor(c.mood, 'solo', c.tension[barOf(note.t)]), prevPitch: prev?.hit.notes[0] ?? null, nextFirst: first.hit.notes[0], silence: span.before, only: o.force }, rng);
      const rest = cands.map((x) => [x, x.w] as [typeof x, number]);
      while (rest.length) {
        const pick = rng.weighted(rest);
        rest.splice(rest.findIndex((x) => x[0] === pick), 1);
        extras.set(i, pick.events);
        if (!fresh().length && handsOk()) { moves[i].lead = `${pick.kind}: ${pick.label}`; return; }
        extras.delete(i);
      }
    });
  }

  // the hands have the last word: a note with no place on the neck goes back to being played as it was
  for (let guard = 0; guard < notes.length + extras.size; guard++) {
    const bad = unplayable(assemble(), vctx).filter((e) => e.extra || (e.base !== undefined && !baseBad.has(e.base)));
    if (!bad.length) break;
    for (const e of bad) {
      if (e.extra) { for (const [i, evs] of extras) if (evs.includes(e)) { extras.delete(i); delete moves[i].lead; } continue; }
      groups[e.base!] = plainOf(e.base!); moves[e.base!].rule = 'plain'; moves[e.base!].note = 'no place on the neck';
    }
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
