// Checks the story's dynamics (docs/SOLO-SHAPE.md): "Solo shape" on, with "Chosen bars, story told in licks + the lick library".
//  - Only loudness, a little timing (a third of a step) and vibrato change: every hit keeps its step, pitch, length and bends.
//  - Loudness follows the arc: builds and ramps are louder at the end than at the start, releases are softer at the end.
//  - A laid-back start only in the soft moods; the last note rings (vibrato) when it is held.
//  - The same seed plays the same; the switch off is note for note the story without it.
//   npm run solo-shape-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const SOFT = ['dreamy', 'melancholic', 'nostalgic', 'dark'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const play = (j: number, shape?: 'on' | 'off') => {
  const i = j >> 1, genre = GENRES[i % 7], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `st-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { mood, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, soloCores: 'library', soloPolish: 'on', ...(shape ? { soloShape: shape } : {}) } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.shift ?? 0}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.vib ?? 0}:${h.vel.toFixed(3)}`).join('|');
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

const swell: Record<string, { up: number; n: number }> = { build: { up: 0, n: 0 }, ramp: { up: 0, n: 0 }, release: { up: 0, n: 0 } };
let solos = 0, shifted = 0, ringing = 0, lastHeld = 0;
for (let j = 0; j < 2 * N; j++) {
  const none = play(j), off = play(j, 'off'), on = play(j, 'on');
  on.secs.forEach((y, k) => {
    solos++;
    if (key(none.secs[k]) !== key(off.secs[k])) fail(`song ${j}: shape off is not the story as it was`);
    const a = off.secs[k].guitar2 as any[], b = y.guitar2 as any[];
    if (a.length !== b.length) return fail(`song ${j}: the number of hits changed`);
    a.forEach((h, q) => {
      const g = b[q];
      if (h.step !== g.step || h.len !== g.len || h.notes.join() !== g.notes.join() || (h.bend ?? 0) !== (g.bend ?? 0)) fail(`song ${j}: a hit changed beyond loudness, timing and vibrato at step ${h.step}`);
      if ((g.shift ?? 0) !== (h.shift ?? 0)) { shifted++; if (!SOFT.includes(on.mood)) fail(`song ${j}: a late start in the ${on.mood} mood`); if ((g.shift ?? 0) - (h.shift ?? 0) > 1 / 3 + 1e-6) fail(`song ${j}: a start more than a third of a step late`); }
    });
    for (const p of y.soloCurve?.parts ?? []) {
      const slot = swell[p.role];
      if (!slot) continue;
      const hs = b.filter((h) => !h.mute && h.notes.length && h.step >= p.from && h.step < p.to);
      if (hs.length < 4) continue;
      const mid = (p.from + p.to) / 2, v1 = mean(hs.filter((h) => h.step < mid).map((h) => h.vel)), v2 = mean(hs.filter((h) => h.step >= mid).map((h) => h.vel));
      if (isNaN(v1) || isNaN(v2)) continue;
      slot.n++;
      if (p.role === 'release' ? v2 < v1 : v2 > v1) slot.up++;
    }
    const lastOf = (xs: any[]) => xs.filter((h) => !h.mute && h.notes.length).reduce((m, h) => (h.step > m.step ? h : m));
    const l = lastOf(b);
    // (a final note that goes on into the next section is not in this one's hits: nothing to hear here)
    const endLand = (y.soloCurve?.landings ?? []).filter((x: any) => x.role !== 'waypoint').reduce((m: number, x: any) => Math.max(m, x.step), -1);
    if (l.step === endLand && l.len >= 8 && !l.bend && !l.trill && !l.tremolo) { lastHeld++; if (l.vib) ringing++; else fail(`song ${j}: the last held note does not ring`); }
  });
  if (j % 6 === 0 && key(on.secs[0]) !== key(play(j, 'on').secs[0])) fail(`song ${j}: not the same twice`);
}
const pct = (s: { up: number; n: number }) => (s.n ? Math.round((100 * s.up) / s.n) : 0);
console.log(`solos ${solos}: builds louder at the end in ${pct(swell.build)}% of ${swell.build.n}, ramps ${pct(swell.ramp)}% of ${swell.ramp.n}, releases softer at the end ${pct(swell.release)}% of ${swell.release.n}; ${shifted} laid-back starts; ${ringing} of ${lastHeld} held last notes ring`);
for (const r of ['build', 'ramp', 'release']) if (swell[r].n && pct(swell[r]) < 70) fail(`the ${r} parts do not follow the arc (${pct(swell[r])}%)`);
if (!shifted) fail('no laid-back start ever');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
