// Energy: how drums, strum and bass change from quiet to loud, plus endings and stops.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import type { DrumPart, GuitarHit, Idea, Song } from '../idea';
import { type DrumBar, addFill } from '../parts/drums';
import { chordTones } from '../parts/guitar2';
import { Rng } from '../rng';
import { type Bar, groupStarts, zeros } from '../rhythm';
import { type Chord, chordPc } from '../theory';
import { lowestOf, powerChord } from '../theory/fretboard';
import { DRUM_LANES, chordIdxFor } from './join';

/* ------------------------------------------------------------ drum helpers */

export const beatSet = (song: Song) => new Set(song.bars.flatMap((b) => groupStarts(b.groups).map((p) => b.start + p)));

export function barOf(d: DrumPart, bar: Bar): DrumBar {
  const s = (a: number[]) => a.slice(bar.start, bar.start + bar.len);
  return { K: s(d.kick), S: s(d.snare), H: s(d.hat), O: s(d.hatOpen), R: s(d.ride), T: s(d.tom) };
}

export function putBar(d: DrumPart, bar: Bar, b: DrumBar) {
  for (let j = 0; j < bar.len; j++) {
    const g = bar.start + j;
    d.kick[g] = b.K[j]; d.snare[g] = b.S[j]; d.hat[g] = b.H[j]; d.hatOpen[g] = b.O[j]; d.ride[g] = b.R[j]; d.tom[g] = b.T[j];
  }
}

export const emptyBar = (len: number): DrumBar => ({ K: zeros(len), S: zeros(len), H: zeros(len), O: zeros(len), R: zeros(len), T: zeros(len) });

export function crashAt(d: DrumPart, g: number) {
  d.crash[g] = 0.85;
  d.kick[g] = Math.max(d.kick[g], 0.9);
  d.hat[g] = 0; d.hatOpen[g] = 0; d.ride[g] = 0;
}

export function clearDrums(idea: Idea) {
  for (const l of DRUM_LANES) idea.drums[l].fill(0);
  idea.drums.fills = [];
}

/** A drum fill in the last bar (if it doesn't have one). */
export function ensureFill(idea: Idea, rng: Rng) {
  const { bars, w } = idea.song;
  const L = bars.length - 1;
  if (idea.drums.fills.some((f) => f.bar === L)) return;
  const b = barOf(idea.drums, bars[L]);
  const len = addFill(rng, b, bars[L].len, bars[L].groups, w, idea.song.partGenres.drums);
  putBar(idea.drums, bars[L], b);
  idea.drums.fills.push({ bar: L, len, seam: true });
}

/** Drums sit out, then come in with a fill at the end (intros). */
export function pickup(idea: Idea, rng: Rng) {
  clearDrums(idea);
  const { bars, w } = idea.song;
  const L = bars.length - 1;
  const b = emptyBar(bars[L].len);
  const len = addFill(rng, b, bars[L].len, bars[L].groups, w, idea.song.partGenres.drums);
  putBar(idea.drums, bars[L], b);
  idea.drums.fills.push({ bar: L, len, seam: true });
}

/* ------------------------------------------------------------ energy */

/**
 * Drums get lighter (2: closed 8th hats, no crashes; 3: closed hats, one crash)
 * or bigger (5: ride, crashes every 2 bars). 4 = as written.
 */
export function shapeDrums(idea: Idea, e: number, rng: Rng) {
  const d = idea.drums, { song } = idea, n = song.total;
  const beat = beatSet(song);
  const barStarts = new Set(song.bars.map((b) => b.start));
  if (e <= 1) {
    for (let g = 0; g < n; g++) {
      const cym = d.hat[g] || d.ride[g] || d.hatOpen[g] || d.crash[g];
      d.kick[g] = barStarts.has(g) ? 0.7 : 0;
      d.snare[g] = 0; d.tom[g] = 0; d.crash[g] = 0; d.hatOpen[g] = 0; d.ride[g] = 0;
      d.hat[g] = beat.has(g) && cym ? 0.4 : 0;
    }
    d.fills = [];
  } else if (e === 2) {
    for (let g = 0; g < n; g++) {
      const wash = d.hatOpen[g] || d.ride[g] || (g > 0 && d.crash[g]);
      if (wash && !d.hat[g]) d.hat[g] = beat.has(g) ? 0.55 : 0.42;
      d.hatOpen[g] = 0; d.ride[g] = 0;
      if (g > 0) d.crash[g] = 0;
      if (g % 2) {
        d.hat[g] = 0;
        if (!beat.has(g)) d.kick[g] = 0;
      }
      d.hat[g] *= 0.85;
      d.snare[g] *= 0.9;
    }
  } else if (e === 3) {
    // verses: closed hi-hat instead of ride, one crash at the top only
    for (let g = 0; g < n; g++) {
      if (d.ride[g] && !d.hat[g]) d.hat[g] = beat.has(g) ? 0.6 : 0.45;
      d.ride[g] = 0;
      if (g > 0 && d.crash[g]) { d.crash[g] = 0; d.hat[g] = 0.6; }
    }
  } else if (e >= 5) {
    const toRide = !song.sections && !d.ride.some(Boolean) && rng.chance(0.6);
    if (toRide) {
      for (let g = 0; g < n; g++) {
        if (d.hat[g] && g % 2 === 0) d.ride[g] = Math.min(0.8, d.hat[g] + 0.05);
        d.hat[g] = 0;
      }
    }
    song.bars.forEach((b, i) => { if (i % 2 === 0) crashAt(d, b.start); });
  }
}

/** The hi-hat or ride on the beats only (no 8ths or 16ths between); the crash and open hats stay. Returns whether anything changed. */
export function quarterTime(idea: Idea): boolean {
  const d = idea.drums, beat = beatSet(idea.song);
  let n = 0;
  for (let g = 0; g < idea.song.total; g++) {
    if (beat.has(g)) continue;
    if (d.hat[g] || d.ride[g]) n++;
    d.hat[g] = 0; d.ride[g] = 0;
  }
  return n > 0;
}

export const bassRoot = (key: number, c: Chord) => {
  let m = 36 + chordPc(key, c);
  if (m > 43) m -= 12;
  return m;
};

/** Where a held chord is struck: on each change, and again at the top of every second bar it carries on for. */
export function restrikes(song: Song, changes: Set<number>): Set<number> {
  const out = new Set(changes);
  let held = 0;
  song.bars.forEach((b) => {
    held = changes.has(b.start) ? 0 : held + 1;
    if (held && held % 2 === 0) out.add(b.start);
  });
  return out;
}

/** Strummed parts: held chords (1), palm mutes (2), as written (3–4), every beat struck (5). */
export function shapeStrum(idea: Idea, e: number) {
  if (e === 3 || e === 4) return;
  const { strum, song, chords } = idea;
  const genre = song.partGenres.strum;
  const beat = beatSet(song);
  const changes = new Set(chords.timeline.map((t) => t.step));
  const again = restrikes(song, changes);
  for (let g = 0; g < song.total; g++) {
    const s = strum[g];
    if (e <= 1) strum[g] = again.has(g) ? 'D' : '.';
    else if (e === 2 && genre !== 'funk') {
      if (s === 'U' || (genre === 'pop' && s === 'x')) strum[g] = '.';
      else if (genre !== 'pop' && s === 'D' && !beat.has(g) && !changes.has(g)) strum[g] = 'p';
    // the biggest sections: palm mutes open up and every beat is struck, but the pattern's gaps stay
    } else if (e >= 5 && genre !== 'funk' && (s === 'p' || (s === '.' && beat.has(g)))) strum[g] = 'D';
  }
  // every chord change is heard
  for (const c of changes) if (c < song.total && strum[c] !== 'D') strum[c] = 'D';
}

/** Bass: long roots (1), roots on the beat (2), as written (3–4), driving 8ths (5). */
export function shapeBass(idea: Idea, e: number) {
  if (e === 3 || e === 4) return;
  const { bass, song, chords } = idea;
  // a flowing line already moves: the biggest sections keep it (funk keeps its groove)
  if (e >= 5 && (song.partGenres.bass === 'funk' || idea.bassLine === 'flowing')) return;
  // long roots and driving 8ths are played legato
  idea.bassLen?.fill(0);
  const beat = beatSet(song);
  const changes = new Set(chords.timeline.map((t) => t.step));
  const again = restrikes(song, changes);
  for (let g = 0; g < song.total; g++) {
    const r = bassRoot(song.key, chords.timeline[chords.chordIdx[g]].chord);
    if (e <= 2) bass[g] = changes.has(g) || (e === 2 ? beat.has(g) : again.has(g)) ? r : 0;
    else if (g % 2 === 0 && !bass[g]) bass[g] = r;
  }
}

/** Cap notes so nothing rings past step `s`. */
// (a note the solo expression pass made shorter than a step on purpose, a 32nd, stays short)
export const capAt = (s: number) => (h: GuitarHit): GuitarHit => (h.quick && h.len < 1 ? h : { ...h, len: Math.max(1, Math.min(h.len, s - h.step)) });

/**
 * A planned solo's last note carries on (docs/SOLO-PLAN.md, round 2): it rings through the rest of the section and the next
 * section's first bar, and bends, finishing on the bar line, to the nearest note of the next section's first chord (up to three semitones:
 * pushed up from below, or picked bent and let down). Transitions (a band stop, band hits, a snare build) have cut the
 * section's end by now; the note is the solo's final landing, else the last note left.
 * With `dials` (Solo bends, docs/SOLO-BENDS.md) the move is slow and shaped: the bigger the step, the slower, arriving on the bar line.
 */
export function carrySolo(idea: Idea, next: Idea | undefined, dials = false) {
  const lands = idea.soloCurve?.landings;
  if (!next || !lands || !idea.guitar2.length) return;
  const total = idea.song.total;
  const fin = [...lands].reverse().find((l) => l.role !== 'waypoint');
  const sorted = [...idea.guitar2].sort((a, b) => a.step + (a.shift ?? 0) - b.step - (b.shift ?? 0));
  const h = sorted.find((x) => fin && x.step === fin.step && !x.mute && x.notes.length) ?? [...sorted].reverse().find((x) => !x.mute && x.notes.length);
  if (!h) return;
  // (pickup notes into the next section would run into it: the carried note wins)
  idea.guitar2 = idea.guitar2.filter((x) => x === h || x.step + (x.shift ?? 0) < h.step + (h.shift ?? 0));
  // (a note that sounds a little after its step, a 32nd late, ends where the others do all the same)
  h.len = total - h.step - (h.shift ?? 0) + next.song.bars[0].len;
  // (a double-stop, a trill, a tremolo or a rake just rings on)
  if (h.notes.length !== 1 || h.trill || h.tremolo || h.rake) return;
  const tones = chordTones(next.song.key, next.chords.timeline[0].chord);
  const cur = h.notes[0] - (h.unbend ?? 0);
  const d = [0, 1, -1, 2, -2, 3, -3].find((x) => tones.includes((((cur + x) % 12) + 12) % 12));
  if (!d) return;
  // (the move ends on the bar line, so it is heard in the solo's own level as the chord arrives: from the bar line on, the next section's
  // level is under it, and the note has already died away some)
  const six = 15 / idea.song.bpm;
  // (dials: a push crawls up over 0.3 to 0.6 s, a let-down takes about 0.25 s; never more than 70% of the way from the note to the bar line)
  const rise = dials ? Math.min(d > 0 ? 0.2 + 0.13 * d : 0.18 + 0.04 * -d, 0.7 * (total - h.step) * six) : d > 0 ? 0.14 + d * 0.04 : 0.12;
  const at = Math.max(0.5, total - h.step - rise / six - 0.25);
  h.bend = 0;
  // (a slide in and a bend don't go together: the carried bend wins)
  delete h.slide;
  if (d > 0) { h.notes = [cur + d]; h.unbend = undefined; h.lateBend = d; h.bendAt = at; }
  else { h.notes = [cur]; h.lateBend = undefined; h.unbend = -d; h.bendAt = at; }
  if (dials) { h.bendRise = Math.round(rise * 1000); h.bendEase = d > 0 ? 1.5 : 1; }
}

/** Everyone stops for the last beat or two of the section, then the next section hits. */
export function bandStop(idea: Idea, beats: number) {
  const { bars } = idea.song;
  const L = bars.length - 1, bar = bars[L];
  const end = bar.start + bar.len;
  const s0 = end - bar.groups.slice(-beats).reduce((a, b) => a + b, 0);
  for (const l of DRUM_LANES) for (let g = s0; g < end; g++) idea.drums[l][g] = 0;
  idea.drums.fills = idea.drums.fills.filter((f) => f.bar !== L);
  for (let g = s0; g < end; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; }
  // a muted scratch chokes the strummed chord
  if (!idea.guitar) idea.strum[s0] = 'x';
  if (idea.guitar) idea.guitar = idea.guitar.filter((h) => h.step < s0).map(capAt(s0));
  idea.guitar2 = idea.guitar2.filter((h) => h.step < s0).map(capAt(s0));
  idea.section!.tail = { stop: s0 };
  // the last bass note stops too
  const lens = idea.bassLen ?? zeros(idea.song.total);
  for (let g = s0 - 1; g >= bar.start; g--) {
    if (!idea.bass[g]) continue;
    lens[g] = Math.min(lens[g] || s0 - g, s0 - g);
    break;
  }
  if (!idea.guitar) idea.bassLen = lens.some(Boolean) ? lens : undefined;
  else idea.bassLen = lens;
}

/** The last bar becomes one held chord on the home chord, with a crash. */
export function makeEnding(idea: Idea, home: Chord) {
  const { song } = idea;
  const L = song.bars.length - 1, bar = song.bars[L];
  const a = bar.start, b = a + bar.len;
  for (const l of DRUM_LANES) for (let g = a; g < b; g++) idea.drums[l][g] = 0;
  idea.drums.fills = idea.drums.fills.filter((f) => f.bar !== L);
  idea.drums.crash[a] = 0.95;
  idea.drums.kick[a] = 0.95;
  const lens = idea.bassLen ?? zeros(song.total);
  for (let g = a; g < b; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; lens[g] = 0; }
  idea.guitar2 = idea.guitar2.filter((h) => h.step < a).map(capAt(a));
  const timeline = [...idea.chords.timeline.filter((e) => e.step < a), { step: a, chord: home }];
  idea.chords = { ...idea.chords, timeline, chordIdx: chordIdxFor(timeline, song.total) };
  if (idea.guitar && song.tuning) {
    const t = song.tuning;
    idea.guitar = idea.guitar.filter((h) => h.step < a).map(capAt(a));
    idea.guitar.push({ step: a, ...powerChord(song.key, t, true), len: bar.len, vel: 0.95 });
    // same octave as the riff bass
    const tonic = lowestOf(song.key, t);
    let shift = 0;
    while (tonic - shift > 36) shift += 12;
    idea.bass[a] = tonic - shift;
  } else {
    idea.strum[a] = 'D';
    idea.bass[a] = bassRoot(song.key, home);
  }
  lens[a] = bar.len;
  idea.bassLen = lens;
  idea.section = { ...idea.section!, ending: true };
}

