// Solo backing (docs/SOLO-BACKING.md): under a solo the chords are held long, the way hard rock, metal and grunge
// leave a bar of chord for the lead to sing over. The section's chords are merged into spans of two or four bars,
// and the band plays the held chord: the rhythm guitar rings one strike (power chord in riff songs), the bass holds the root.
// Only the section's chords and the rhythm part change; the drums and the solo writers are untouched (they read the chords as they are).

import type { ChordEvent, Idea } from '../idea';
import type { Rng } from '../rng';
import { chordPc } from '../theory';
import type { Chord } from '../theory';
import { lowestOf, powerChord } from '../theory/fretboard';
import { bassRoot, restrikes } from './energy';

/** One chord for each span of bars: the chord that sounds longest in it (the first, if equal). */
function merge(idea: Idea, span: number): ChordEvent[] {
  const { song, chords } = idea;
  const tl = chords.timeline;
  const out: ChordEvent[] = [];
  for (let b0 = 0; b0 < song.bars.length; b0 += span) {
    const a = song.bars[b0].start;
    const e = song.bars[Math.min(song.bars.length, b0 + span) - 1];
    const z = e.start + e.len;
    // how long each chord sounds inside this span
    const dur = new Map<number, number>();
    tl.forEach((ev, i) => {
      const from = Math.max(a, ev.step), to = Math.min(z, tl[i + 1]?.step ?? song.total);
      if (to > from) dur.set(i, (dur.get(i) ?? 0) + to - from);
    });
    let best = -1, most = 0;
    for (const [i, d] of dur) if (d > most) { best = i; most = d; }
    // (the first span keeps the section's own first chord: the bar before it was written to lead into that)
    const chord: Chord = b0 === 0 ? tl[0].chord : tl[best >= 0 ? best : chords.chordIdx[a]].chord;
    const prev = out[out.length - 1];
    // (the same chord twice in a row is one longer hold)
    if (prev && prev.chord.q === chord.q && chordPc(song.key, prev.chord) === chordPc(song.key, chord)) continue;
    out.push({ step: a, chord });
  }
  return out;
}

/**
 * Hold the section's chords long and have the band play them held. Returns the note for the section card.
 * `span` is 4 bars, or 2 (a four-bar span asks for at least eight bars).
 */
export function heldBacking(idea: Idea, rng: Rng): string {
  const { song } = idea;
  const nb = song.bars.length;
  const span = nb >= 8 && rng.chance(0.65) ? 4 : 2;
  const timeline = merge(idea, span);
  const chordIdx = new Array<number>(song.total).fill(0);
  timeline.forEach((ev, i) => { for (let g = ev.step; g < (timeline[i + 1]?.step ?? song.total); g++) chordIdx[g] = i; });
  idea.chords = { ...idea.chords, timeline, chordIdx };

  // where the chord is struck: on each change, and again every second bar it carries on for
  const strikes = [...restrikes(song, new Set(timeline.map((t) => t.step)))].sort((a, b) => a - b);
  const lens = idea.bassLen ?? new Array<number>(song.total).fill(0);
  for (let g = 0; g < song.total; g++) { idea.strum[g] = '.'; idea.bass[g] = 0; lens[g] = 0; }
  idea.bassLen = lens;
  const riff = !!(idea.guitar && song.tuning);
  if (riff) idea.guitar = [];
  strikes.forEach((g, k) => {
    const chord = timeline[chordIdx[g]].chord;
    const change = timeline.some((t) => t.step === g);
    if (riff && song.tuning) {
      // a power chord rung until the next strike (and a little over: it rings into it)
      idea.guitar!.push({ step: g, ...powerChord(chordPc(song.key, chord), song.tuning, true), len: (strikes[k + 1] ?? song.total) - g + 2, vel: change ? 0.9 : 0.8 });
      let n = lowestOf(chordPc(song.key, chord), song.tuning);
      while (n > 40) n -= 12;
      idea.bass[g] = n;
    } else {
      idea.strum[g] = 'D';
      idea.bass[g] = bassRoot(song.key, chord);
    }
  });
  // the plan, for the players to read (the rhythm guitar's hands, the drummer): which bars carry one chord, where it is struck
  idea.section!.soloBack = { span, strikes };
  return `Solo backing: held chords (${timeline.length} in ${nb} bars, up to ${span} bars each); the rhythm guitar rings them, the bass holds the roots`;
}
