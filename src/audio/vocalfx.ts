// Vocal effects you switch on and off (the Vocal effects card): a live chain between the voice and its
// mixer strip, so it works while playing, in exports and in the band video. Inserts in series (speaker,
// grit, modulation, thicken), then two sends (echo, reverb) added back in. An effect that is off is not
// in the signal path at all, and its nodes are taken down (nothing runs for it: docs/PERFORMANCE.md).
// docs/VOCAL-FX.md

import * as Tone from 'tone';
import { inContext } from './context';

export type FxId = 'speaker' | 'grit' | 'mod' | 'thicken' | 'echo' | 'reverb';
export interface FxSetting { on: boolean; /** 0-100 */ amount: number; /** the variety (a speaker, a modulation, an echo, a reverb) */ kind: string }
export interface VocalFxState {
  fx: Record<FxId, FxSetting>;
  /** The backing singer gets the same effects. */
  backing: boolean;
}

export interface FxDef { id: FxId; label: string; hint: string; kinds: { id: string; label: string }[] }
/** In signal order; the UI lists them as they are. */
export const FX_DEFS: FxDef[] = [
  { id: 'speaker', label: 'Speaker', hint: 'The voice through a small speaker: telephone, old radio or megaphone. Amount: how much of the voice goes through it.',
    kinds: [{ id: 'telephone', label: 'Telephone' }, { id: 'radio', label: 'Old radio' }, { id: 'megaphone', label: 'Megaphone' }] },
  { id: 'grit', label: 'Grit', hint: 'Distortion on the voice: a rough edge for rock and metal.', kinds: [] },
  { id: 'mod', label: 'Swirl', hint: 'Chorus (a soft shimmer), flanger (a jet sweep) or phaser (a slow wash).',
    kinds: [{ id: 'chorus', label: 'Chorus' }, { id: 'flanger', label: 'Flanger' }, { id: 'phaser', label: 'Phaser' }] },
  { id: 'thicken', label: 'Thicken', hint: 'Two slightly late, slightly moving copies either side of the voice, as if doubled.', kinds: [] },
  { id: 'echo', label: 'Echo', hint: 'Slapback (one quick repeat, 50s rock), echo (on the beat, dotted 8th) or ping-pong (bounces left and right).',
    kinds: [{ id: 'slap', label: 'Slapback' }, { id: 'echo', label: 'Echo (on the beat)' }, { id: 'pingpong', label: 'Ping-pong' }] },
  { id: 'reverb', label: 'Reverb', hint: 'Space round the voice: plate (bright, studio), hall (big) or room (small).',
    kinds: [{ id: 'plate', label: 'Plate' }, { id: 'hall', label: 'Hall' }, { id: 'room', label: 'Room' }] },
];

const START: Record<FxId, { amount: number; kind: string }> = {
  speaker: { amount: 100, kind: 'telephone' }, grit: { amount: 35, kind: '' }, mod: { amount: 50, kind: 'chorus' },
  thicken: { amount: 55, kind: '' }, echo: { amount: 40, kind: 'slap' }, reverb: { amount: 45, kind: 'plate' },
};

export function defaultFxState(): VocalFxState {
  const fx = {} as Record<FxId, FxSetting>;
  for (const d of FX_DEFS) fx[d.id] = { on: false, ...START[d.id] };
  return { fx, backing: false };
}

/** A saved state, checked (a link or older settings may hold anything). */
export function cleanFxState(s: unknown): VocalFxState {
  const out = defaultFxState();
  const src = (s && typeof s === 'object' ? s : {}) as Partial<VocalFxState>;
  for (const d of FX_DEFS) {
    const v = src.fx?.[d.id];
    if (!v || typeof v !== 'object') continue;
    out.fx[d.id] = {
      on: !!v.on,
      amount: Math.max(0, Math.min(100, Number.isFinite(v.amount) ? v.amount : START[d.id].amount)),
      kind: d.kinds.some((k) => k.id === v.kind) ? v.kind : START[d.id].kind,
    };
  }
  out.backing = !!src.backing;
  return out;
}

export const fxAnyOn = (s: VocalFxState) => FX_DEFS.some((d) => s.fx[d.id].on);

/** A piece of the chain: where audio comes in and leaves, how to set it, and what to take down when it is dropped. */
interface Block {
  input: Tone.InputNode;
  output: Tone.ToneAudioNode;
  nodes: Tone.ToneAudioNode[];
  set(amount: number, bpm: number): void;
}

const norm = (a: number) => a / 100;
/** A send's level for an amount: gentle at the bottom, full voice-size at the top. */
const sendGain = (a: number) => 0.95 * norm(a) ** 1.5;

const biquad = (type: BiquadFilterType, frequency: number, Q = 0.7, gain = 0) => new Tone.BiquadFilter({ type, frequency, Q, gain });

/** The small speaker: the voice through a band (and a little drive), mixed with the plain voice. */
const SPEAKERS: Record<string, { lo: number; hi: number; res: number; resDb: number; Q: number; drive: number; boost: number }> = {
  telephone: { lo: 400, hi: 3200, res: 1500, resDb: 4, Q: 1, drive: 0.12, boost: 1.2 },
  radio: { lo: 300, hi: 4500, res: 1200, resDb: 3, Q: 1, drive: 0.2, boost: 1.0 },
  megaphone: { lo: 600, hi: 4000, res: 1800, resDb: 9, Q: 2, drive: 0.35, boost: 1.1 },
};

function speaker(kind: string): Block {
  const sp = SPEAKERS[kind] ?? SPEAKERS.telephone;
  const input = new Tone.Gain(1), output = new Tone.Gain(1), dry = new Tone.Gain(1), wet = new Tone.Gain(0);
  const hp1 = biquad('highpass', sp.lo), hp2 = biquad('highpass', sp.lo), lp1 = biquad('lowpass', sp.hi), lp2 = biquad('lowpass', sp.hi);
  const pk = biquad('peaking', sp.res, sp.Q, sp.resDb);
  const drive = new Tone.Distortion({ distortion: sp.drive, wet: 1 });
  input.connect(dry);
  dry.connect(output);
  input.chain(hp1, hp2, lp1, lp2, pk, drive, wet, output);
  return {
    input, output, nodes: [input, output, dry, wet, hp1, hp2, lp1, lp2, pk, drive],
    set(a) {
      // (equal power: the voice fades into the speaker)
      const x = norm(a) * Math.PI / 2;
      dry.gain.rampTo(Math.cos(x), 0.05);
      wet.gain.rampTo(Math.sin(x) * sp.boost, 0.05);
    },
  };
}

function grit(): Block {
  const input = new Tone.Gain(1), output = new Tone.Gain(0.6);
  const dist = new Tone.Distortion({ distortion: 0.3, wet: 1, oversample: '2x' });
  // (the fizz taken off, so it is rough, not harsh)
  const tame = biquad('lowpass', 5500);
  input.chain(dist, tame, output);
  return {
    input, output, nodes: [input, output, dist, tame],
    set(a) {
      const x = norm(a);
      dist.distortion = 0.12 + 0.7 * x;
      dist.wet.rampTo(Math.min(1, x * 1.5), 0.05);
      output.gain.rampTo(0.8 - 0.3 * x, 0.05);
    },
  };
}

function swirl(kind: string): Block {
  const node: Tone.Chorus | Tone.Phaser = kind === 'phaser'
    ? new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 400, Q: 8, wet: 0 })
    : kind === 'flanger'
      ? new Tone.Chorus({ frequency: 0.25, delayTime: 1.2, depth: 0.9, feedback: 0.55, spread: 90, wet: 0 }).start()
      : new Tone.Chorus({ frequency: 1.4, delayTime: 3.5, depth: 0.7, spread: 180, wet: 0 }).start();
  return { input: node, output: node, nodes: [node], set(a) { node.wet.rampTo(norm(a) * 0.85, 0.05); } };
}

function thicken(): Block {
  const input = new Tone.Gain(1), output = new Tone.Gain(1), wet = new Tone.Gain(0);
  const dL = new Tone.Delay(0.018), dR = new Tone.Delay(0.027);
  // (the delays drift a little, which is a slight pitch wobble: two takes, not a copy)
  const lfoL = new Tone.LFO({ frequency: 0.6, min: 0.016, max: 0.021 }).start();
  const lfoR = new Tone.LFO({ frequency: 0.43, min: 0.024, max: 0.03 }).start();
  lfoL.connect(dL.delayTime);
  lfoR.connect(dR.delayTime);
  const pL = new Tone.Panner(-0.8), pR = new Tone.Panner(0.8);
  input.connect(output);
  input.chain(dL, pL, wet);
  input.chain(dR, pR, wet);
  wet.connect(output);
  return { input, output, nodes: [input, output, wet, dL, dR, lfoL, lfoR, pL, pR], set(a) { wet.gain.rampTo(norm(a) * 0.9, 0.05); } };
}

function echo(kind: string): Block {
  const input = new Tone.Gain(0), output = new Tone.Gain(1);
  const dark = biquad('lowpass', kind === 'slap' ? 4500 : 3500);
  const delay = kind === 'pingpong'
    ? new Tone.PingPongDelay({ delayTime: 0.25, feedback: 0.35, wet: 1 })
    : new Tone.FeedbackDelay({ delayTime: kind === 'slap' ? 0.09 : 0.375, feedback: kind === 'slap' ? 0.12 : 0.36, wet: 1 });
  input.chain(delay, dark, output);
  return {
    input, output, nodes: [input, output, delay, dark],
    set(a, bpm) {
      input.gain.rampTo(sendGain(a), 0.05);
      // (kept on the beat: a dotted 8th; ping-pong an 8th, as it bounces between sides)
      if (kind === 'echo') (delay as Tone.FeedbackDelay).delayTime.rampTo((60 / bpm) * 0.75, 0.05);
      else if (kind === 'pingpong') (delay as Tone.PingPongDelay).delayTime.rampTo((60 / bpm) * 0.5, 0.05);
    },
  };
}

/** Reverb impulse responses: noise fading out, getting darker as it goes (a plate stays bright, a hall goes dark). */
const SPACES: Record<string, { decay: number; bright: number; dark: number }> = {
  plate: { decay: 1.3, bright: 0.9, dark: 0.5 },
  hall: { decay: 2.8, bright: 0.6, dark: 0.1 },
  room: { decay: 0.6, bright: 0.7, dark: 0.3 },
};
const irCache = new Map<string, AudioBuffer>();
function spaceIR(kind: string, rate: number): AudioBuffer {
  const key = `${kind}-${rate}`;
  let ir = irCache.get(key);
  if (!ir) {
    const sp = SPACES[kind] ?? SPACES.plate;
    const length = Math.round((sp.decay + 0.02) * rate);
    ir = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: rate });
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let y = 0;
      for (let i = 0; i < length; i++) {
        const t = i / rate, f = Math.min(1, t / sp.decay);
        y += ((Math.random() * 2 - 1) - y) * (sp.bright + (sp.dark - sp.bright) * f);
        d[i] = y * 10 ** ((-3 * t) / sp.decay) * Math.min(1, t / 0.004);
      }
    }
    irCache.set(key, ir);
  }
  return ir;
}

function reverb(kind: string): Block {
  const input = new Tone.Gain(0), output = new Tone.Gain(1);
  const conv = new Tone.Convolver({ normalize: true });
  conv.buffer = new Tone.ToneAudioBuffer(spaceIR(kind, conv.context.sampleRate));
  // (the low end of the space left out, so it doesn't muddy the voice)
  const clear = biquad('highpass', 250);
  input.chain(conv, clear, output);
  return { input, output, nodes: [input, output, conv, clear], set(a) { input.gain.rampTo(sendGain(a), 0.05); } };
}

const MAKE: Record<FxId, (kind: string) => Block> = {
  speaker, grit: () => grit(), mod: swirl, thicken: () => thicken(), echo, reverb,
};
const SENDS: FxId[] = ['echo', 'reverb'];

/**
 * One voice's effects. `input` is where the singer connects, `output` goes on to the mixer strip. With
 * everything off, input goes straight to output.
 */
export class VocalFx {
  readonly input: Tone.Gain;
  readonly output: Tone.Gain;
  private ctx = Tone.getContext();
  private mid: Tone.Gain;
  /** The blocks in the path now, by `id:kind`. */
  private live = new Map<string, Block>();
  private order = '';
  private bpm = 120;
  private want: [FxId, FxSetting][] = [];
  private token = 0;

  constructor() {
    this.input = new Tone.Gain(1);
    this.output = new Tone.Gain(1);
    this.mid = new Tone.Gain(1);
    this.input.connect(this.output);
  }

  /** Set the effects to this state (the ones that are on, with their amounts). */
  apply(fx: Record<FxId, FxSetting> | null, bpm = this.bpm) {
    this.bpm = bpm;
    this.want = fx ? FX_DEFS.map((d) => [d.id, fx[d.id]] as [FxId, FxSetting]).filter(([, s]) => s.on) : [];
    const order = this.want.map(([id, s]) => `${id}:${s.kind}`).join('|');
    if (order === this.order) { this.tune(); return; }
    const token = ++this.token;
    const go = () => {
      if (token !== this.token) return;
      this.rewire(order);
      if (!this.ctx.isOffline) this.output.gain.rampTo(1, 0.01);
    };
    // (live: the sound dips for a moment while the path changes, so there is no click)
    if (this.ctx.isOffline) go();
    else { this.output.gain.rampTo(0, 0.008); setTimeout(go, 14); }
  }

  setTempo(bpm: number) {
    this.bpm = bpm;
    this.tune();
  }

  private tune() {
    for (const [id, s] of this.want) this.live.get(`${id}:${s.kind}`)?.set(s.amount, this.bpm);
  }

  private rewire(order: string) {
    inContext(this.ctx, () => {
      this.input.disconnect();
      this.mid.disconnect();
      for (const b of this.live.values()) b.output.disconnect();
      // blocks no longer wanted are taken down; new ones built
      const keys = new Set(this.want.map(([id, s]) => `${id}:${s.kind}`));
      for (const [k, b] of this.live) if (!keys.has(k)) { b.nodes.forEach((n) => n.dispose()); this.live.delete(k); }
      for (const [id, s] of this.want) {
        const k = `${id}:${s.kind}`;
        if (!this.live.has(k)) this.live.set(k, MAKE[id](s.kind));
      }
      const blocks = this.want.map(([id, s]) => ({ id, b: this.live.get(`${id}:${s.kind}`)! }));
      this.tune();
      if (!blocks.length) this.input.connect(this.output);
      else {
        let prev: Tone.ToneAudioNode = this.input;
        for (const { id, b } of blocks) {
          if (SENDS.includes(id)) continue;
          prev.connect(b.input);
          prev = b.output;
        }
        prev.connect(this.mid);
        this.mid.connect(this.output);
        for (const { id, b } of blocks) if (SENDS.includes(id)) { this.mid.connect(b.input); b.output.connect(this.output); }
      }
    });
    this.order = order;
  }
}
