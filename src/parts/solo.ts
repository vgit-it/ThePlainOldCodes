// How the solo writers' notes are played (the hands): quick notes in a run legato, slower connected notes picked or slid, held notes bent
// now and then, vibrato on the long ones. The solo writers themselves are solo2.ts, soloplan.ts and solomelody.ts.
// (The first, classic writer lived here; it is in git, see docs/ARCHIVE.md.)

import type { GuitarHit } from '../idea';
import type { LickKind } from '../players/lead';
import type { Rng } from '../rng';
import type { Tuning } from '../theory/fretboard';
import { type PlacedNote, placedHit } from './licks';

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** How often each kind of player bends a held note. */
const STYLE: Record<LickKind, { bend: number }> = {
  sung: { bend: 0.4 },
  blues: { bend: 0.5 },
  run: { bend: 0.15 },
  simple: { bend: 0.25 },
  muted: { bend: 0.1 },
};

const HANDS_OF: Record<LickKind, { legato: number; slide: number; vib: number; slideIn: number }> = {
  sung: { legato: 0.6, slide: 0.35, vib: 14, slideIn: 0.25 },
  blues: { legato: 0.6, slide: 0.25, vib: 18, slideIn: 0.2 },
  run: { legato: 0.7, slide: 0.15, vib: 16, slideIn: 0.1 },
  simple: { legato: 0.3, slide: 0.4, vib: 22, slideIn: 0.35 },
  muted: { legato: 0.1, slide: 0.05, vib: 6, slideIn: 0.05 },
};

type Art = 'pick' | 'legato' | 'slide';
export interface Ev extends Omit<PlacedNote, 'bend'> { bend?: number; slide?: number; art?: Art; peak?: boolean; shift?: number }

/** What the solo writers' notes need to be played: the player, the key, the chord and scale tests, the length, the tuning. */
export interface SoloHands { lick: LickKind; key: number; minor: boolean; isTone: (m: number, g: number) => boolean; inScale: (m: number) => boolean; total: number; t: Tuning }

/**
 * How each note is played, from where it sits in the solo: quick notes in a run legato (a pick on each
 * beat, hammered up or pulled off down between), slower connected notes picked or slid, a phrase
 * started picked or slid into, held chord notes bent now and then, vibrato on held notes (wider on the
 * peak); what a lick says, it keeps.
 */
export function playSolo(rng: Rng, evs: Ev[], o: SoloHands): GuitarHit[] {
  const { lick, key, minor, isTone, inScale, total, t } = o;
  const st = STYLE[lick];
  evs.sort((x, y) => x.step - y.step);
  const all = evs.filter((e, i) => i === 0 || e.step > evs[i - 1].step);
  const hd = HANDS_OF[lick];
  all.forEach((e, i) => {
    const prev = all[i - 1];
    const connected = !!prev && e.step <= prev.step + prev.len;
    if (e.bend === undefined) {
      e.bend = 0;
      if (e.len >= 4 && isTone(e.midi, e.step) && rng.chance(st.bend)) e.bend = inScale(e.midi - 2) ? 2 : inScale(e.midi - 1) ? 1 : 0;
      // the blue third over a major chord, curled up toward the major third
      if (lick === 'blues' && !minor && mod(e.midi - key, 12) === 3 && e.len >= 2) { e.midi += 1; e.bend = 1; }
    }
    if (!e.art) {
      const iv = prev ? Math.abs(e.midi - prev.midi) : 0;
      if (!connected || e.bend) e.art = 'pick';
      else if (e.step - prev.step <= 2) e.art = e.step % 4 !== 0 && iv > 0 && iv <= 4 && rng.chance(hd.legato) ? 'legato' : 'pick';
      else e.art = iv > 0 && iv <= 7 && rng.chance(hd.slide) ? 'slide' : 'pick';
    }
    if (!connected && !e.bend && !e.dead && !e.tremolo && !e.unbend && i > 0 && rng.chance(hd.slideIn)) e.slide = -rng.pick([2, 3]);
    if (e.len >= 6 && !e.trill && !e.tremolo && e.dyad === undefined) e.vib = Math.max(e.vib ?? 0, hd.vib + (e.peak ? 8 : 0));
  });

  const pos = rng.int(5, 12);
  const hits: GuitarHit[] = all.map((e, i) => {
    const next = all[i + 1]?.step ?? total;
    const h = placedHit({ ...e, bend: e.bend ?? 0, len: Math.max(1, Math.min(e.len, next - e.step)), vel: Math.min(1, e.vel) }, t, pos);
    const h2 = e.slide ? { ...h, slide: e.slide } : h;
    return e.shift ? { ...h2, shift: e.shift } : h2;
  });
  return hits;
}
