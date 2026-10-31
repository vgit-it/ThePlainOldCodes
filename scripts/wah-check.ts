// Checks the wah pedal (docs/WAH.md):
//  - Switched off, the song is exactly the same (no section carries a wah).
//  - Switched on, the song is the same but for the wah marks; the rest of every section is untouched.
//  - Auto-wah only on funk rhythm guitars, only on electric guitars, never under a guitar-alone intro; a cocked or rocking wah only on a solo or lead break.
//  - The same seed gives the same plan; the genres lean as set (funk has the most auto-wah, every wah turns up).
//  - The pedal's sweep: harder picking opens it higher, within its range.
//   npm run wah-check        (N=80 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { AUTO_CHANCE } from '../src/sections/wah';
import { ROCK_MIN_LEN, ROCK_SHARE, WAH, autoWahHz, rockCurve, rockPlan } from '../src/audio/wah';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 80);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const build = (g: string, i: number, wah?: 'on') => {
  const s = `wh-${g}-${i}`;
  const idea = generate({ genre: g, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', ...(wah ? { wah } : {}) } as never).sections as any[];
};

const count: Record<string, { songs: number; auto: number; cocked: number; rock: number }> = {};
for (const g of GENRES) {
  count[g] = { songs: 0, auto: 0, cocked: 0, rock: 0 };
  for (let i = 0; i < N; i++) {
    const off = build(g, i), on = build(g, i, 'on');
    const at = `${g} ${i}`;
    count[g].songs++;
    if (off.length !== on.length) { fail(`${at}: the switch changed the number of sections`); continue; }
    if (off.some((x) => x.section?.wah)) fail(`${at}: a wah with the switch off`);
    // the same section, but for the wah
    const strip = (x: any) => JSON.stringify(x, (k, v) => (k === 'wah' ? undefined : v));
    if (on.some((x, k) => strip(x) !== strip(off[k]))) fail(`${at}: the switch changed more than the wah`);
    let auto = false, cocked = false, rock = false;
    on.forEach((x, k) => {
      const w = x.section?.wah, sec = x.section;
      if (!w) return;
      if (w.chords) {
        auto = true;
        if (w.chords !== 'auto' || !sec.sound.chords.startsWith('electric') || sec.bandFrom !== undefined) fail(`${at}: section ${k}: an auto-wah where it can't be (${sec.sound.chords}, band from ${sec.bandFrom})`);
        if (g !== 'funk' && !AUTO_CHANCE[g]) fail(`${at}: section ${k}: an auto-wah in ${g}`);
      }
      if (w.guitar2) {
        if (w.guitar2 === 'rock') rock = true; else cocked = true;
        if (!['cocked', 'rock'].includes(w.guitar2) || !sec.sound.guitar2.startsWith('electric') || !(sec.solo || sec.lead)) fail(`${at}: section ${k}: a cocked wah outside a solo or lead break`);
      }
    });
    if (auto) count[g].auto++;
    if (cocked) count[g].cocked++;
    if (rock) count[g].rock++;
    if (cocked && rock) fail(`${at}: a song with a parked wah in one solo and a rocking one in another`);
    // a song's wah is all or nothing: every funk rhythm section that can have it, does
    if (auto && on.some((x) => !x.section.wah?.chords && x.section.sound.chords.startsWith('electric') && x.section.bandFrom === undefined)) fail(`${at}: an auto-wah on some sections of the song only`);
    if (i < 5 && JSON.stringify(build(g, i, 'on').map((x) => x.section.wah)) !== JSON.stringify(on.map((x) => x.section.wah))) fail(`${at}: not the same twice`);
  }
}

console.log('genre      songs  auto-wah  cocked wah  rocking wah  (share of songs)');
for (const g of GENRES) {
  const c = count[g], p = (n: number) => `${Math.round((100 * n) / c.songs)}%`.padStart(8);
  console.log(`${g.padEnd(10)} ${String(c.songs).padStart(5)} ${p(c.auto)} ${p(c.cocked).padStart(11)} ${p(c.rock).padStart(12)}`);
}
if (GENRES.some((g) => g !== 'funk' && count[g].auto)) fail('an auto-wah outside funk');
if (!count.funk.auto) fail('funk: never an auto-wah');
if (!GENRES.some((g) => count[g].cocked)) fail('never a cocked wah');
if (!GENRES.some((g) => count[g].rock)) fail('never a rocking wah');
if (count.pop.rock) fail('a rocking wah in pop');
if (count.hardrock.cocked <= count.altmetal.cocked) fail('hard rock does not use the cocked wah more than alt metal');

// the sweep: harder picking opens it higher, within its range
let prev = 0;
for (const level of [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1]) {
  const hz = autoWahHz(level);
  if (hz < WAH.auto.low - 1e-6 || hz > WAH.auto.high + 1e-6) fail(`autoWahHz(${level}) = ${hz.toFixed(0)}: outside ${WAH.auto.low}-${WAH.auto.high} Hz`);
  if (hz < prev) fail(`autoWahHz(${level}) = ${hz.toFixed(0)}: lower than for a softer pick`);
  prev = hz;
}
if (Math.abs(autoWahHz(0) - WAH.auto.low) > 1e-6) fail('a silent guitar should leave the wah closed');

// the rocking pedal: a held note rocks a beat at a time, some stay parked; the curve is smooth, in range, heel to heel
let rocked = 0, tried = 0;
for (const six of [0.08, 0.125, 0.18]) {
  for (let seed = 0; seed < 400; seed++) {
    for (const len of [ROCK_MIN_LEN, 8, 16]) {
      const dur = len * six * 0.97;
      const plan = rockPlan(dur, six, seed * 100);
      tried++;
      if (!plan) continue;
      rocked++;
      if (plan.cycles < 1 || plan.cycles * plan.cycle > dur - 0.1 + 1e-9) fail(`rockPlan(${dur.toFixed(2)}, ${six}): ${plan.cycles} rocks of ${plan.cycle.toFixed(3)} s don't fit`);
      if (Math.abs(plan.cycle / (4 * six) - 1) > 0.121) fail(`rockPlan(${dur.toFixed(2)}, ${six}): a rock of ${plan.cycle.toFixed(3)} s is too far off a beat of ${(4 * six).toFixed(3)}`);
      if (JSON.stringify(plan) !== JSON.stringify(rockPlan(dur, six, seed * 100))) fail('rockPlan: not the same twice');
    }
  }
}
const share = rocked / tried;
if (share < 0.1 || share > ROCK_SHARE + 0.05) fail(`rocking: ${(share * 100).toFixed(0)}% of held notes (about ${ROCK_SHARE * 100}% of the ones that fit a rock is the aim)`);
if (rockPlan(0.05, 0.125, 1)) fail('rockPlan: rocked a note too short to rock');
for (const [heel, toe] of [[WAH.rock.heel, WAH.rock.toe], [WAH.rock.narrowHeel, WAH.rock.narrowToe]]) {
  const c = rockCurve(3, heel, toe);
  if (Math.abs(c[0] - heel) > 1e-6 || Math.abs(c[c.length - 1] - heel) > 1e-6) fail('rockCurve: does not start and end at the heel');
  if (Math.max(...c) > toe + 1e-6 || Math.min(...c) < heel - 1e-6 || Math.max(...c) < toe * 0.99) fail('rockCurve: out of the pedal\'s range, or never reaches the toe');
  const step = Math.max(...c.slice(1).map((v, i) => Math.abs(Math.log(v / c[i]))));
  if (step > 0.5) fail(`rockCurve: a jump of ${step.toFixed(2)} (log) between points`);
}
if (WAH.rock.narrowToe - WAH.rock.narrowHeel >= WAH.rock.toe - WAH.rock.heel) fail('the narrow sweep is not narrower');

console.log(bad ? `${bad} problem(s)` : 'wah: all good');
process.exit(bad ? 1 : 0);
