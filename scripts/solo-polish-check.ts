// Checks the polish on the story solos (docs/SOLO-POLISH.md): "Solo polish" on, with "Chosen bars, story told in licks + the lick library".
//  - Every core the story had is still played (same step and pitch), and the solo ends on the same pitch at the same time.
//  - The player did dress some notes, but lightly: under a third more hits than without it.
//  - No rest longer than a beat (a late hit may add a third of a step).
//  - The same seed plays the same; the switch off is note for note the story without it.
//   npm run solo-polish-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const BEAT = 4;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const play = (j: number, polish?: 'on' | 'off') => {
  const i = j >> 1, genre = GENRES[i % 7], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `st-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, soloCores: 'library', ...(polish ? { soloPolish: polish } : {}) } as never).sections as any[]).filter((x) => x.section?.solo);
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.shift ?? 0}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.art ?? ''}`).join('|');
const has = (sec: any, step: number, midi: number) => sec.guitar2.some((h: any) => h.step === step && h.notes[0] === midi);

let solos = 0, h0 = 0, h1 = 0, dressed = 0, notes = 0, worst = 0;
for (let j = 0; j < 2 * N; j++) {
  const none = play(j), off = play(j, 'off'), on = play(j, 'on');
  on.forEach((y, k) => {
    solos++;
    if (key(none[k]) !== key(off[k])) fail(`song ${j}: polish off is not the story as it was`);
    h0 += off[k].guitar2.length; h1 += y.guitar2.length;
    const lands = (off[k].soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint');
    for (const l of lands) if (has(off[k], l.step, l.midi) && !has(y, l.step, l.midi)) fail(`song ${j}: the core at step ${l.step} (${l.midi}) is gone`);
    const hs = (y.guitar2 as any[]).slice().sort((p, q) => p.step - q.step), endAt = lands.length ? lands[lands.length - 1].step : 0;
    let cover = off[k].soloCurve?.parts?.[0]?.from ?? hs[0].step;
    for (const h of hs) {
      if (h.step > endAt) break;
      const rest = h.step - cover;
      if (rest > worst) worst = rest;
      if (rest > BEAT + 0.5) fail(`song ${j}: a rest of ${rest} 16ths before step ${h.step}`);
      cover = Math.max(cover, h.step + h.len);
    }
    const lastOf = (sec: any) => (sec.guitar2 as any[]).filter((h) => h.notes.length && !h.mute).reduce((a, b) => (b.step > a.step ? b : a));
    const lastOff = lastOf(off[k]), lastOn = lastOf(y);
    if (lastOff.step + lastOff.len !== lastOn.step + lastOn.len || lastOff.notes[0] !== lastOn.notes[0]) fail(`song ${j}: the last note changed ${JSON.stringify([lastOff.step, lastOff.notes, lastOff.len, lastOn.step, lastOn.notes, lastOn.len, lastOn.bend, lastOn.shift])}`);
    for (const m of y.soloCurve?.moves ?? []) { notes++; if (m.rule !== 'plain') dressed++; }
  });
  if (j % 6 === 0 && key(on[0]) !== key(play(j, 'on')[0])) fail(`song ${j}: not the same twice`);
}
console.log(`solos ${solos}: ${h0} hits without the polish, ${h1} with (${(((h1 - h0) / h0) * 100).toFixed(0)}% more); ${dressed} of ${notes} notes dressed; longest rest ${worst.toFixed(2)} 16ths`);
if (!dressed) fail('the player never dressed a note');
if (h1 > h0 * 1.33) fail('the polish is too busy');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
