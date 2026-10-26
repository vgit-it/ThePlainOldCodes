// The story of a solo (docs/SOLO-STORY.md, stage 1). Before any lick is written, each gap between the core notes is studied (how long,
// how far the jump, how much energy, where it sits against the climax) and given a part in the story: a statement, an answer, a build,
// a ramp into the climax, a release, a return of the opening. Gaps of the same size are marked, so a phrase can come back in them.
// Nothing is drawn from the dice and no notes are written: the plan only prints, so it can be read before the licks are built on it.

import type { Song, StoryGap } from '../idea';
import { NOTE_NAMES } from '../theory';
import type { Core } from './solocore';
import { scaleSteps } from './solomoves';

/** A ramp (fast notes climbing into the climax) needs at least this much room (16ths); a shorter gap into the climax is a build. */
export const RAMP_MIN = 6;
/** A statement, or a return of it, needs at least this much room (16ths). */
export const PHRASE_MIN = 8;
/** Two gaps are "the same size" within this share of the longer one (and at least 2 16ths). */
const SAME = 0.25;

const WORDS: Record<StoryGap['role'], string> = {
  statement: 'statement (the first sung phrase, space left)',
  answer: 'answer (the statement again, changed)',
  build: 'build (shorter, busier phrases)',
  ramp: 'ramp (fast notes climbing into the climax)',
  release: 'release (falling, long notes, space)',
  return: 'return (the opening phrase, back)',
  link: 'link (too short for a phrase)',
};

const sameSize = (a: number, b: number) => Math.abs(a - b) <= Math.max(2, SAME * Math.max(a, b));

/** The part of every gap in the story, in order. `E` is the energy at a step. */
export function planStory(song: Song, cores: Core[], E: (g: number) => number): StoryGap[] {
  const barOf = (g: number) => { for (let i = song.bars.length - 1; i >= 0; i--) if (g >= song.bars[i].start) return song.bars[i]; return song.bars[0]; };
  const ci = cores.findIndex((k) => k.role === 'climax');
  const gaps: StoryGap[] = [];
  cores.forEach((k, into) => {
    const from = into ? cores[into - 1].step + cores[into - 1].len : 0, to = k.step, len = to - from;
    if (len <= 0) return;
    const beat = Math.min(...barOf(from).groups);
    const prev = into ? cores[into - 1].midi : null;
    const steps = prev === null ? 0 : scaleSteps(song, prev, k.midi) * (k.midi >= prev ? 1 : -1);
    gaps.push({ into, from, to, beats: Math.round((10 * len) / beat) / 10, steps, energy: Math.round(100 * E((from + to) / 2)) / 100, role: len < beat ? 'link' : 'build', label: '' });
  });

  // ---- the parts: the climax's gap is the ramp, what follows it is the release, what leads up to it is told as statement, answer, build
  let statement: StoryGap | undefined, answered = false;
  for (const g of gaps) {
    const len = g.to - g.from;
    if (g.role === 'link') continue;
    if (ci >= 0 && g.into === ci) { g.role = len >= RAMP_MIN ? 'ramp' : 'build'; continue; }
    if (ci >= 0 && g.into > ci) { g.role = 'release'; continue; }
    if (!statement && len >= PHRASE_MIN) { g.role = 'statement'; statement = g; continue; }
    const climaxAt = ci >= 0 ? cores[ci].step : song.total;
    if (statement && !answered && len >= RAMP_MIN && (g.from + g.to) / 2 < 0.6 * climaxAt) { g.role = 'answer'; answered = true; continue; }
  }
  // (with no climax, the last gap is the release)
  if (ci < 0) { const last = [...gaps].reverse().find((g) => g.role !== 'link'); if (last) last.role = 'release'; }
  // (the opening comes back in the last long gap after the climax, when there is more than one gap there)
  const after = gaps.filter((g) => g.role === 'release' && ci >= 0);
  const back = after.length > 1 && statement ? [...after].reverse().find((g) => g.to - g.from >= PHRASE_MIN) : undefined;
  if (back && back !== after[0]) back.role = 'return';

  // ---- gaps of the same size: a phrase can come back in them
  const lenOf = (g: StoryGap) => g.to - g.from;
  for (const g of gaps) {
    if (statement && g !== statement && (g.role === 'answer' || g.role === 'build') && sameSize(lenOf(g), lenOf(statement))) g.repeatOf = statement.into;
    if (g.role === 'return' && statement) g.repeatOf = statement.into;
  }

  // ---- the names: A for the statement, A′ for an answer of its size, B for another answer
  for (const g of gaps) {
    g.label = g.role === 'statement' ? 'A' : g.role === 'answer' ? (g.repeatOf !== undefined ? 'A′' : 'B') : g.role === 'return' ? 'A (back)' : g.role;
  }
  // (after the climax: the first is the release, the ones between fall, the one into the last core closes)
  const rel = gaps.filter((g) => g.role === 'release');
  rel.forEach((g, q) => { if (q > 0) g.label = q === rel.length - 1 && cores[g.into].role === 'end' ? 'close' : 'fall'; });
  return gaps;
}

/** The whole story in a line: `A, A′, build, ramp, PEAK, release, A (back)`. */
export function storyLine(gaps: StoryGap[], cores: Core[]): string {
  const ci = cores.findIndex((k) => k.role === 'climax');
  const parts: string[] = [];
  cores.forEach((_, into) => {
    const g = gaps.find((x) => x.into === into);
    if (g && g.role !== 'link') parts.push(g.label);
    if (into === ci) parts.push('PEAK');
  });
  return parts.join(', ');
}

/** How the gaps sit against each other: the same size all through, long and short taking turns, or mixed. */
export function gapPattern(gaps: StoryGap[]): string {
  const lens = gaps.filter((g) => g.role !== 'link').map((g) => g.to - g.from);
  if (lens.length < 3) return 'too few gaps for a pattern';
  if (lens.every((n) => sameSize(n, lens[0]))) return 'even gaps (one phrase fits them all)';
  if (lens.length >= 4 && lens.every((n, i) => i < 2 || sameSize(n, lens[i - 2]))) return 'long and short taking turns (call and answer)';
  return 'mixed gaps';
}

/** One line per gap for the card: the bars, the part, how long, how far it has to travel. */
export function storyGapLine(song: Song, gap: StoryGap, core: Core): string {
  const barOf = (g: number) => { for (let i = song.bars.length - 1; i >= 0; i--) if (g >= song.bars[i].start) return i; return 0; };
  const a = barOf(gap.from) + 1, b = barOf(Math.max(gap.from, gap.to - 1)) + 1;
  const jump = gap.steps === 0 ? (gap.into === 0 ? '' : ', same note') : `, ${gap.steps > 0 ? 'up' : 'down'} ${Math.abs(gap.steps)} step${Math.abs(gap.steps) === 1 ? '' : 's'}`;
  const same = gap.repeatOf !== undefined ? ', the size of the opening' : '';
  return `${a === b ? 'bar ' + a : `bars ${a}-${b}`}: ${gap.label !== gap.role ? gap.label + ' = ' : ''}${WORDS[gap.role]}: ${gap.beats} beats${jump}${same}, into ${NOTE_NAMES[((core.midi % 12) + 12) % 12]}`;
}
