// The lead guitar's extra sounds (docs/GUITAR-SOUNDS.md), made here rather than sampled, like the finger
// squeaks: harmonics, feedback and a pick scrape. Each goes into the guitar's amp like a sampled note, so
// the drive turns a pure tone into a squeal and a soft scrape into a roar.
//
// - Chime: a string touched at a node and picked, ringing almost pure (natural harmonics), and the
//   overtone a pinch harmonic brings out over the picked note.
// - Drone: a steady tone that swells in as feedback takes the held note over.
// - Scrape: the pick's edge dragged down the wound strings, the ridges rasping past and slowing.
//
// The makers return plain sample arrays (the checks read them in Node); `fxSets` and `scrapeBuffer`
// wrap them for the audio engine, made once per sample rate.

import type { SampleSet } from './samples';

/** The notes the tones are made at (a pure tone moves up or down 6 semitones cleanly). */
export const FX_NOTES = [60, 72, 84, 96];
/** Lengths in seconds. A chime rings out; a drone outlasts a long held note (and is cut when it stops). */
export const CHIME_LEN = 4;
export const DRONE_LEN = 8;
export const SCRAPE_LEN = 1.2;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A fixed little random sequence (the same sounds every time the app loads). */
function rand(seed: number) {
  let s = 0x9e3779b9 ^ seed;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function normalize(x: Float32Array) {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  for (let i = 0; i < x.length; i++) x[i] /= peak || 1;
  return x;
}

/**
 * A harmonic: nearly a sine, a touch of the octave and twelfth above, a soft tick as the pick leaves
 * it, then a long ring (a harmonic rings longer than a fretted note: the finger is off the string).
 */
export function chime(sr: number, midi: number): Float32Array {
  const len = Math.round(CHIME_LEN * sr), f = hz(midi), rnd = rand(midi * 31);
  const x = new Float32Array(len);
  let tick = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = 2 * Math.PI * f * t;
    // the overtones die first, so it starts bright and ends pure
    const tone = Math.sin(w) + 0.14 * Math.exp(-t / 0.5) * Math.sin(2 * w) + 0.05 * Math.exp(-t / 0.3) * Math.sin(3 * w);
    tick += (rnd() * 2 - 1 - tick) * 0.5;
    const env = Math.min(1, t / 0.002) * Math.exp(-t / 1.3) * (t > CHIME_LEN - 0.05 ? (CHIME_LEN - t) / 0.05 : 1);
    x[i] = tone * env + tick * 0.3 * Math.exp(-t / 0.004);
  }
  return normalize(x);
}

/** Feedback's tone: steady, a little of the octave, a slow unevenness in level (the string and the speaker pushing each other). */
export function drone(sr: number, midi: number): Float32Array {
  const len = Math.round(DRONE_LEN * sr), f = hz(midi), rnd = rand(midi * 17 + 5);
  const x = new Float32Array(len);
  let wob = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const w = 2 * Math.PI * f * t;
    if (i % 64 === 0) wob += (rnd() - 0.5 - wob) * 0.02;
    const env = Math.min(1, t / 0.05) * (t > DRONE_LEN - 0.3 ? (DRONE_LEN - t) / 0.3 : 1);
    x[i] = (Math.sin(w) + 0.2 * Math.sin(2 * w)) * (1 + wob * 0.6) * env;
  }
  return normalize(x);
}

/**
 * The pick scrape: the pick's edge knocking over the windings, a click per ridge, so a buzz with a pitch,
 * slowing as it goes, so it falls: a long "zeeoow" down into a growl. Each ridge is caught a little harder
 * or softer and a little early or late (that roughness is the growl), with a little hiss on top. Fades in
 * fast, out at the end. (A first version was mostly hiss, high up: Paul found it weak.)
 */
export function scrape(sr: number): Float32Array {
  const len = Math.round(SCRAPE_LEN * sr), rnd = rand(4242);
  const x = new Float32Array(len);
  const f0 = 650, f1 = 170;
  let ph = 0, pulse = 0, lp = 0, lp2 = 0, hp = 0, prev = 0, grit = 1;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    // the ridges pass slower and slower
    const f = f0 * (f1 / f0) ** (t ** 0.7);
    ph += (f * (1 + (rnd() - 0.5) * 0.12)) / sr;
    // a ridge: a sharp knock that dies away in about a third of the gap to the next
    // (the slow low knocks come out much louder through a driven amp: they, and the hiss with them, go in softer)
    const soft = (f / f0) ** 0.45;
    if (ph >= 1) { ph -= 1; pulse = (0.55 + rnd() * 0.9) * soft; }
    pulse *= Math.exp(-f / (0.35 * sr));
    grit += (0.6 + rnd() * 0.8 - grit) * 0.02;
    let v = pulse + (rnd() * 2 - 1) * (0.12 * soft + 0.3 * pulse) * grit;
    const env = Math.min(1, t / 0.03) * (t > 0.8 ? Math.cos(((t - 0.8) / 0.2) * Math.PI / 2) ** 2 : 1);
    v *= env;
    // dark (the knocks' body, not their fizz: the amp adds that), and off the very bottom (no thump)
    lp += (v - lp) * 0.3;
    lp2 += (lp - lp2) * 0.3;
    hp = 0.993 * (hp + lp2 - prev);
    prev = lp2;
    x[i] = hp;
  }
  return normalize(x);
}

function buffer(sr: number, data: Float32Array): AudioBuffer {
  const b = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate: sr });
  b.getChannelData(0).set(data);
  return b;
}

function toneSet(sr: number, make: (sr: number, midi: number) => Float32Array): SampleSet {
  return { notes: FX_NOTES, buffers: FX_NOTES.map((m) => [[buffer(sr, make(sr, m))]]), noises: [], releases: [], tuning: new Map() };
}

const made = new Map<number, { chime: SampleSet; drone: SampleSet; scrape: AudioBuffer }>();

/** The tone sets (to play through a MultiSampler, with its bends, vibrato and dives) and the scrape, for a sample rate. */
export function fxSets(sr: number) {
  let s = made.get(sr);
  if (!s) made.set(sr, (s = { chime: toneSet(sr, chime), drone: toneSet(sr, drone), scrape: buffer(sr, scrape(sr)) }));
  return s;
}
