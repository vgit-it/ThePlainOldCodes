// Checks the two solo "easier to follow" switches (docs/SOLO-MELODY.md, step 0f) on the solos the page plays (Melody + player):
//  - Breath: after a busy stretch of quick notes the next note (and the rest before it) is left as written. The longest run of quick
//    notes (under a beat) gets shorter, the same seed plays the same, and a link without the switch plays as before.
//  - Motif (the melody step's own check, solo-melody-check, measures the repeating rhythm): here it only has to keep the solos valid and the same each time.
//   npm run solo-breath-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

type Sw = { soloMotif?: 'on' | 'off'; soloBreath?: 'on' | 'off' };
const play = (i: number, sw: Sw) => {
  const genre = GENRES[i % 7], meter = METERS[i % METERS.length], mood = MOODS[i % MOODS.length], s = `sm-${i}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({ s, sec, hits: sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step) as any[] }));
};
/** The longest run of notes in a row shorter than a beat (a quarter in 4/4; 4 steps). */
const longestQuick = (hits: any[]) => { let run = 0, best = 0; for (const h of hits) { run = h.len < 4 ? run + 1 : 0; best = Math.max(best, run); } return best; };
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

const rows: Record<string, { run: number[]; notes: number[] }> = {};
for (const [name, sw] of [['off', {}], ['motif', { soloMotif: 'on' }], ['breath', { soloBreath: 'on' }], ['both', { soloMotif: 'on', soloBreath: 'on' }]] as [string, Sw][]) {
  const r = (rows[name] = { run: [], notes: [] });
  for (let i = 0; i < N; i++) {
    const a = play(i, sw);
    for (const x of a) { r.run.push(longestQuick(x.hits)); r.notes.push(x.hits.length); if (!x.hits.length) fail(`${x.s} (${name}): a solo with no notes`); }
    // the same switches, the same song, the same notes
    if (i % 5 === 0) { const b = play(i, sw); if (key(a.flatMap((x) => x.hits)) !== key(b.flatMap((x) => x.hits))) fail(`${name} song ${i}: not the same twice`); }
  }
}
// a link from before the switches (nothing set) plays as 'off' set by hand
for (let i = 0; i < Math.min(N, 12); i++) if (key(play(i, {}).flatMap((x) => x.hits)) !== key(play(i, { soloMotif: 'off', soloBreath: 'off' }).flatMap((x) => x.hits))) fail(`song ${i}: off is not the same as nothing set`);

console.log('switches   solos  notes/solo  longest quick run (avg, max)');
for (const [name, r] of Object.entries(rows)) console.log(`${name.padEnd(9)} ${String(r.run.length).padStart(6)} ${avg(r.notes).toFixed(0).padStart(11)} ${avg(r.run).toFixed(1).padStart(12)} ${String(Math.max(...r.run)).padStart(5)}`);
if (!(avg(rows.breath.run) < avg(rows.off.run) * 0.8)) fail(`breath: longest quick run ${avg(rows.breath.run).toFixed(1)} against ${avg(rows.off.run).toFixed(1)} without it`);
if (!(avg(rows.breath.notes) < avg(rows.off.notes))) fail('breath: not fewer notes');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
