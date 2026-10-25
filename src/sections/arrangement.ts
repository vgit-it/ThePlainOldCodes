// Arrangement: intros, builds and band hits.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import type { Idea } from '../idea';
import { addFill } from '../parts/drums';
import { Rng } from '../rng';
import { groupStarts, zeros } from '../rhythm';
import { chordPc } from '../theory';
import { lowestOf, powerChord } from '../theory/fretboard';
import { DRUM_LANES } from './join';
import { barOf, putBar, emptyBar, crashAt, bassRoot, capAt } from './energy';

/* ------------------------------------------------------------ arrangement */

/** Write a drum fill into an (empty) bar: the drums coming in. */
export function fillBar(idea: Idea, bi: number, rng: Rng) {
  const { bars, w } = idea.song;
  const b = emptyBar(bars[bi].len);
  const len = addFill(rng, b, bars[bi].len, bars[bi].groups, w, idea.song.partGenres.drums);
  putBar(idea.drums, bars[bi], b);
  idea.drums.fills.push({ bar: bi, len, seam: true });
}

/** Eight-bar intro: the hook alone for four bars, the drums come in with a fill, the bass joins (now or two bars later). */
export function layerIntro(idea: Idea, rng: Rng): string {
  const { bars } = idea.song;
  const half = bars[3].start + bars[3].len;
  const bassFrom = rng.chance(0.4) && bars[6] ? bars[6].start : half;
  for (const l of DRUM_LANES) for (let g = 0; g < half; g++) idea.drums[l][g] = 0;
  idea.drums.fills = idea.drums.fills.filter((f) => f.bar > 3);
  fillBar(idea, 3, rng);
  for (let g = 0; g < bassFrom; g++) { idea.bass[g] = 0; if (idea.bassLen) idea.bassLen[g] = 0; }
  idea.guitar2 = idea.guitar2.filter((h) => h.step >= half);
  idea.section!.bandFrom = half;
  return bassFrom > half
    ? 'Layered: guitar alone, the drums come in with a fill at bar 5, the bass two bars later'
    : 'Layered: guitar alone, then drums (with a fill) and bass come in at bar 5';
}

/**
 * Sixteen-bar intro, built up a layer at a time: the guitar alone, the drums come in (with a fill),
 * then the bass, then Guitar 2 and the full band. The drums stay light (no crashes, closed hats)
 * until everyone's in, and fill into the last four bars.
 */
export function longIntro(idea: Idea, rng: Rng): string {
  const { bars, total } = idea.song;
  const at = (bi: number) => bars[bi]?.start ?? total;
  const drumsIn = at(4), bassIn = at(8), allIn = at(12);
  const d = idea.drums;
  for (const l of DRUM_LANES) for (let g = 0; g < drumsIn; g++) d[l][g] = 0;
  for (let g = drumsIn; g < allIn; g++) {
    d.crash[g] = 0;
    if (d.hatOpen[g]) { d.hat[g] = Math.max(d.hat[g], d.hatOpen[g] * 0.8); d.hatOpen[g] = 0; }
  }
  d.fills = d.fills.filter((f) => f.bar > 3);
  fillBar(idea, 3, rng);
  if (bars[11] && !d.fills.some((f) => f.bar === 11)) {
    const b = barOf(d, bars[11]);
    d.fills.push({ bar: 11, len: addFill(rng, b, bars[11].len, bars[11].groups, idea.song.w, idea.song.partGenres.drums), seam: true });
    putBar(d, bars[11], b);
  }
  crashAt(d, allIn);
  for (let g = 0; g < bassIn; g++) { idea.bass[g] = 0; if (idea.bassLen) idea.bassLen[g] = 0; }
  idea.guitar2 = idea.guitar2.filter((h) => h.step >= allIn);
  idea.section!.bandFrom = allIn;
  return 'Long build: guitar alone, the drums come in with a fill at bar 5, the bass at bar 9, everyone (Guitar 2 too) at bar 13';
}

/**
 * An outro jam builds: the half-time first part keeps its cymbals down (a crash only where it starts)
 * and fills into the full band, which crashes in.
 */
export function jamBuild(idea: Idea, firstBars: number, rng: Rng) {
  const { bars, total } = idea.song;
  const at = bars[firstBars]?.start ?? total;
  const d = idea.drums;
  for (let g = 1; g < at; g++) d.crash[g] = 0;
  const L = firstBars - 1;
  if (bars[L] && !d.fills.some((f) => f.bar === L)) {
    const b = barOf(d, bars[L]);
    d.fills.push({ bar: L, len: addFill(rng, b, bars[L].len, bars[L].groups, idea.song.w, idea.song.partGenres.drums), seam: true });
    putBar(d, bars[L], b);
  }
  crashAt(d, at);
}

/** The last bar builds: snare 8ths, then 16ths, getting louder; the band drives 8ths with it. */
export function snareBuild(idea: Idea) {
  const { bars, key } = idea.song;
  const L = bars.length - 1, bar = bars[L];
  const d = idea.drums;
  const st = groupStarts(bar.groups);
  const lastG = bar.len - bar.groups[bar.groups.length - 1];
  for (let j = 0; j < bar.len; j++) {
    const g = bar.start + j;
    d.hat[g] = 0; d.hatOpen[g] = 0; d.ride[g] = 0; d.tom[g] = 0; d.crash[g] = 0;
    d.kick[g] = st.includes(j) ? 0.9 : 0;
    d.snare[g] = j >= lastG || j % 2 === 0 ? 0.4 + 0.55 * (j / bar.len) : 0;
    if (!idea.guitar && j % 2 === 0) {
      idea.strum[g] = 'D';
      idea.bass[g] = bassRoot(key, idea.chords.timeline[idea.chords.chordIdx[g]].chord);
    } else if (!idea.guitar) { idea.strum[g] = '.'; idea.bass[g] = 0; }
  }
  d.fills = [...d.fills.filter((f) => f.bar !== L), { bar: L, len: bar.len, build: true }];
  idea.section!.tail = { build: bar.start };
}

export const HIT_PATTERNS = [[0, 3, 6], [0, 6, 10], [0, 4, 8, 10], [0, 3, 6, 8, 11], [0, 6, 8, 14]];

/** The last bar is a figure of band hits: everyone on the same accents, silence between. */
export function bandHits(idea: Idea, rng: Rng) {
  const { bars, key } = idea.song;
  const L = bars.length - 1, bar = bars[L];
  const a = bar.start, b = a + bar.len;
  const fits = HIT_PATTERNS.filter((p) => p[p.length - 1] < bar.len - 1);
  const hits = (fits.length ? rng.pick(fits) : [0, Math.floor(bar.len / 2)]).map((p) => a + p);
  idea.section!.tail = { hits };
  const chordAt = (g: number) => idea.chords.timeline[idea.chords.chordIdx[g]].chord;
  for (const l of DRUM_LANES) for (let g = a; g < b; g++) idea.drums[l][g] = 0;
  idea.drums.fills = idea.drums.fills.filter((f) => f.bar !== L);
  const lens = idea.bassLen ?? zeros(idea.song.total);
  for (let g = a; g < b; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; lens[g] = 0; }
  idea.guitar2 = idea.guitar2.filter((h) => h.step < a).map(capAt(a));
  if (idea.guitar) idea.guitar = idea.guitar.filter((h) => h.step < a).map(capAt(a));
  for (const g of hits) {
    idea.drums.kick[g] = 0.95;
    idea.drums.snare[g] = 0.9;
    const pc = chordPc(key, chordAt(g));
    if (idea.guitar && idea.song.tuning) {
      idea.guitar.push({ step: g, ...powerChord(pc, idea.song.tuning, true), len: 2, vel: 0.95 });
      const tonic = lowestOf(pc, idea.song.tuning);
      let shift = 0;
      while (tonic - shift > 40) shift += 12;
      idea.bass[g] = tonic - shift;
    } else {
      idea.strum[g] = 'D';
      // a muted scratch an 8th later chokes the chord: short, tight hits
      if (g + 2 < b && !hits.includes(g + 2)) idea.strum[g + 2] = 'x';
      idea.bass[g] = bassRoot(key, chordAt(g));
    }
    lens[g] = 2;
  }
  idea.bassLen = lens;
}

