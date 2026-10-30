// The wah pedal, in front of a guitar's amp (docs/WAH.md).
//  - auto: an auto-wah. The picking opens it, so every hit quacks (funk rhythm).
//  - cocked: the pedal parked half way: a nasal, vocal tone (rock leads).
// Off, nothing is built: only the dry path, which is the guitar as before.
import * as Tone from 'tone';

export type WahMode = 'auto' | 'cocked';

/** The sound of each: the filter's resonance, where it sits or sweeps (Hz), how much of the guitar still comes through. */
export const WAH = {
  auto: { q: 4.5, low: 350, high: 2400, sense: 3.5, dry: 0.25, wet: 4 },
  cocked: { q: 3.5, at: 950, dry: 0.3, wet: 3.6 },
};
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
    filter.frequency.setValueAtTime(mode === 'cocked' ? WAH.cocked.at : 0, time);
    sweep.gain.cancelScheduledValues(time).setValueAtTime(mode === 'auto' ? 1 : 0, time);
    this.dry.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.dry, to);
    wet.gain.cancelScheduledValues(time).linearRampToValueAtTime(p.wet, to);
  }
}
