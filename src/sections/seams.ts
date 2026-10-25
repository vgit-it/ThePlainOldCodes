// Seams: how one section hands over to the next.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import type { Idea } from '../idea';
import { Rng } from '../rng';
import { type Bar, groupStarts, zeros } from '../rhythm';
import { type Chord, type Mode, QUALITIES, SCALES, chordPc } from '../theory';
import { lowestOf, powerChord } from '../theory/fretboard';
import { DRUM_LANES, chordIdxFor } from './join';
import { crashAt, bassRoot, capAt } from './energy';
import { numeral, chordOn } from './harmony';

/* ------------------------------------------------------------ seams: how one section hands over to the next */

export const lastBarOf = (idea: Idea) => idea.song.bars[idea.song.bars.length - 1];

/** Where the second half of a bar starts (beat 3 in 4/4). */
export const halfOf = (bar: Bar) => bar.start + (groupStarts(bar.groups).find((p) => p >= bar.len / 2) ?? Math.floor(bar.len / 2));

/** A section's first chord, written relative to another section's key (the last chorus can be in a new key). */
export function firstChordIn(from: Idea, to: Idea): Chord {
  const c = from.chords.timeline[0].chord;
  return { ...c, root: (chordPc(from.song.key, c) - to.song.key + 12) % 12 };
}

/** Rewrite a section's chords from step `s` to its end. */
export function setChordFrom(idea: Idea, s: number, chord: Chord) {
  const timeline = [...idea.chords.timeline.filter((e) => e.step < s), { step: s, chord }];
  idea.chords = { ...idea.chords, timeline, chordIdx: chordIdxFor(timeline, idea.song.total) };
}

export const tonesOf = (key: number, c: Chord) => QUALITIES[c.q].map((i) => (key + c.root + i) % 12);
/** A note a half step from a chord tone (or a tritone from the root) rubs against the chord. */
export const rubs = (n: number, key: number, c: Chord) => {
  const pc = n % 12, tones = tonesOf(key, c);
  return !tones.includes(pc) && (tones.some((t) => (pc - t + 12) % 12 === 1 || (t - pc + 12) % 12 === 1) || (pc - tones[0] + 12) % 12 === 6);
};
/** The nearest chord tone to a note. */
export function nearestTone(n: number, key: number, c: Chord): number {
  const tones = tonesOf(key, c);
  for (let d = 1; d < 7; d++) for (const m of [n - d, n + d]) if (tones.includes(((m % 12) + 12) % 12)) return m;
  return n;
}

/** The next note of a scale above (dir 1) or below (dir -1) a note. */
export function scaleStep(n: number, dir: 1 | -1, key: number, mode: Mode): number {
  const pcs = SCALES[mode].map((p) => (p + key) % 12);
  let m = n + dir;
  while (!pcs.includes(((m % 12) + 12) % 12)) m += dir;
  return m;
}

/**
 * A turnaround: the second half of the last bar moves to a chord that leads into the next section
 * (V of its first chord, or IV or bVII of it), instead of sitting on the chord the next section
 * starts on, or stepping to it awkwardly. Into a key change it's always the new key's V.
 */
export function turnaround(a: Idea, b: Idea, rng: Rng, keyChange: boolean, pinned: boolean): string | null {
  if (a.guitar) return null; // riffs write their own moves
  // sections whose chords you set keep them (a key change still needs its V)
  if (!keyChange && pinned) return null;
  const { song } = a;
  const tl = a.chords.timeline, last = tl[tl.length - 1];
  const bar = lastBarOf(a);
  const target = firstChordIn(b, a);
  const iv = (target.root - last.chord.root + 12) % 12;
  // the last chord already held the whole bar, and the next section starts on it: nothing moves
  const stuck = iv === 0 && last.step <= bar.start;
  const awkward = iv === 1 || iv === 6 || iv === 11;
  if (!keyChange && !(stuck && rng.chance(0.7)) && !awkward) return null;
  const s = Math.max(halfOf(bar), last.step);
  if (s > song.total - 4) return null;
  const scale: readonly number[] = SCALES[song.mode];
  const leads: [number, number][] = keyChange ? [[(target.root + 7) % 12, 1]]
    : ([[(target.root + 7) % 12, 3], [(target.root + 5) % 12, 1], [(target.root + 10) % 12, 1]] as [number, number][])
      .filter(([r]) => scale.includes(r) && r !== last.chord.root);
  if (!leads.length) return null;
  const chord = chordOn(song, rng.weighted(leads), false, rng);
  const old = tl[a.chords.chordIdx[s]].chord;
  setChordFrom(a, s, chord);
  if (a.strum[s] !== 'D') a.strum[s] = 'D';
  // the bass moves with the chord (keeping its figure)
  let d = (chord.root - old.root + 12) % 12;
  if (d > 6) d -= 12;
  const playing = a.bass.slice(bar.start, song.total).some(Boolean);
  for (let g = s; g < song.total; g++) {
    if (!a.bass[g]) continue;
    let m = a.bass[g] + d;
    while (m > 52) m -= 12;
    while (m < 28) m += 12;
    a.bass[g] = m;
  }
  if (playing && !a.bass[s]) a.bass[s] = bassRoot(song.key, chord);
  // Guitar 2: notes that would rub against the new chord move to its nearest chord tone (or stop, if held into it)
  a.guitar2 = a.guitar2.map((h) => {
    if (h.step + h.len <= s || h.swell) return h;
    if (h.step < s) return h.notes.some((n) => rubs(n, song.key, chord)) ? capAt(s)(h) : h;
    return h.notes.some((n) => rubs(n, song.key, chord)) ? { ...h, notes: h.notes.map((n) => (rubs(n, song.key, chord) ? nearestTone(n, song.key, chord) : n)) } : h;
  });
  return `Turnaround: the last bar turns to ${numeral(chord)}, leading into the ${b.section!.label.toLowerCase()}`;
}

/**
 * The band pushes into the next section: its first chord comes an 8th early, on the "and" of the last
 * beat, with a crash, and rings over the bar line (the downbeat isn't struck again).
 * False when the next section has nothing on its downbeat to push.
 */
export function push(a: Idea, b: Idea): boolean {
  const total = a.song.total, s = total - 2;
  const bar = lastBarOf(a);
  if (s <= bar.start || !b.bass[0]) return false;
  if (a.guitar) {
    const first = b.guitar?.find((h) => h.step === 0 && !h.mute);
    if (!first) return false;
    b.guitar = b.guitar!.filter((h) => h !== first);
    a.guitar = a.guitar.filter((h) => h.step < s).map(capAt(s));
    a.guitar.push({ ...first, step: s, len: first.len + 2, vel: Math.max(first.vel, 0.9) });
  } else {
    if (b.strum[0] === '.' || b.strum[0] === 'x') return false;
    b.strum[0] = '.';
    for (let g = s; g < total; g++) a.strum[g] = '.';
    a.strum[s] = 'D';
  }
  setChordFrom(a, s, firstChordIn(b, a));
  // the bass pushes with the band, and rings into the next section
  const lens = a.bassLen ?? zeros(total);
  for (let g = s; g < total; g++) { a.bass[g] = 0; lens[g] = 0; }
  for (let g = s - 1; g >= bar.start; g--) {
    if (!a.bass[g]) continue;
    if (lens[g]) lens[g] = Math.min(lens[g], s - g);
    break;
  }
  a.bass[s] = b.bass[0];
  b.bass[0] = 0;
  if (b.bassLen) b.bassLen[0] = 0;
  let next = 1;
  while (next < 8 && !b.bass[next]) next++;
  lens[s] = 2 + next;
  a.bassLen = lens;
  // drums: kick and crash on the push, nothing on the downbeat after it
  for (const l of DRUM_LANES) for (let g = s; g < total; g++) a.drums[l][g] = 0;
  crashAt(a.drums, s);
  for (const l of ['kick', 'crash', 'hat', 'hatOpen', 'ride'] as const) b.drums[l][0] = 0;
  a.section!.tail = { push: s };
  b.section!.pushedIn = true;
  return true;
}

/**
 * The first bar of a half-time section entered from a full-time one: the band strikes the first chord
 * and lets it ring (drums: kick and crash, then a snare pickup into the new groove). Dropping straight
 * from a full groove into half-time felt like the song falling over.
 */
export function settleIn(idea: Idea) {
  const bar = idea.song.bars[0], end = bar.len;
  const d = idea.drums;
  for (const l of DRUM_LANES) for (let g = 1; g < end; g++) d[l][g] = 0;
  // (pushed in: the chord, kick and crash already came an 8th early, and ring on)
  const pushed = !!idea.section!.pushedIn;
  if (!pushed) {
    d.kick[0] = Math.max(d.kick[0], 0.9);
    crashAt(d, 0);
  }
  // the pickup: the last beat's 8ths on the snare, getting louder
  const beats = groupStarts(bar.groups);
  const last = beats[beats.length - 1];
  for (let g = last, v = 0.4; g < end; g += 2, v += 0.15) d.snare[g] = Math.min(0.8, v);
  d.fills = d.fills.filter((f) => f.bar !== 0);
  if (idea.guitar) {
    const first = idea.guitar.find((h) => h.step === 0);
    idea.guitar = idea.guitar.filter((h) => h.step >= end);
    if (first && !pushed) idea.guitar.unshift({ ...first, len: end, mute: undefined });
  } else {
    if (!pushed && (idea.strum[0] === '.' || idea.strum[0] === 'x')) idea.strum[0] = 'D';
    for (let g = 1; g < end; g++) idea.strum[g] = '.';
    // and the band comes back in on the next downbeat (a pattern starting later left a hole)
    if (idea.strum[end] === '.') idea.strum[end] = 'D';
  }
  // the bass holds its first note through the bar
  for (let g = 1; g < end; g++) idea.bass[g] = 0;
  if (idea.bassLen) { for (let g = 1; g < end; g++) idea.bassLen[g] = 0; if (idea.bass[0]) idea.bassLen[0] = end; }
}

/** Loud into quiet: the band strikes one chord halfway through the last bar and lets it ring into the next section. */
export function ringOut(a: Idea) {
  const { song } = a;
  const L = song.bars.length - 1, bar = song.bars[L];
  const h = halfOf(bar), total = song.total;
  const chord = a.chords.timeline[a.chords.chordIdx[h]].chord;
  const pc = chordPc(song.key, chord);
  for (const l of DRUM_LANES) for (let g = h; g < total; g++) a.drums[l][g] = 0;
  a.drums.fills = a.drums.fills.filter((f) => f.bar !== L);
  crashAt(a.drums, h);
  const lens = a.bassLen ?? zeros(total);
  for (let g = h; g < total; g++) { a.strum[g] = '.'; a.bass[g] = 0; lens[g] = 0; }
  if (a.guitar && song.tuning) {
    a.guitar = a.guitar.filter((x) => x.step < h).map(capAt(h));
    a.guitar.push({ step: h, ...powerChord(pc, song.tuning, true), len: total - h + 4, vel: 0.9 });
    let n = lowestOf(pc, song.tuning);
    while (n > 40) n -= 12;
    a.bass[h] = n;
  } else {
    a.strum[h] = 'D';
    a.bass[h] = bassRoot(song.key, chord);
  }
  for (let g = h - 1; g >= bar.start; g--) {
    if (!a.bass[g]) continue;
    if (lens[g]) lens[g] = Math.min(lens[g], h - g);
    break;
  }
  lens[h] = total - h + 4;
  a.bassLen = lens;
  a.section!.tail = { ring: h };
}

/**
 * The bass walks into the next section's first note over the last beat: up or down the scale, or
 * a chromatic approach from below, with the drum fill.
 */
export function walkUp(a: Idea, b: Idea, rng: Rng): boolean {
  if (a.guitar || !b.bass[0]) return false;
  const { song } = a;
  const bar = lastBarOf(a), total = song.total;
  const beat = bar.groups[bar.groups.length - 1];
  if (bar.len < 8 || beat < 4 || !a.bass.slice(bar.start, total - beat).some(Boolean)) return false;
  const t = b.bass[0];
  let how = rng.weighted<'up' | 'down' | 'chromatic'>(song.partGenres.bass === 'funk' ? [['chromatic', 3], ['up', 1]] : [['up', 3], ['chromatic', 2], ['down', 1]]);
  const three = how === 'up' && bar.len >= 12 && rng.chance(0.35);
  // no room below the target on the bass: come down onto it instead
  if (how !== 'down' && t - (three ? 5 : 3) < 28) how = 'down';
  let line: number[];
  if (how === 'chromatic') line = [t - 2, t - 1];
  else {
    const dir = how === 'up' ? -1 : 1; // walking up means starting below
    const n1 = scaleStep(t, dir, b.song.key, b.song.mode), n2 = scaleStep(n1, dir, b.song.key, b.song.mode);
    line = three && how === 'up' ? [scaleStep(n2, dir, b.song.key, b.song.mode), n2, n1] : [n2, n1];
  }
  const from = total - 2 * line.length;
  const lens = a.bassLen;
  for (let g = from; g < total; g++) { a.bass[g] = 0; if (lens) lens[g] = 0; }
  line.forEach((n, i) => {
    a.bass[from + 2 * i] = n;
    if (lens) lens[from + 2 * i] = 2;
  });
  if (lens) for (let g = from - 1; g >= bar.start; g--) {
    if (!a.bass[g]) continue;
    if (lens[g]) lens[g] = Math.min(lens[g], from - g);
    break;
  }
  return true;
}

/** Guitar 2 leads into its next phrase: a note or two before the bar line, stepping into its first note. */
export function g2Pickup(a: Idea, b: Idea, rng: Rng): boolean {
  const first = b.guitar2.find((h) => h.step === 0);
  if (!first || first.notes.length !== 1 || first.swell || first.mute) return false;
  const bar = lastBarOf(a), total = a.song.total;
  const beat = bar.groups[bar.groups.length - 1];
  if (bar.len < 8 || a.guitar2.some((h) => h.step + h.len > total - beat)) return false;
  const t = first.notes[0], { key, mode } = b.song;
  // up or down the scale into the note, two notes or one; only lines that sit with the chord under them
  const chordAt = (g: number) => a.chords.timeline[a.chords.chordIdx[g]].chord;
  const lines: [number[], number][] = [];
  for (const [dir, w] of [[-1, 3], [1, 2]] as const) {
    const n1 = scaleStep(t, dir, key, mode), n2 = scaleStep(n1, dir, key, mode);
    lines.push([[n2, n1], w], [[n1], w * 0.7]);
  }
  const fits = lines.filter(([l]) => l.every((n, i) => !rubs(n, a.song.key, chordAt(total - 2 * (l.length - i)))));
  if (!fits.length) return false;
  const line = rng.weighted(fits);
  line.forEach((n, i) => a.guitar2.push({
    step: total - 2 * (line.length - i), notes: [n], strings: first.strings, len: 2, vel: first.vel * 0.85, clean: first.clean,
  }));
  return true;
}

