// The wah pedal, in front of a guitar's amp (docs/WAH.md).
//  - auto: an auto-wah. The picking opens it, so every hit quacks (funk rhythm).
//  - cocked: the pedal parked half way: a nasal, vocal tone (rock leads).
//  - rock: parked like that, and rocked heel to toe on the long held notes, a little off the beat's length each time.
// Off, nothing is built: only the dry path, which is the guitar as before.
import * as Tone from 'tone';

export type WahMode = 'auto' | 'cocked' | 'rock';

/** The sound of each: the filter's resonance, where it sits or sweeps (Hz), how much of the guitar still comes through. */
export const WAH = {
  auto: { q: 4.5, low: 350, high: 2400, sense: 3.5, dry: 0.25, wet: 4 },
  cocked: { q: 3.5, at: 950, dry: 0.3, wet: 3.6 },
  // (rocked: the pedal's two ends, heel and toe, in Hz; narrower through a distorted amp, where a wide sweep turns to mush)
  rock: { q: 3.5, at: 950, dry: 0.3, wet: 3.6, heel: 450, toe: 2000, narrowHeel: 650, narrowToe: 1500 },
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

/** The pedal's pitch (Hz) over `cycles` rocks: heel to toe and back, smooth, even in pitch steps. Starts and ends at the heel. */
export function rockCurve(cycles: number, heel: number, toe: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= cycles * ROCK_POINTS; i++) {
    const pos = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / ROCK_POINTS);
    out.push(heel * (toe / heel) ** pos);
  }
  return out;
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
  set(mode: WahMode | undefined, time = Tone.now()) {
    if (mode === this.mode) return;
    this.mode = mode;
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
    const p = WAH[mode];
    filter.Q.setValueAtTime(p.q, time);
    // (cocked: a fixed pitch; auto: no pitch of its own, the picking sets it)
    filter.frequency.cancelScheduledValues(time).setValueAtTime(mode === 'auto' ? 0 : WAH.cocked.at, time);
    sweep.gain.cancelScheduledValues(time).setValueAtTime(mode === 'auto' ? 1 : 0, time);
    this.dry.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.dry, to);
    wet.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.wet, to);
  }

  /** A held note from `time` for `dur` s: rock the pedal through it (only when this wah is the rocking one). */
  rock(time: number, dur: number, six: number, narrow: boolean) {
    if (this.mode !== 'rock' || !this.built) return;
    const plan = rockPlan(dur, six, time * 100);
    if (!plan) return;
    const r = WAH.rock, f = this.built.filter.frequency;
    const values = rockCurve(plan.cycles, narrow ? r.narrowHeel : r.heel, narrow ? r.narrowToe : r.toe);
    const start = time + 0.03, len = plan.cycles * plan.cycle;
    try {
      // (from the parked pedal to the heel, rock, and back to parked)
      f.cancelScheduledValues(time).setValueAtTime(r.at, time).linearRampToValueAtTime(values[0], start);
      f.setValueCurveAtTime(values, start, len);
      f.linearRampToValueAtTime(r.at, start + len + 0.06);
    } catch { /* (an overlap with an earlier rock: this note stays parked) */ }
  }
}
