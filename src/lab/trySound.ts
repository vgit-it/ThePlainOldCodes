// The lick lab's "Try a sound" menu (docs/GUITAR-SOUNDS.md): puts one of the lead's extra sounds on a lick
// as it's placed, so each sound can be heard in a real line. Only the labs use it; the writers don't yet.

import type { PlacedNote } from '../parts/licks';

export const TRY_SOUNDS = [
  { id: '', label: 'As written' },
  { id: 'pinch', label: 'Pinch harmonic on the longest note' },
  { id: 'natural', label: 'Natural harmonics (every note a chime)' },
  { id: 'dive', label: 'Whammy dive at the end' },
  { id: 'pinchDive', label: 'Pinch harmonic and a dive at the end' },
  { id: 'feedback', label: 'Feedback on the last note' },
  { id: 'scrape', label: 'Pick scrape into it (two beats)' },
] as const;
export type TrySound = (typeof TRY_SOUNDS)[number]['id'];

/** The lick's notes with the sound put on (a copy; the notes passed in are left alone). */
export function trySound(notes: PlacedNote[], sound: TrySound): PlacedNote[] {
  const out = notes.map((n) => ({ ...n }));
  if (!out.length || !sound) return out;
  const last = out[out.length - 1];
  if (sound === 'pinch') {
    // the longest note (the later one of equals): where a player leans on a squeal
    let k = 0;
    out.forEach((n, i) => { if (n.len >= out[k].len) k = i; });
    out[k].harm = 'pinch';
    out[k].vib ??= 24;
  } else if (sound === 'natural') {
    // a harmonic is touched, not fretted: no bends, trills or double-stops, each one picked
    for (const n of out) {
      Object.assign(n, { harm: 'natural', bend: 0, art: 'pick' });
      for (const k of ['unbend', 'lateBend', 'bendAt', 'trill', 'dyad', 'tremolo', 'vib', 'dead'] as const) delete n[k];
    }
  } else if (sound === 'dive') last.dive = 12;
  else if (sound === 'pinchDive') {
    last.harm = 'pinch';
    last.dive = 12;
  } else if (sound === 'feedback') last.feedback = 12;
  else if (sound === 'scrape') out[0].scrape = 8;
  return out;
}
