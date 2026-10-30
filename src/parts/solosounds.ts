// The lead's extra sounds in a solo (docs/SOLO-SOUNDS.md, the sounds: docs/GUITAR-SOUNDS.md), behind the "Lead
// guitar sounds" switch: a pass over the finished solo (any solo writer) that marks notes where a guitarist would
// reach for each sound. Pinch harmonics on the top note, on a note a jump or a run lands on, on a long bend, on a
// loud downbeat; whammy dives at the end, after a pinch, at a phrase end, small dips on long notes; feedback on the
// last note or a very long one; natural harmonics on calm notes an open string gives; a pick scrape into the solo or
// a new phrase. How likely each one is: the genre's lean (docs/SOLO-CORE.md), the player, how hard the solo goes,
// the section's energy, the amp and the tempo. Notes keep their pitch and time.

import type { Genre } from '../genres';
import type { GuitarHit } from '../idea';
import type { LickKind } from '../players/lead';
import type { Rng } from '../rng';

export type LeadSound = 'pinch' | 'natural' | 'dive' | 'feedback' | 'scrape';
/** The lead's amp: crunch or distortion, clean, an acoustic guitar, or not a guitar at all (a piano lead). */
export type LeadAmp = 'driven' | 'clean' | 'acoustic' | 'none';

/** How much each genre leans on each sound: 3 leans in, 2 normal, 1 rare (docs/SOLO-CORE.md; feedback was added here, grunge leaning in). */
export const SOUND_LEAN: Record<Genre, Record<LeadSound, number>> = {
  rock: { pinch: 2, natural: 1, dive: 1, feedback: 2, scrape: 1 },
  pop: { pinch: 1, natural: 2, dive: 1, feedback: 1, scrape: 1 },
  funk: { pinch: 1, natural: 1, dive: 1, feedback: 1, scrape: 1 },
  hardrock: { pinch: 3, natural: 1, dive: 2, feedback: 2, scrape: 2 },
  metal: { pinch: 3, natural: 2, dive: 3, feedback: 2, scrape: 3 },
  grunge: { pinch: 2, natural: 2, dive: 2, feedback: 3, scrape: 2 },
  altmetal: { pinch: 3, natural: 2, dive: 2, feedback: 2, scrape: 2 },
};

/** A lean to a chance (for a full-strength solo). */
const CHANCE: Record<number, number> = { 1: 0.15, 2: 0.4, 3: 0.7 };

/** The player's own taste: the shredder squeals and dives more, the melodic player chimes more and squeals less, the funky one keeps it clean. */
const PLAYER: Record<LickKind, Partial<Record<LeadSound, number>>> = {
  run: { pinch: 1.25, dive: 1.25 },
  sung: { natural: 1.3, pinch: 0.8, dive: 0.8 },
  blues: { feedback: 1.2 },
  simple: { feedback: 1.2, scrape: 1.2 },
  muted: { pinch: 0.6, natural: 0.6, dive: 0.6, feedback: 0.6, scrape: 0.6 },
};

/** The amp: a pinch, feedback and a scrape need the drive; a clean or acoustic guitar chimes instead (and a clean one can still dip the bar). */
const AMP: Record<LeadAmp, Record<LeadSound, number>> = {
  driven: { pinch: 1, natural: 0.8, dive: 1, feedback: 1, scrape: 1 },
  clean: { pinch: 0, natural: 1.6, dive: 0.5, feedback: 0, scrape: 0 },
  acoustic: { pinch: 0, natural: 1.3, dive: 0, feedback: 0, scrape: 0 },
  none: { pinch: 0, natural: 0, dive: 0, feedback: 0, scrape: 0 },
};

/** The tempo: a slow song has room for chimes and feedback, a fast one squeals out of its runs. */
const tempoLean = (bpm: number): Partial<Record<LeadSound, number>> =>
  bpm < 90 ? { natural: 1.25, feedback: 1.25, pinch: 0.9 } : bpm >= 140 ? { natural: 0.85, feedback: 0.85, pinch: 1.15 } : {};

/** At most this many of each in one solo (so it never turns into a gimmick). */
export const MOST: Record<LeadSound, number> = { pinch: 3, natural: 2, dive: 3, feedback: 2, scrape: 2 };

/** The notes a natural harmonic can sound in standard tuning: an open string up an octave (12th fret), an octave and a
 *  fifth (7th), two octaves (5th), two octaves and a major third (4th and 9th). */
const OPEN = [40, 45, 50, 55, 59, 64];
export const HARMONIC_NOTES = new Set(OPEN.flatMap((m) => [m + 12, m + 19, m + 24, m + 28]));

/** The heavy genres: an octave or two on the bar, and a dive straight after a pinch. */
const HEAVY: Genre[] = ['metal', 'altmetal', 'hardrock'];
/** A whammy dive starts on a note no higher than this (C5), or this when the note is pinched (E4: the squeal sits 19 above),
 *  and a big drop lands no lower than the low E. Real dives come from the middle of the neck and fall into a low flutter. */
export const DIVE_TOP = 72;
export const DIVE_TOP_PINCH = 64;
export const DIVE_FLOOR = 40;
/** The genres that dip the bar a half or whole step at the end of a long note. */
const DIPS: Genre[] = ['rock', 'grunge', 'hardrock', 'altmetal'];

export interface SoundsCtx {
  genre: Genre;
  lick: LickKind;
  /** How hard the solo goes, 0 to 1 (a lead break about 0.3). */
  intensity: number;
  /** A full solo gets a pick scrape into it; a lead break doesn't. */
  solo: boolean;
  /** The section's energy, 1 (quiet) to 5 (everything). */
  energy: number;
  amp: LeadAmp;
  bpm: number;
  /** Where each bar starts (16ths). */
  barStarts: number[];
  /** The chord's notes (pitch classes) at a 16th. */
  tonesAt: (step: number) => number[];
  /** How strong the solo means to be at each 16th, -1 to 1 (the writer's curve, when it has one). */
  curve?: number[];
  /** The band comes in quieter after the solo, or the song ends. */
  dropAfter: boolean;
  /** The song ends on the solo. */
  songEnd: boolean;
  /** The band built up into the solo (the section before is quieter). */
  liftIn: boolean;
  /** Semitones the section moves up afterwards (a key change for the last chorus): a natural harmonic is chosen where it will sound. */
  keyUp?: number;
}

/** A held note (a quarter or longer) on one string or a double-stop, played as a plain sustained note. */
const held = (h: GuitarHit) => !h.mute && h.len >= 4 && !h.trill && !h.tremolo && h.notes.length <= 2;

/** The solo with its sounds put on (new hits; the ones passed in are left alone), and what was done. */
export function addLeadSounds(rng: Rng, hits: GuitarHit[], c: SoundsCtx): { hits: GuitarHit[]; done: LeadSound[] } {
  const out = hits.map((h) => ({ ...h }));
  const done: LeadSound[] = [];
  if (!out.length) return { hits: out, done };
  const order = out.map((_, i) => i).sort((a, b) => out[a].step - out[b].step);
  const seq = order.map((i) => out[i]);
  const lean = SOUND_LEAN[c.genre];
  const tempo = tempoLean(c.bpm);
  const e = Math.max(-2, Math.min(2, c.energy - 3));
  const push = Math.max(0, Math.min(1, c.intensity));
  // (the loud sounds grow with how hard the solo goes and the section's energy; a chime suits a quieter one)
  const strength: Record<LeadSound, number> = {
    pinch: (0.5 + 0.5 * push) * (1 + 0.15 * e),
    dive: (0.5 + 0.5 * push) * (1 + 0.15 * e),
    scrape: (0.5 + 0.5 * push) * (1 + 0.15 * e),
    feedback: 0.5 + 0.5 * push,
    natural: 1 - 0.1 * e,
  };
  const chance = (s: LeadSound) => Math.min(0.9, CHANCE[lean[s]] * (PLAYER[c.lick][s] ?? 1) * AMP[c.amp][s] * (tempo[s] ?? 1) * strength[s]);
  const count = (s: LeadSound) => done.filter((d) => d === s).length;
  const room = (s: LeadSound) => count(s) < MOST[s];
  const top = (h: GuitarHit) => h.notes[h.notes.length - 1];
  const single = (h: GuitarHit) => held(h) && h.notes.length === 1;
  const secs = (h: GuitarHit) => (h.len * 15) / c.bpm;
  const first = seq[0], last = seq[seq.length - 1];
  const span = Math.max(1, last.step + last.len - first.step);
  const rest = (k: number) => (k + 1 < seq.length ? seq[k + 1].step - (seq[k].step + seq[k].len) : Infinity);
  const restBefore = (k: number) => (k > 0 ? seq[k].step - (seq[k - 1].step + seq[k - 1].len) : Infinity);
  const loud = (h: GuitarHit) => (c.curve?.length ? (c.curve[h.step] ?? 0) >= 0.6 : h.step - first.step >= span * 0.66);
  const calm = (h: GuitarHit) => (c.curve?.length ? (c.curve[h.step] ?? 0) < 0.5 : h.step - first.step < span * 0.6);

  // feedback: the last note when it's held long enough to swell (more so when the song ends on it), and maybe a very long note on the way
  if (single(last) && secs(last) >= 1.2 && rng.chance(Math.min(0.9, chance('feedback') * (c.songEnd ? 1.5 : 1)))) {
    last.feedback = rng.chance(0.3) ? 19 : 12;
    done.push('feedback');
  }
  const long = seq.slice(0, -1).filter((h) => single(h) && h.len >= 12 && secs(h) >= 2).sort((a, b) => b.len - a.len || a.step - b.step);
  if (long.length && rng.chance(chance('feedback') * 0.5)) {
    long[0].feedback = 12;
    done.push('feedback');
  }

  // pinch harmonics, where a player leans on a squeal: the highest held note (the climax), a note a jump up or a fast
  // run lands on, a long bend, a downbeat in the loudest part. Each a roll of its own, each one after the first less likely.
  const pinchAt: [GuitarHit, number][] = [];
  const climax = seq.filter((h) => single(h) && !h.feedback).sort((a, b) => top(b) - top(a) || a.step - b.step)[0];
  if (climax) pinchAt.push([climax, 1]);
  seq.forEach((h, k) => {
    if (h === climax || !single(h) || h.feedback) return;
    const prev = seq[k - 1];
    const close = prev && h.step - (prev.step + prev.len) <= 2;
    const jump = close && top(h) - top(prev) >= 5;
    const run = k >= 3 && restBefore(k) <= 1 && seq.slice(k - 3, k).every((p, j) => p.len <= 2 && (j === 2 || seq[k - 3 + j + 1].step - (p.step + p.len) <= 1));
    const bent = ((h.bend ?? 0) > 0 || (h.lateBend ?? 0) > 0) && h.len >= 6;
    const downbeat = c.barStarts.includes(h.step) && loud(h);
    const f = jump || run ? 0.6 : bent ? 0.5 : downbeat ? 0.35 : 0;
    if (f) pinchAt.push([h, f]);
  });
  const pinched: GuitarHit[] = [];
  for (const [h, f] of pinchAt) {
    if (!room('pinch') || pinched.some((p) => Math.abs(p.step - h.step) < 8)) continue;
    if (!rng.chance(chance('pinch') * f * 0.7 ** pinched.length)) continue;
    h.harm = 'pinch';
    pinched.push(h);
    done.push('pinch');
  }

  // whammy dives: the last note (more so when the band drops after it), straight after a pinch (the metal classic),
  // at the end of a phrase (a held note with a beat or more of rest after it)
  // (only from the middle of the range: a dive from a high note thins out and sounds fake, as real ones do. A pinched
  // note squeals an octave and a fifth over it, so it must start lower)
  const diveFrom = (h: GuitarHit) => top(h) + (c.keyUp ?? 0) <= (h.harm === 'pinch' ? DIVE_TOP_PINCH : DIVE_TOP);
  const dive = (h: GuitarHit) => { h.dive = diveSize(rng, c.genre, top(h)); done.push('dive'); };
  if (held(last) && !last.feedback && diveFrom(last) && rng.chance(Math.min(0.9, chance('dive') * (c.dropAfter ? 1.3 : 1)))) dive(last);
  for (const h of pinched) {
    if (room('dive') && !h.dive && diveFrom(h) && h.len >= 6 && rng.chance(chance('dive') * (HEAVY.includes(c.genre) ? 0.6 : 0.25))) dive(h);
  }
  const ends = seq.slice(0, -1).filter((h, k) => held(h) && !h.dive && !h.feedback && diveFrom(h) && rest(k) >= 4);
  if (room('dive') && ends.length && rng.chance(chance('dive') * 0.4)) dive(rng.pick(ends));
  // a small dip: the bar let down a half or whole step at the end of a long note
  const dips = DIPS.includes(c.genre) ? seq.filter((h) => single(h) && h.len >= 8 && !h.dive && !h.feedback) : [];
  if (room('dive') && dips.length && rng.chance(chance('dive') * 0.5)) {
    rng.pick(dips).dive = rng.chance(0.5) ? 1 : 2;
    done.push('dive');
  }

  // natural harmonics: calm held notes an open string gives, a chord tone first (it rings with the band); now and then a second
  const chimes = seq.filter((h) => single(h) && !h.harm && !h.dive && !h.feedback && !h.bend && !h.unbend && !h.lateBend && HARMONIC_NOTES.has(h.notes[0] + (c.keyUp ?? 0)) && calm(h));
  const chimeWeight = (h: GuitarHit) => (c.tonesAt(h.step).includes(h.notes[0] % 12) ? 3 : 1);
  if (chimes.length && rng.chance(chance('natural'))) {
    // (its vibrato mark stays: the guitar plays a natural harmonic without one)
    const a = rng.weighted(chimes.map((h) => [h, chimeWeight(h)] as [GuitarHit, number]));
    a.harm = 'natural';
    done.push('natural');
    const more = chimes.filter((h) => h !== a);
    if (more.length && rng.chance(chance('natural') * 0.5)) {
      rng.weighted(more.map((h) => [h, chimeWeight(h)] as [GuitarHit, number])).harm = 'natural';
      done.push('natural');
    }
  }

  // pick scrapes (full solos only): into the solo (more so when the band built up into it), a beat or two when it
  // starts on a downbeat; and into a new phrase after half a bar's rest in the second half, a beat
  if (c.solo && !first.mute && rng.chance(Math.min(0.9, chance('scrape') * (c.liftIn ? 1.4 : 1)))) {
    first.scrape = first.step % 16 === 0 && rng.chance(0.6) ? 8 : 4;
    done.push('scrape');
  }
  const phrases = c.solo ? seq.filter((h, k) => k > 0 && !h.mute && restBefore(k) >= 8 && h.step - first.step >= span * 0.5) : [];
  if (phrases.length && rng.chance(chance('scrape') * 0.5)) {
    rng.pick(phrases).scrape = 4;
    done.push('scrape');
  }
  return { hits: out, done };
}

/** How far a dive goes: the heavy genres take it an octave or two, the others a fourth to an octave. Never below the
 *  low E (a two-octave dive needs a note to start from). */
function diveSize(rng: Rng, genre: Genre, from: number): number {
  const size = HEAVY.includes(genre)
    ? rng.weighted([[12, 3], [24, 1]])
    : rng.weighted([[5, 1], [7, 1], [12, 2]]);
  return size === 24 && from - 24 < DIVE_FLOOR ? 12 : size;
}
