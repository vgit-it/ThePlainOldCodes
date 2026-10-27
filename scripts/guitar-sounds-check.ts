// Checks the lead guitar's extra sounds (docs/GUITAR-SOUNDS.md): the made sounds (a chime and a drone at the
// right pitch, the chime dying away and the drone steady, the scrape falling), the library's new marks read back
// the same, the lick lab's "Try a sound" puts each one where it says, a placed note carries them to the guitar,
// and no live lick uses them yet (so the songs are as before).
//   npm run guitar-sounds-check
import { readFileSync } from 'node:fs';
import { CHIME_LEN, DRONE_LEN, FX_NOTES, SCRAPE_LEN, chime, drone, scrape } from '../src/audio/guitarfx';
import { type PlacedNote, placedHit } from '../src/parts/licks';
import { techniques } from '../src/recipes/facts';
import { type LickFile, parseNotes, writeNotes } from '../src/recipes/library';
import { TRY_SOUNDS, trySound } from '../src/lab/trySound';
import { TUNINGS } from '../src/theory/fretboard';

let bad = 0;
const fail = (m: string) => { bad++; console.log('FAIL ' + m); };
const sr = 44100;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

const rms = (x: Float32Array, a: number, b: number) => {
  let s = 0;
  const i0 = Math.floor(a * sr), i1 = Math.floor(b * sr);
  for (let i = i0; i < i1; i++) s += x[i] * x[i];
  return Math.sqrt(s / (i1 - i0));
};
/** Upward zero crossings a second, over a stretch: the pitch of a near-pure tone, or how busy a noise is. */
const crossings = (x: Float32Array, a: number, b: number) => {
  let n = 0;
  const i0 = Math.floor(a * sr), i1 = Math.floor(b * sr);
  for (let i = i0 + 1; i < i1; i++) if (x[i - 1] < 0 && x[i] >= 0) n++;
  return n / (b - a);
};
const sound = (name: string, x: Float32Array, len: number) => {
  if (x.length !== Math.round(len * sr)) fail(`${name}: ${x.length} samples, not ${len} s`);
  let peak = 0;
  for (const v of x) { if (!Number.isFinite(v)) { fail(`${name}: not a number in it`); return; } peak = Math.max(peak, Math.abs(v)); }
  if (Math.abs(peak - 1) > 1e-6) fail(`${name}: peak ${peak.toFixed(3)}, not 1`);
};

// the tones: at their pitch; a chime dies away, a drone holds
for (const m of FX_NOTES) {
  const c = chime(sr, m), d = drone(sr, m);
  sound(`chime ${m}`, c, CHIME_LEN);
  sound(`drone ${m}`, d, DRONE_LEN);
  for (const [name, x] of [['chime', c], ['drone', d]] as const) {
    const f = crossings(x, 0.5, 1.5);
    if (Math.abs(f / hz(m) - 1) > 0.01) fail(`${name} ${m}: ${f.toFixed(1)} Hz, not ${hz(m).toFixed(1)}`);
  }
  if (rms(c, 3, 3.5) > rms(c, 0.1, 0.6) / 4) fail(`chime ${m}: still ringing at full strength after 3 s`);
  const dr = 20 * Math.log10(rms(d, 6, 7) / rms(d, 1, 2));
  if (Math.abs(dr) > 2) fail(`drone ${m}: level moves ${dr.toFixed(1)} dB while held`);
}

// the scrape: falls (the ridges pass slower), fades in fast and out at the end
const s = scrape(sr);
sound('scrape', s, SCRAPE_LEN);
// the rasp's pitch: how often the level pulses (a ridge passing), from the smoothed loudness
const rasp = (a: number, b: number) => {
  const i0 = Math.floor(a * sr), n = Math.floor((b - a) * sr), e = new Float32Array(n);
  let lp = 0, mean = 0;
  for (let i = 0; i < n; i++) { lp += (Math.abs(s[i0 + i]) - lp) * 0.2; e[i] = lp; mean += lp / n; }
  let best = -Infinity, at = 0;
  for (let lag = Math.floor(sr / 2000); lag < Math.floor(sr / 70); lag++) {
    let c = 0;
    for (let i = 0; i + lag < n; i++) c += (e[i] - mean) * (e[i + lag] - mean);
    if (c > best) { best = c; at = lag; }
  }
  return sr / at;
};
const r0 = rasp(0.05, 0.2), r1 = rasp(0.7, 0.85);
if (r1 >= r0 * 0.7) fail(`scrape: doesn't fall (the rasp at ${r0.toFixed(0)} Hz, then ${r1.toFixed(0)} Hz)`);
if (rms(s, 0.02, 0.1) < rms(s, 0.3, 0.5) / 3) fail('scrape: too slow to start');
if (rms(s, SCRAPE_LEN - 0.03, SCRAPE_LEN) > rms(s, 0.3, 0.5) / 5) fail('scrape: ends abruptly');

// the library's marks read back the same, and the facts name them
const marked = parseNotes('0:0:4:ph,v 4:3:4:nh 8:5:8:dv12 16:7:8:fb12 24:0:8:sc4,b2 32:5:4:ph,dv24');
if (marked[0].harm !== 'pinch' || marked[1].harm !== 'natural' || marked[2].dive !== 12 || marked[3].feedback !== 12 || marked[4].scrape !== 4) fail('the new marks are read wrong');
const w = writeNotes(marked);
if (writeNotes(parseNotes(w)) !== w || JSON.stringify(parseNotes(w)) !== JSON.stringify(parseNotes(writeNotes(parseNotes(w))))) fail('the new marks do not read back the same');
const t = techniques(marked);
for (const want of ['pinch harmonic', 'natural harmonic', 'whammy dive', 'feedback', 'pick scrape']) if (!t.includes(want)) fail(`facts: "${want}" not named`);
for (const wrong of ['0:0:4:dv', '0:0:4:fbx', '0:0:4:pinch']) {
  try { parseNotes(wrong); fail(`"${wrong}" was let through`); } catch { /* as it should */ }
}

// "Try a sound": each puts the sound where it says, on a copy
const lick: PlacedNote[] = [
  { step: 0, midi: 64, len: 2, vel: 0.85, bend: 0, art: 'pick' },
  { step: 2, midi: 67, len: 6, vel: 0.85, bend: 2, unbend: 2 },
  { step: 8, midi: 69, len: 2, vel: 0.85, bend: 0, art: 'legato', trill: 2 },
  { step: 10, midi: 64, len: 6, vel: 0.85, bend: 0, dyad: 0 },
];
const before = JSON.stringify(lick);
for (const { id } of TRY_SOUNDS) {
  const out = trySound(lick, id);
  if (JSON.stringify(lick) !== before) fail(`try "${id}": changed the lick passed in`);
  if (out.length !== lick.length || out.some((n, i) => n.step !== lick[i].step || n.midi !== lick[i].midi || n.len !== lick[i].len)) fail(`try "${id}": moved notes`);
  const last = out[out.length - 1];
  const marks = out.filter((n) => n.harm || n.dive || n.feedback || n.scrape).length;
  if (id === '' && marks) fail('try "as written": added a sound');
  if (id === 'pinch' && (out[3].harm !== 'pinch' || marks !== 1)) fail('try pinch: not on the longest (the later of equals) note alone');
  if (id === 'natural' && out.some((n) => n.harm !== 'natural' || n.bend || n.unbend || n.trill || n.dyad !== undefined || n.art !== 'pick')) fail('try natural: a note still bent, trilled, doubled or not picked');
  if (id === 'dive' && (last.dive !== 12 || marks !== 1)) fail('try dive: not on the last note alone');
  if (id === 'pinchDive' && (last.dive !== 12 || last.harm !== 'pinch' || marks !== 1)) fail('try pinch + dive: not on the last note');
  if (id === 'feedback' && (last.feedback !== 12 || marks !== 1)) fail('try feedback: not on the last note alone');
  if (id === 'scrape' && (out[0].scrape !== 8 || marks !== 1)) fail('try scrape: not into the first note alone');
}

// a placed note carries the sounds to the guitar
const h = placedHit({ step: 0, midi: 67, len: 8, vel: 0.85, bend: 0, harm: 'pinch', dive: 12, feedback: 19, scrape: 4 }, TUNINGS.standard, 9);
if (h.harm !== 'pinch' || h.dive !== 12 || h.feedback !== 19 || h.scrape !== 4) fail('placedHit drops the sounds');

// no live lick uses them yet: the songs are as before
const file = JSON.parse(readFileSync('src/recipes/licks.json', 'utf8')) as LickFile;
for (const l of file.licks.filter((x) => x.status === 'live')) {
  if (parseNotes(l.notes).some((n) => n.harm || n.dive || n.feedback || n.scrape)) fail(`${l.id}: a live lick uses a new sound (put it behind a switch first)`);
}

console.log(bad ? `${bad} problem(s)` : 'guitar sounds: all good');
process.exit(bad ? 1 : 0);
