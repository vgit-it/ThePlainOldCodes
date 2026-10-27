// The story's own dynamics (docs/SOLO-SHAPE.md, step 2f): a solo told in licks is played as a story. Loudness follows the arc (a statement
// is plain, a build and a ramp swell, the climax is the loudest, a release dies away), a phrase may start a hair behind the beat in a
// relaxed mood, an answer that repeats the opening ends with vibrato where the opening did not, and the last note rings with vibrato.
// Runs on the written hits and the story's parts (the melody view reads the same parts); it changes loudness, a little timing and vibrato only,
// never a pitch or a length.

import type { GuitarHit, StoryPart } from '../idea';
import type { Guitar2Part } from './guitar2';
import type { Mood } from '../tension';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The moods where a phrase may come in a hair late (the others drive: they stay on the beat). */
const LAID_BACK: Mood[] = ['dreamy', 'melancholic', 'nostalgic', 'dark'];

/** How loud a part is at `f` (0 at its start, 1 at its end), against the solo's level. */
function gain(p: StoryPart, f: number): number {
  switch (p.role) {
    case 'statement': return 0.94;
    case 'answer': return /opening phrase again/.test(p.recipe) ? 0.9 + 0.1 * f : 0.97;
    case 'return': return 0.97;
    case 'build': return 0.92 + 0.12 * f;
    case 'ramp': return 0.88 + 0.2 * f;
    case 'release': return 1 - 0.2 * f;
    case 'link': return 0.93;
    default: return 1;
  }
}

export function shapeStory(sol: Guitar2Part, mood: Mood): Guitar2Part {
  const parts = sol.curve?.parts ?? [], lands = sol.curve?.landings ?? [];
  if (!parts.length) return sol;
  const sounding = sol.hits.filter((h) => !h.mute && h.notes.length);
  if (!sounding.length) return sol;
  const lastAt = sounding.reduce((m, h) => Math.max(m, h.step), -1);
  const landAt = new Map(lands.map((l) => [l.step, l.role]));
  const firstIn = new Map<StoryPart, GuitarHit>(), lastIn = new Map<StoryPart, GuitarHit>();
  for (const h of sounding) {
    const p = parts.find((q) => h.step >= q.from && h.step < q.to);
    if (!p) continue;
    if (!firstIn.has(p)) firstIn.set(p, h);
    lastIn.set(p, h);
  }
  const hits = sol.hits.map((h) => {
    if (h.mute || !h.notes.length) return h;
    const p = parts.find((q) => h.step >= q.from && h.step < q.to), role = landAt.get(h.step);
    let g = p ? gain(p, (h.step - p.from) / Math.max(1, p.to - p.from)) : role === 'climax' ? 1.08 : role === 'end' ? 0.95 : 1;
    const out: GuitarHit = { ...h };
    if (p && (p.role === 'statement' || p.role === 'answer' || p.role === 'return') && firstIn.get(p) === h && !h.shift && !landAt.has(h.step) && LAID_BACK.includes(mood) && h.len >= 2) out.shift = 1 / 3;
    // (an answer that repeats the opening: the last held note sings, where the opening's tag did not)
    if (p && p.role === 'answer' && /opening phrase again/.test(p.recipe) && lastIn.get(p) === h && h.len >= 4 && !h.vib && !h.bend && !h.trill && !h.tremolo) out.vib = 18;
    // (the last note rings out)
    if (h.step === lastAt) { if (h.len >= 8 && !h.vib && !h.bend && !h.trill && !h.tremolo) out.vib = 24; g *= 0.92; }
    out.vel = clamp(h.vel * g, 0.25, 1);
    return out;
  });
  return { ...sol, hits };
}
