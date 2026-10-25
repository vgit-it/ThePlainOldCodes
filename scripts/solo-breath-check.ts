// Checks the solo "easier to follow" switches (docs/SOLO-MELODY.md, step 0f) on the solos the page plays (Melody + player):
//  - Breath: after a busy stretch of quick notes the next note (and the rest before it) is left as written. The longest run of quick
//    notes (under a beat) gets shorter, the same seed plays the same, and a link without the switch plays as before.
//  - Grid: in a straight groove the player's figures start and land on the 8th: fewer notes off the 8th grid, almost no triplets or in-between starts.
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
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) + '%' : '-');

type Sw = { soloMotif?: 'on' | 'off'; soloBreath?: 'on' | 'off'; soloGrid?: 'on' | 'off' };
const play = (i: number, sw: Sw) => {
  const genre = GENRES[i % 7], meter = METERS[i % METERS.length], mood = MOODS[i % MOODS.length], s = `sm-${i}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({ s, sec, hits: sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step) as any[] }));
};
/** The longest run of notes in a row shorter than a beat (a quarter in 4/4; 4 steps). */
const longestQuick = (hits: any[]) => { let run = 0, best = 0; for (const h of hits) { run = h.len < 4 ? run + 1 : 0; best = Math.max(best, run); } return best; };
/** How many notes start off the 8th grid, and how many of those are not even on a 16th (a triplet or in between). */
const offGrid = (hits: any[], bars: any[]) => {
  let off = 0, odd = 0;
  for (const h of hits) {
    const b = bars.find((x: any) => h.step >= x.start && h.step < x.start + x.len); if (!b) continue;
    const x = h.step + (h.shift ?? 0) - b.start;
    if (Math.abs(x - Math.round(x)) > 0.08) { off++; odd++; } else if (Math.round(x) % 2) off++;
  }
  return { off, odd };
};
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

const rows: Record<string, { run: number[]; notes: number[]; off: number; odd: number; all: number }> = {};
for (const [name, sw] of [['off', {}], ['motif', { soloMotif: 'on' }], ['breath', { soloBreath: 'on' }], ['grid', { soloGrid: 'on' }], ['all', { soloMotif: 'on', soloBreath: 'on', soloGrid: 'on' }]] as [string, Sw][]) {
  const r = (rows[name] = { run: [], notes: [], off: 0, odd: 0, all: 0 });
  for (let i = 0; i < N; i++) {
    const a = play(i, sw);
    for (const x of a) { r.run.push(longestQuick(x.hits)); r.notes.push(x.hits.length); const g = offGrid(x.hits, x.sec.song.bars); r.off += g.off; r.odd += g.odd; r.all += x.hits.length; if (!x.hits.length) fail(`${x.s} (${name}): a solo with no notes`); }
    // the same switches, the same song, the same notes
    if (i % 5 === 0) { const b = play(i, sw); if (key(a.flatMap((x) => x.hits)) !== key(b.flatMap((x) => x.hits))) fail(`${name} song ${i}: not the same twice`); }
  }
}
// a link from before the switches (nothing set) plays as 'off' set by hand
for (let i = 0; i < Math.min(N, 12); i++) if (key(play(i, {}).flatMap((x) => x.hits)) !== key(play(i, { soloMotif: 'off', soloBreath: 'off', soloGrid: 'off' }).flatMap((x) => x.hits))) fail(`song ${i}: off is not the same as nothing set`);

console.log('switches   solos  notes/solo  longest quick run (avg, max)  off the 8th grid  triplets or between');
for (const [name, r] of Object.entries(rows)) console.log(`${name.padEnd(9)} ${String(r.run.length).padStart(6)} ${avg(r.notes).toFixed(0).padStart(11)} ${avg(r.run).toFixed(1).padStart(12)} ${String(Math.max(...r.run)).padStart(5)} ${pct(r.off, r.all).padStart(17)} ${pct(r.odd, r.all).padStart(20)}`);
if (!(avg(rows.breath.run) < avg(rows.off.run) * 0.8)) fail(`breath: longest quick run ${avg(rows.breath.run).toFixed(1)} against ${avg(rows.off.run).toFixed(1)} without it`);
const share = (n: string, k: 'off' | 'odd') => rows[n][k] / Math.max(1, rows[n].all);
if (!(share('grid', 'off') < share('off', 'off') * 0.8)) fail(`grid: ${(100 * share('grid', 'off')).toFixed(0)}% off the 8th grid against ${(100 * share('off', 'off')).toFixed(0)}% without it`);
if (!(share('grid', 'odd') < share('off', 'odd') * 0.5)) fail(`grid: ${(100 * share('grid', 'odd')).toFixed(0)}% triplets or in between against ${(100 * share('off', 'odd')).toFixed(0)}% without it`);
if (!(avg(rows.breath.notes) < avg(rows.off.notes))) fail('breath: not fewer notes');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
