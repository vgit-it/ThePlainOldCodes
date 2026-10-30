// Slicing and joining: cut bars out of the building blocks and join them into one section.
// Moved out of track.ts as it was (clean-up phase 7); no logic changed.

import { type BuildOptions, buildIdea } from '../generator';
import { type RiffStyle } from '../genres';
import type { ChordEvent, ChordPart, DrumPart, GuitarHit, Idea, SectionInfo, Seeds, Song, Stroke } from '../idea';
import { type Bar, type Variant, zeros } from '../rhythm';

/* ------------------------------------------------------------ slicing and joining */

export const DRUM_LANES = ['kick', 'snare', 'hat', 'hatOpen', 'ride', 'crash', 'tom'] as const;

/** A run of bars from an idea. */
export interface Seg { idea: Idea; from: number; n: number }
export const seg = (idea: Idea, from = 0, n = idea.song.bars.length - from): Seg => ({ idea, from, n });

/** The first `k` bars of a list of segments. */
export function take(segs: Seg[], k: number): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    if (k <= 0) break;
    const n = Math.min(k, s.n);
    out.push({ ...s, n });
    k -= n;
  }
  return out;
}

export function chordIdxFor(timeline: ChordEvent[], total: number): number[] {
  const idx = zeros(total);
  for (let t = 0, g = 0; g < total; g++) {
    while (t + 1 < timeline.length && timeline[t + 1].step <= g) t++;
    idx[g] = t;
  }
  return idx;
}

/** Glue runs of bars into one section. */
export function join(segs: Seg[], info: SectionInfo): Idea {
  const first = segs[0].idea;
  const riff = !!first.guitar;
  const bars: Bar[] = [];
  const styles: RiffStyle[] = [];
  const plan: Variant[] = [];
  const timeline: ChordEvent[] = [];
  const strum: Stroke[] = [];
  const bass: number[] = [];
  const bassLen: number[] = [];
  const lanes = Object.fromEntries(DRUM_LANES.map((l) => [l, [] as number[]])) as Record<(typeof DRUM_LANES)[number], number[]>;
  const fills: DrumPart['fills'] = [];
  const guitar: GuitarHit[] = [];
  const guitar2: GuitarHit[] = [];
  let pos = 0;

  for (const { idea, from, n } of segs) {
    const src = idea.song.bars.slice(from, from + n);
    const a = src[0].start, last = src[src.length - 1], b = last.start + last.len;
    const off = pos - a, barOff = bars.length - from;
    src.forEach((bar, i) => {
      bars.push({ ...bar, start: bar.start + off });
      if (idea.song.sections) styles.push(idea.song.sections[from + i]);
      plan.push(idea.song.plan[from + i]);
    });
    // the chord already sounding when the run starts
    const { timeline: tl, chordIdx } = idea.chords;
    if (tl[chordIdx[a]].step !== a) timeline.push({ step: pos, chord: tl[chordIdx[a]].chord });
    for (const e of tl) if (e.step >= a && e.step < b) timeline.push({ step: e.step + off, chord: e.chord });
    strum.push(...idea.strum.slice(a, b));
    bass.push(...idea.bass.slice(a, b));
    bassLen.push(...(idea.bassLen?.slice(a, b) ?? zeros(b - a)));
    for (const l of DRUM_LANES) lanes[l].push(...idea.drums[l].slice(a, b));
    for (const f of idea.drums.fills) if (f.bar >= from && f.bar < from + src.length) fills.push({ bar: f.bar + barOff, len: f.len });
    for (const h of idea.guitar ?? []) if (h.step >= a && h.step < b) guitar.push({ ...h, step: h.step + off });
    for (const h of idea.guitar2) if (h.step >= a && h.step < b) guitar2.push({ ...h, step: h.step + off });
    pos += b - a;
  }

  const song: Song = { ...first.song, bars, total: pos, plan, sections: first.song.sections ? styles : undefined };
  return {
    seeds: first.seeds,
    opts: first.opts,
    song,
    chords: { timeline, chordIdx: chordIdxFor(timeline, pos), notes: [] },
    drums: { ...lanes, fills, halfTime: first.drums.halfTime, fourFloor: first.drums.fourFloor, groove: first.drums.groove },
    strum,
    bass,
    bassLen: riff || segs.some((s) => s.idea.bassLen) ? bassLen : undefined,
    bassLine: first.bassLine,
    guitar: riff ? guitar : undefined,
    guitar2,
    notes: [],
    section: info,
  };
}

/** An idea as written, before its rhythm player played it (generate() keeps the written parts). */
export function asWritten(idea: Idea): Idea {
  const w = idea.written;
  if (!w) return idea;
  return { ...idea, strum: [...w.strum], guitar: w.guitar?.map((h) => ({ ...h })), strumVel: undefined, strumColour: undefined,
    rhythmPick: undefined, shapes: undefined, rhythmEcho: undefined, rhythmTime: undefined, written: undefined };
}

/* ------------------------------------------------------------ blocks */

/** A new block of music: same song, new seeds for the listed parts. */
export function block(src: Idea, tag: string, reseed: (keyof Seeds)[], over: Partial<Song> = {}, chords?: BuildOptions['chords']): Idea {
  const seeds: Seeds = { ...src.seeds };
  for (const k of reseed) seeds[k] = `${src.seeds[k] ?? src.seeds.strum}-${tag}`;
  return buildIdea(src.opts, seeds, { ...src.song, ...over }, { chords });
}

export const chordSig = (i: Idea) => i.chords.timeline.map((e) => `${e.chord.root}${e.chord.q}`).join();


/** Breakdowns sit on the tonic: the riff's stabs do the moving. */
export const tonicOnly = (c: ChordPart): ChordPart => ({
  timeline: [{ step: 0, chord: { root: 0, q: '5' } }],
  chordIdx: zeros(c.chordIdx.length),
  notes: [],
});

export const fill8 = (s: RiffStyle): RiffStyle[] => new Array<RiffStyle>(8).fill(s);

