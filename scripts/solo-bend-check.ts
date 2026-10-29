// Checks the Solo bend dials (docs/SOLO-BENDS.md, src/parts/soloexpress.ts `dialBends`, the engine's bend speed and shape) on Tune first solos
// with Solo expression on, all genres and meters:
//  - Plain (and a link without the option): nothing changes;
//  - Dials: only the way a bend is played changes (speed, shape, timing): every note, pitch, length, bend size, vibrato is as in Plain;
//  - every bent note has a speed that fits the note (the bend is over before the note ends), a shape, and a time for a late bend or a release;
//  - the dials differ by place and neighbour: speeds from a snap to a slow crawl in the same song set; the climax and the last note bend slower than the rest;
//  - nothing outside the solos changes, and the same seed gives the same track.
//   npm run solo-bend-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const J = JSON.stringify;

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `bd-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloExpress: 'on', ...extra } as never).sections as any[] };
};
// (a hit without the dials: what Plain would have)
const bare = (h: any) => { const { bendRise: _r, bendEase: _e, bendAt: _a, ...rest } = h; return rest; };
const bent = (h: any) => !h.mute && h.notes.length && (h.bend || h.lateBend || h.unbend);

const T = { songs: 0, solos: 0, bends: 0, snap: 0, mid: 0, crawl: 0, eases: new Set<number>(), bigSum: 0, bigN: 0, restSum: 0, restN: 0, timed: 0 };
for (let j = 0; j < N; j++) {
  const plain = build(j, {}), plain2 = build(j, { soloBends: 'plain' }), dials = build(j, { soloBends: 'dials' }), again = build(j, { soloBends: 'dials' });
  T.songs++;
  if (J(plain.secs) !== J(plain2.secs)) fail(`${plain.s}: "Plain" changed the track`);
  if (J(dials.secs) !== J(again.secs)) fail(`${plain.s}: not the same twice`);
  dials.secs.forEach((sec, si) => {
    const was = plain.secs[si];
    if (!sec.section?.solo) { if (J(sec) !== J(was)) fail(`${plain.s}: section ${si} is not a solo but changed`); return; }
    T.solos++;
    const s16 = 15000 / sec.song.bpm;
    if (sec.guitar2.length !== was.guitar2.length) { fail(`${plain.s}: the solo has other notes`); return; }
    const lastStep = Math.max(...sec.guitar2.filter((h: any) => !h.mute && h.notes.length).map((h: any) => h.step));
    sec.guitar2.forEach((h: any, k: number) => {
      const w = was.guitar2[k];
      if (J(bare(h)) !== J(bare(w))) { fail(`${plain.s}: note ${k} changed beyond its bend dials`); return; }
      if (!bent(h)) { if (h.bendRise !== undefined || h.bendEase !== undefined) fail(`${plain.s}: dials on a note that isn't bent`); return; }
      T.bends++;
      const sec_ = (h.len * s16) / 1000, at = h.bendAt !== undefined ? (h.bendAt * s16) / 1000 : 0, rise = h.bendRise / 1000;
      if (!(h.bendRise >= 30 && h.bendRise <= 900)) fail(`${plain.s}: bend speed ${h.bendRise} ms out of range`);
      if (!(h.bendEase > 0.5 && h.bendEase < 2.5)) fail(`${plain.s}: bend shape ${h.bendEase}`);
      if (at + rise > sec_ + 0.04) fail(`${plain.s}: bend ends ${(at + rise - sec_).toFixed(2)} s after its note at ${h.step}`);
      if (h.bend && h.unbend && h.bendAt !== undefined && rise > at + 0.001) fail(`${plain.s}: the let-down starts before the bend up is over at ${h.step}`);
      if ((h.lateBend || h.unbend) && h.bendAt === undefined) fail(`${plain.s}: late bend or release with no time at ${h.step}`);
      if (h.bendAt !== undefined) T.timed++;
      if (h.bendRise < 100) T.snap++; else if (h.bendRise < 300) T.mid++; else T.crawl++;
      T.eases.add(h.bendEase);
      const big = h.step === lastStep || sec.soloCurve?.landings?.some((l: any) => l.role === 'climax' && Math.abs(l.step - h.step) < 1);
      if (big) { T.bigSum += h.bendRise; T.bigN++; } else { T.restSum += h.bendRise; T.restN++; }
    });
  });
}
const mean = (a: number, n: number) => (n ? Math.round(a / n) : 0);
console.log(`${T.songs} songs, ${T.solos} solos, ${T.bends} bent notes (${T.timed} with a time): snaps ${T.snap}, mid ${T.mid}, crawls ${T.crawl}; shapes ${[...T.eases].sort().join(' ')}`);
console.log(`mean speed: climax and last note ${mean(T.bigSum, T.bigN)} ms (${T.bigN}), the rest ${mean(T.restSum, T.restN)} ms (${T.restN})`);
if (T.bends < N) fail(`only ${T.bends} bent notes in ${N} songs`);
if (!T.snap || !T.mid || !T.crawl) fail('the speeds do not run from a snap to a crawl');
if (T.eases.size < 3) fail('too few bend shapes');
if (T.bigN > 5 && mean(T.bigSum, T.bigN) < mean(T.restSum, T.restN) * 1.2) fail('the climax and the last note do not bend slower');
console.log(bad ? `${bad} FAIL` : 'solo bends ok');
process.exit(bad ? 1 : 0);
