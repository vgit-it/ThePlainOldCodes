// The wah pedal, in front of a guitar's amp (docs/WAH.md).
//  - auto: an auto-wah. The picking opens it, so every hit quacks (funk rhythm).
//  - cocked: the pedal parked half way: a nasal, vocal tone (rock leads).
//  - rock: parked like that, and rocked heel to toe on the long held notes, a little off the beat's length each time.
// Three strengths (Wah pedal switch): subtle, normal (the sound as first built) and strong (a sharper wah, the pedal moved on every lead note,
// and a chick-a pedal on the funk rhythm).
// Off, nothing is built: only the dry path, which is the guitar as before.
import * as Tone from 'tone';

export type WahMode = 'auto' | 'cocked' | 'rock';
/** How strong the pedal is. `normal` is the sound as first built; a section without a mark is normal. */
export type WahAmount = 'subtle' | 'normal' | 'strong';

/** The sound of each: the filter's resonance, where it sits or sweeps (Hz), how much of the guitar still comes through. */
export const WAH = {
  auto: { q: 4.5, low: 350, high: 2400, sense: 3.5, dry: 0.25, wet: 4 },
  cocked: { q: 3.5, at: 950, dry: 0.3, wet: 3.6 },
  // (rocked: the pedal's two ends, heel and toe, in Hz; narrower through a distorted amp, where a wide sweep turns to mush)
  rock: { q: 3.5, at: 950, dry: 0.3, wet: 3.6, heel: 450, toe: 2000, narrowHeel: 650, narrowToe: 1500 },
};

/** The same, for each strength. Auto also has `base` (Hz the pedal rests at; 0: nothing of its own, the picking sets it), `follow` (how far the picking opens it) and `chick` (Hz a chick-a stroke opens to; 0: none). */
export const WAH_BY = {
  normal: { auto: { ...WAH.auto, base: 0, follow: 1, chick: 0 }, cocked: WAH.cocked, rock: WAH.rock },
  // (softer: a lower, wider peak, with more of the guitar kept in)
  subtle: {
    auto: { ...WAH.auto, q: 3, dry: 0.5, wet: 2.4, base: 0, follow: 0.7, chick: 0 },
    cocked: { ...WAH.cocked, q: 2.5, dry: 0.5, wet: 2.2 },
    rock: { ...WAH.rock, q: 2.5, dry: 0.5, wet: 2.2 },
  },
  // (sharper: a taller, narrower peak, a wider pedal, less of the dry guitar)
  strong: {
    auto: { ...WAH.auto, q: 7, dry: 0.2, wet: 5, base: 250, follow: 0.5, chick: 1500 },
    cocked: { ...WAH.cocked, q: 6, dry: 0.2, wet: 4.8 },
    rock: { ...WAH.rock, q: 6, dry: 0.2, wet: 4.8, heel: 380, toe: 2400, narrowHeel: 520, narrowToe: 1900 },
  },
};
/** A held note rocks the pedal from this many 16ths up. Shorter notes sit at the parked pedal. */
export const ROCK_MIN_LEN = 6;
/** The share of held notes that get rocked. */
export const ROCK_SHARE = 0.75;
/** Points a cycle of the pedal's curve is cut into. */
const ROCK_POINTS = 12;

/** A cheap hash of a number to 0-1: the same note always rocks the same way. */
const luck = (n: number) => {
  let x = Math.imul(Math.round(n) ^ 0x9e3779b9, 2654435761);
  x = Math.imul(x ^ (x >>> 15), 2246822507);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

/** How a held note rocks the pedal: the length of each rock (a beat, a little off it so it isn't a machine) and how many fit; none for a note that stays parked. */
export function rockPlan(dur: number, six: number, seed: number): { cycle: number; cycles: number } | null {
  if (luck(seed) >= ROCK_SHARE) return null;
  const cycle = 4 * six * (1 + (luck(seed + 1) - 0.5) * 0.24);
  const cycles = Math.floor((dur - 0.1) / cycle);
  return cycles >= 1 ? { cycle, cycles } : null;
}

/** The pedal's pitch (Hz) over `cycles` rocks: heel to toe and back, smooth, even in pitch steps. Starts and ends at the heel (`open`: the last rock stops at the toe, the pedal left down). */
export function rockCurve(cycles: number, heel: number, toe: number, open = false): number[] {
  const out: number[] = [];
  const last = cycles * ROCK_POINTS - (open ? ROCK_POINTS / 2 : 0);
  for (let i = 0; i <= last; i++) {
    const pos = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / ROCK_POINTS);
    out.push(heel * (toe / heel) ** pos);
  }
  return out;
}
/** Where the foot is: when its last move ends, where the pedal is then (0 heel to 1 toe) and which way that move went. */
export interface Foot { end: number; pos: number; dir: 1 | -1 }
export const restFoot = (): Foot => ({ end: 0, pos: 0.5, dir: 1 });
/** The pedal's pitch (Hz) at a place (0 heel to 1 toe): even steps in pitch. */
export const footHz = (pos: number, heel: number, toe: number) => heel * (toe / heel) ** pos;

/** One move of the foot. A stroke goes `from` to `to` (places, 0-1) in `span` s. A rock is `cycles` rocks of `cycle` s from the heel up to `reach`, the last one left open (down at the toe) or not. */
export type FootMove =
  | { kind: 'stroke'; from: number; to: number; span: number }
  | { kind: 'rock'; reach: number; cycle: number; cycles: number; open: boolean };

/**
 * Strong wah: what the foot does for a lead note at `time` lasting `dur`, or none (it is still on its last move).
 * Each note moves it, the way a player's foot follows the phrase: up and down in turn, a different reach each time, never faster than about 2 moves a beat;
 * a long note rocks it; after a rest it starts again from half way. `seed` makes the same note move the same way every time.
 */
export function footMove(foot: Foot, time: number, dur: number, six: number, seed: number): FootMove | null {
  if (time < foot.end - 0.005) return null;
  const beat = 4 * six;
  const reach = 0.55 + 0.45 * luck(seed + 2);
  if (dur >= beat * 1.6) {
    const cycle = beat * (1 + (luck(seed + 1) - 0.5) * 0.4);
    const cycles = Math.floor((dur - 0.1) / cycle);
    if (cycles >= 1) return { kind: 'rock', reach, cycle, cycles, open: luck(seed + 3) < 0.35 };
  }
  const fresh = foot.end === 0 || time - foot.end > 2 * beat;
  const dir: 1 | -1 = fresh ? (luck(seed) < 0.6 ? 1 : -1) : (foot.dir === 1 ? -1 : 1);
  const from = fresh ? 0.5 : foot.pos;
  const to = dir === 1 ? 0.5 + 0.5 * reach : 0.5 - 0.5 * reach;
  const span = Math.min(Math.max(dur * 0.9, 2.2 * six, 0.2), beat * 1.3);
  return { kind: 'stroke', from, to, span };
}

/** How long the pedal takes to go on or off (seconds). */
export const WAH_FADE = 0.04;

/** The auto-wah's filter pitch for a picking level (0 quiet to 1 loud): up an exponential sweep, harder picking opens it more. */
export const autoWahHz = (level: number) => {
  const open = Math.max(0, Math.min(1, level * WAH.auto.sense));
  return WAH.auto.low * (WAH.auto.high / WAH.auto.low) ** open;
};

export class Wah {
  readonly input = new Tone.Gain();
  private readonly dry = new Tone.Gain(1);
  private built?: { wet: Tone.Gain; sweep: Tone.Gain; filter: Tone.BiquadFilter };
  private mode: WahMode | undefined;
  private amount: WahAmount = 'normal';
  /** The strong wah's foot (lead notes) and where its chick-a stroke (funk rhythm) ends. */
  private foot = restFoot();
  private chickEnd = 0;

  constructor(private readonly out: Tone.InputNode) {
    this.input.chain(this.dry, out);
  }

  /** The pedal's filter, made the first time it's wanted (an idle one keeps the audio graph busy). It starts silent, so adding it makes no click. */
  private build() {
    if (this.built) return this.built;
    const filter = new Tone.BiquadFilter({ type: 'bandpass', frequency: 0, Q: WAH.auto.q });
    const wet = new Tone.Gain(0);
    // the auto-wah: how hard the guitar is picked, followed, sets the filter's pitch
    const follow = new Tone.Follower(0.07);
    const curve = new Tone.WaveShaper((x: number) => autoWahHz(Math.max(0, x)), 1024);
    const sweep = new Tone.Gain(0);
    this.input.connect(filter);
    filter.chain(wet, this.out);
    this.input.chain(follow, curve, sweep);
    sweep.connect(filter.frequency);
    return (this.built = { wet, sweep, filter });
  }

  /** From `time`: this wah, or none. */
  set(mode: WahMode | undefined, time = Tone.now(), amount: WahAmount = 'normal') {
    if (mode === this.mode && amount === this.amount) return;
    this.mode = mode;
    this.amount = amount;
    this.foot = restFoot();
    this.chickEnd = 0;
    const to = time + WAH_FADE;
    if (!mode) {
      // (nothing to turn off if it was never on)
      if (!this.built) return;
      const { wet, sweep } = this.built;
      this.dry.gain.cancelScheduledValues(time).linearRampToValueAtTime(1, to);
      wet.gain.cancelScheduledValues(time).linearRampToValueAtTime(0, to);
      sweep.gain.cancelScheduledValues(time).setValueAtTime(0, to);
      return;
    }
    const { wet, sweep, filter } = this.build();
    const p = WAH_BY[amount][mode];
    const auto = WAH_BY[amount].auto;
    filter.Q.cancelScheduledValues(time).setValueAtTime(p.q, time);
    // (cocked: a fixed pitch; auto: the picking sets it, from where the pedal rests)
    filter.frequency.cancelScheduledValues(time).setValueAtTime(mode === 'auto' ? auto.base : WAH.cocked.at, time);
    sweep.gain.cancelScheduledValues(time).setValueAtTime(mode === 'auto' ? auto.follow : 0, time);
    this.dry.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.dry, to);
    wet.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.wet, to);
  }

  /** A single lead note from `time` for `dur` s (`len` 16ths): rock the pedal through it (only when this wah is the rocking one). */
  rock(time: number, dur: number, six: number, narrow: boolean, len = ROCK_MIN_LEN) {
    if (this.mode !== 'rock' || !this.built) return;
    if (this.amount === 'strong') return this.step(time, dur, six, narrow);
    if (len < ROCK_MIN_LEN) return;
    const plan = rockPlan(dur, six, time * 100);
    if (!plan) return;
    const r = WAH_BY[this.amount].rock, f = this.built.filter.frequency;
    const values = rockCurve(plan.cycles, narrow ? r.narrowHeel : r.heel, narrow ? r.narrowToe : r.toe);
    const start = time + 0.03, span = plan.cycles * plan.cycle;
    try {
      // (from the parked pedal to the heel, rock, and back to parked)
      f.cancelScheduledValues(time).setValueAtTime(r.at, time).linearRampToValueAtTime(values[0], start);
      f.setValueCurveAtTime(values, start, span);
      f.linearRampToValueAtTime(r.at, start + span + 0.06);
    } catch { /* (an overlap with an earlier rock: this note stays parked) */ }
  }

  /** The strong wah: the foot moves for this note (see `footMove`). */
  private step(time: number, dur: number, six: number, narrow: boolean) {
    const r = WAH_BY.strong.rock, f = this.built!.filter.frequency;
    const heel = narrow ? r.narrowHeel : r.heel, toe = narrow ? r.narrowToe : r.toe;
    const move = footMove(this.foot, time, dur, six, time * 100);
    if (!move) return;
    try {
      f.cancelScheduledValues(time);
      if (move.kind === 'stroke') {
        f.setValueAtTime(footHz(move.from, heel, toe), time).exponentialRampToValueAtTime(footHz(move.to, heel, toe), time + move.span);
        this.foot = { end: time + move.span, pos: move.to, dir: move.to > move.from ? 1 : -1 };
      } else {
        const values = rockCurve(move.cycles, heel, footHz(move.reach, heel, toe), move.open);
        const start = time + 0.03, span = (move.cycles - (move.open ? 0.5 : 0)) * move.cycle;
        f.setValueAtTime(footHz(this.foot.end ? this.foot.pos : 0.5, heel, toe), time).linearRampToValueAtTime(values[0], start);
        f.setValueCurveAtTime(values, start, span);
        this.foot = { end: start + span, pos: move.open ? move.reach : 0, dir: move.open ? 1 : -1 };
      }
    } catch { /* (an overlap with an earlier move: the foot stays where it was) */ }
  }

  /** A funk rhythm hit (strong auto-wah only): a quick chick-a stroke of the pedal, open on the attack and shut on the tail. */
  chick(time: number, dur: number, six: number) {
    if (this.mode !== 'auto' || this.amount !== 'strong' || !this.built) return;
    if (time < this.chickEnd - 0.005) return;
    const a = WAH_BY.strong.auto, f = this.built.filter.frequency;
    const span = Math.min(Math.max(dur * 0.9, 2 * six), 4 * six);
    const peak = a.base * (a.chick / a.base) ** (0.6 + 0.4 * luck(time * 100 + 7));
    try {
      f.cancelScheduledValues(time).setValueAtTime(a.base, time)
        .exponentialRampToValueAtTime(peak, time + span * 0.3).exponentialRampToValueAtTime(a.base, time + span);
      this.chickEnd = time + span;
    } catch { /* (an overlap: skip this stroke) */ }
  }
}
