// Checks the riff writer (docs/RIFF-LAB.md): same seed, same riff; every riff of every style is playable (right bars,
// frets, lengths, velocities); the style asked for is the style written; the drums and bass can be written to it;
// the rules' pick is not worse than the raw first riff; and the riffs really differ from seed to seed. Prints a few
// numbers per style to read.
//   npm run riff-lab-check
import { buildIdea, planSong, withSheet } from '../src/generator';
import type { GenOptions, Seeds } from '../src/idea';
import type { RiffStyle } from '../src/genres';
import { generateRiffBass } from '../src/parts/bass';
import { generateHeavyDrums } from '../src/parts/heavyDrums';
import { FEEL_ORDER, type RiffFeel, STYLE_LABEL, WRITTEN_STYLES, type WrittenStyle, canWriteRiff, writeRiff } from '../src/parts/riffwriter';
import { Rng } from '../src/rng';

let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const GENRES = ['hardrock', 'metal', 'grunge', 'altmetal'] as const;

interface Tally { n: number; hits: number; pitches: number; palm: number; power: number; root: number; raw: number; best: number; keyN: number; prints: Set<string> }
const tally: Record<string, Tally> = {};
const tallyOf = (k: string) => (tally[k] ??= { n: 0, hits: 0, pitches: 0, palm: 0, power: 0, root: 0, raw: 0, best: 0, keyN: 0, prints: new Set() });
const autoStyles = new Set<string>();
let riffs = 0;

function jam(genre: (typeof GENRES)[number], s: string) {
  const opts: GenOptions = { genre, meter: '4/4', weirdness: 0, bpm: 110 };
  const seeds: Seeds = { song: s, chords: s, drums: s, strum: s, bass: s, guitar2: s };
  const song = planSong(new Rng(s), opts);
  return buildIdea(opts, seeds, song, withSheet(opts, seeds, song));
}

function check(tag: string, idea: ReturnType<typeof jam>, styles: [WrittenStyle, WrittenStyle] | undefined, follow: 'chords' | 'key') {
  const song = idea.song;
  const w = writeRiff(tag, song, idea.chords, { styles, follow });
  const again = writeRiff(tag, song, idea.chords, { styles, follow });
  if (!w || !again) { fail(`${tag}: no riff`); return; }
  riffs++;
  if (JSON.stringify(w) !== JSON.stringify(again)) fail(`${tag}: the same seed gave a different riff`);
  const [h0, h1] = w.info.halves;
  if (styles && (h0.style !== styles[0] || h1.style !== styles[1])) fail(`${tag}: asked for ${styles}, got ${h0.style}, ${h1.style}`);
  if (!styles) { autoStyles.add(h0.style); autoStyles.add(h1.style); }
  const { hits } = w.part;
  if (!hits.length) fail(`${tag}: no hits`);
  const t = song.tuning!;
  let prev = -1;
  for (const h of hits) {
    if (h.step < 0 || h.step >= song.total) fail(`${tag}: a hit at step ${h.step} is outside the 8 bars`);
    if (h.len < 1 || !Number.isInteger(h.len) || !Number.isInteger(h.step)) fail(`${tag}: step ${h.step} has a bad length ${h.len}`);
    if (h.step < prev) fail(`${tag}: hits out of order at ${h.step}`);
    prev = h.step;
    h.notes.forEach((m, i) => {
      const fret = m - t.strings[h.strings[i]];
      if (fret < 0 || fret > 14) fail(`${tag}: step ${h.step} note ${m} is at fret ${fret}`);
    });
    if (h.vel <= 0 || h.vel > 1) fail(`${tag}: step ${h.step} velocity ${h.vel}`);
  }
  // each half has hits of its own (not an empty four bars)
  for (let half = 0; half < 2; half++) if (!hits.some((h) => h.step >= half * 64 && h.step < half * 64 + 64)) fail(`${tag}: half ${half + 1} is silent`);
  // the drums and the bass can be written to it, in the styles it has
  try {
    song.sections = [...new Array<RiffStyle>(4).fill(h0.style), ...new Array<RiffStyle>(4).fill(h1.style)];
    const drums = generateHeavyDrums(new Rng(`${tag}-d`), song, w.part);
    const { bass } = generateRiffBass(song, idea.chords, drums, w.part);
    if (!bass.some(Boolean)) fail(`${tag}: the bass plays nothing`);
  } catch (e) { fail(`${tag}: drums or bass threw: ${(e as Error).message}`); }
  // the pick of many is not worse than the raw first one
  const raw = writeRiff(tag, song, idea.chords, { styles, follow, tries: 1 })!;
  if (w.info.score < raw.info.score && styles) fail(`${tag}: the best of 24 (${w.info.score}) is worse than the first (${raw.info.score})`);
  // numbers per style (the same-style riffs, so each style is read on its own)
  if (styles && styles[0] === styles[1]) {
    const k = tallyOf(styles[0]);
    k.n++;
    k.hits += (h0.perBar + h1.perBar) / 2;
    k.pitches += (h0.pitches.length + h1.pitches.length) / 2;
    k.palm += hits.filter((h) => h.mute === 'palm').length / hits.length;
    k.power += hits.filter((h) => h.notes.length > 1 && !h.mute).length / hits.length;
    k.root += hits.filter((h) => h.notes[0] % 12 === song.key % 12).length / hits.length;
    k.raw += raw.info.score; k.best += w.info.score;
    if (follow === 'key') { k.keyN++; k.prints.add(hits.map((h) => `${h.step}.${h.len}.${h.notes.join('+')}.${h.mute ?? ''}`).join('|')); }
  }
}

for (const genre of GENRES) {
  for (let n = 0; n < 30; n++) {
    const s = `check-${genre}-${n}`;
    const idea = jam(genre, s);
    if (!canWriteRiff(idea.song)) continue;
    // the genre's own mix
    check(`${s}-auto`, idea, undefined, n % 2 ? 'chords' : 'key');
    // every style on its own, then each paired with the next one
    WRITTEN_STYLES.forEach((st, i) => {
      check(`${s}-${st}`, idea, [st, st], n % 2 ? 'chords' : 'key');
      check(`${s}-${st}-key`, idea, [st, st], 'key');
      check(`${s}-${st}-pair`, idea, [st, WRITTEN_STYLES[(i + 1) % WRITTEN_STYLES.length]], 'chords');
    });
  }
}

// every feel can be asked for (the single-note riff)
{
  const idea = jam('metal', 'check-feels');
  for (const feel of FEEL_ORDER as RiffFeel[]) {
    const w = writeRiff('check-feels', idea.song, idea.chords, { feel, styles: ['single', 'single'] });
    if (!w || w.info.feel !== feel) fail(`feel ${feel}: not written`);
  }
}

// the genre's own mix reaches every style
for (const st of WRITTEN_STYLES) if (!autoStyles.has(st)) fail(`the genre mixes never write ${st}`);

console.log(`${riffs} riffs written`);
console.log('style                n   hits/bar  pitches  palm  power  root   score first → best of 24   different');
for (const st of WRITTEN_STYLES) {
  const k = tally[st];
  if (!k) { fail(`${st}: none written`); continue; }
  const keyOnes = k.prints.size;
  console.log(`${STYLE_LABEL[st].padEnd(18)} ${String(k.n).padStart(4)}   ${(k.hits / k.n).toFixed(1).padStart(6)}   ${(k.pitches / k.n).toFixed(1).padStart(6)}  ${(100 * k.palm / k.n).toFixed(0).padStart(3)}%  ${(100 * k.power / k.n).toFixed(0).padStart(4)}%  ${(100 * k.root / k.n).toFixed(0).padStart(3)}%   ${(k.raw / k.n).toFixed(1)} → ${(k.best / k.n).toFixed(1)}    ${keyOnes} of ${k.keyN}`);
  // the key-following riffs of a style, written to different songs, should (nearly) all differ
  if (keyOnes < k.keyN * 0.9) fail(`${st}: only ${keyOnes} different riffs in ${k.keyN}`);
}
console.log(bad ? `${bad} problems` : 'all good');
process.exit(bad ? 1 : 0);
