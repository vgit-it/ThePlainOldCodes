// Checks the chord-story reader (docs/SOLO-HARMONY.md, src/parts/soloharmony.ts) and measures, as a baseline, how the
// solo writer "Tune first" lines up with the story its chords tell:
//  - the reader on known progressions (I V vi IV, i bVI bVII i, a loop that ends on V, a deceptive move);
//  - on real solos: the mix of roles, how many loop, how many arrivals and twists, how many end open;
//  - Tune first against the story, with Solo story off (the baseline) and on: where the climax lands (role, pull), whether calls end
//    on a chord that waits and answers on home, and whether the energy follows the chords' pull and the section's tension;
//  - Solo story on: phrases of 2-4 bars adding up to the solo, the climax phrase ends on the plot's peak bar, the tune still a tune;
//  - the shapes (arch, rounds, climb and hold, fall and stay low, valley, level, steps): the mix against the mix of real solos, each shape
//    really has its shape in the energy that is played, the played height follows the plan, and every shape can be forced by hand.
//   npm run solo-harmony-check        (N=96 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { beatAt, readHarmony, type HarmonyRole } from '../src/parts/soloharmony';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const corr = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
};

const crestsOf = (e: number[], dip: number) => {
  // (a crest: a high point that stands `dip` above the lowest point on the way to a higher one, on both sides)
  const out: number[] = [];
  for (let i = 0; i < e.length; i++) {
    if ((i > 0 && e[i] < e[i - 1]) || (i < e.length - 1 && e[i] < e[i + 1]) || (i > 0 && e[i] === e[i - 1])) continue;
    let l = e[i], r = e[i], lm = e[i], rm = e[i], hl = false, hr = false;
    for (let k = i - 1; k >= 0; k--) { l = Math.min(l, e[k]); if (e[k] > e[i]) { hl = true; break; } }
    for (let k = i + 1; k < e.length; k++) { r = Math.min(r, e[k]); if (e[k] > e[i]) { hr = true; break; } }
    lm = hl ? l : -Infinity; rm = hr ? r : -Infinity;
    const base = Math.max(lm, rm);
    if (e[i] - (base === -Infinity ? Math.min(l, r) : base) >= dip) out.push(i);
  }
  return out;
};
/** Does the energy that is played have the shape the card says? (read from the played energy, not from the plan) */
function hasShape(shape: string, e: number[]): boolean {
  const n = e.length, mx = Math.max(...e), mn = Math.min(...e), pos = e.indexOf(mx) / (n - 1);
  const third = (k: number) => e.slice(Math.floor((n * k) / 3), Math.floor((n * (k + 1)) / 3));
  switch (shape) {
    case 'arch': return crestsOf(e, 0.4).length <= 1 && mean(e.slice(-2)) <= mx - 0.3 && mean(e.slice(0, 2)) <= mx - 0.25;
    case 'rounds': { const c = crestsOf(e, 0.25); return c.length >= 2 && e[c[c.length - 1]] >= Math.max(...c.map((i) => e[i])) - 0.05; }
    case 'climb': { const hi = e.map((v, i) => (v >= mx - 0.25 ? i : -1)).filter((i) => i >= 0); return hi.length >= 0.3 * n && mean(hi) / (n - 1) > 0.5; }
    case 'fall': return pos <= 0.45 && mean(e.slice(Math.floor(n * 0.6))) <= mx - 0.7;
    case 'valley': { const mid = Math.min(...e.slice(Math.ceil(n * 0.25), Math.floor(n * 0.75) + 1)); return Math.max(...e.slice(0, Math.ceil(n * 0.4))) - mid >= 0.45 && Math.max(...e.slice(Math.ceil(n * 0.6))) - mid >= 0.45; }
    case 'level': return mx - mn <= 0.9;
    case 'steps': return mean(third(2)) - mean(third(0)) >= 0.4;
  }
  return false;
}
/** The mix of real solos by overall shape (docs/STUDY-SOLO.md): level 38, falling 20, rising 17, arch 15, dip 9. */
const REAL = 'level 38%, falling 20%, rising 17%, arch 15%, dip 9%';

// ---- the reader on known progressions
const roles = (mode: any, ch: [number, string][], bars = 2) => readHarmony(ch.map(([root, q], i) => ({ step: i * bars * 16, chord: { root, q: q as never } })), ch.length * bars * 16, mode);
{
  const a = roles('major', [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']]);
  if (a.beats.map((b) => b.role).join() !== 'home,tense,rest,away') fail(`I V vi IV read as ${a.beats.map((b) => b.role)}`);
  if (a.loop !== 0) fail('I V vi IV once is not a loop');
  const b = roles('minor', [[0, 'min'], [8, 'maj'], [10, 'maj'], [0, 'min']]);
  if (b.beats[3].arrival <= 0) fail('i bVI bVII i: the last chord is not an arrival');
  if (b.beats.map((x) => x.role).join() !== 'home,rest,away,home') fail(`i bVI bVII i read as ${b.beats.map((x) => x.role)}`);
  const c = roles('major', [[0, 'maj'], [5, 'maj'], [7, 'maj'], [9, 'min']]);
  if (!c.beats[3].twist) fail('V to vi is not a twist');
  const d = readHarmony([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ step: i * 16, chord: { root: [0, 5, 7, 5][i % 4], q: 'maj' as never } })), 128, 'major');
  if (d.loop !== 64 || d.loops !== 2) fail(`a 4-chord loop twice: loop ${d.loop}, ${d.loops}x`);
  const e = roles('major', [[0, 'maj'], [5, 'maj'], [7, 'maj']]);
  if (!e.endsOpen) fail('a section ending on V is not open');
  const f = readHarmony([{ step: 0, chord: { root: 0, q: 'add9' } }, { step: 16, chord: { root: 0, q: 'add9' } }], 32, 'major');
  if (f.beats.length !== 1) fail('the same chord twice should be one');
}

// ---- real solos, Tune first with Solo story off and on
import { TUNE_PASS, tuneScore } from '../src/parts/solotune';
const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `tf-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, mood, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on', ...extra } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const R: Record<HarmonyRole, number> = { home: 0, rest: 0, away: 0, tense: 0, lift: 0 };
function run(label: string, extra: Record<string, unknown>, count = N, quiet = false) {
  const T = { solos: 0, loops: 0, arrivals: 0, twists: 0, open: 0, beats: 0, climax: 0, climaxRole: { ...R }, climaxArr: 0, climaxPull: 0, callN: 0, callWait: 0, ansN: 0, ansHome: 0, callPull: 0, ansPull: 0, timePull: 0, arrivalsHit: 0, arrivalsTotal: 0, tunes: 0, scoreSum: 0, peakBars: 0, peakOk: 0, climaxEarly: 0 };
  const timeRole = { ...R };
  const cEnergyPull: number[] = [], cEnergyTension: number[] = [], cPullTension: number[] = [];
  let dull = 0;
  const byLen: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
  const SH: Record<string, { n: number; tested: number; ok: number; r: number[]; short: number }> = {};
  for (let j = 0; j < count; j++) {
    for (const sec of build(j, extra).secs) {
      T.solos++;
      const total = sec.song.total, bars = sec.song.bars;
      const map = readHarmony(sec.chords.timeline, total, sec.song.mode);
      T.beats += map.beats.length;
      if (map.loop) T.loops++;
      if (map.endsOpen) T.open++;
      T.arrivals += map.beats.filter((b) => b.arrival > 0).length;
      T.twists += map.beats.filter((b) => b.twist).length;
      if (map.beats.every((b) => b.role === 'home')) dull++;
      for (const b of map.beats) timeRole[b.role] += b.len;
      T.timePull += mean(Array.from({ length: Math.floor(total / 4) }, (_, i) => beatAt(map, i * 4).pull));
      const lands = (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'mid');
      for (const l of lands) {
        const b = beatAt(map, l.step);
        if (l.role === 'climax') { T.climax++; T.climaxRole[b.role]++; T.climaxPull += b.pull; if (b.arrival > 0) T.climaxArr++; if (l.step < total * 0.4) T.climaxEarly++; }
        if (l.role === 'call') { T.callN++; T.callPull += b.pull; if (b.pull >= 0.4) T.callWait++; }
        if (l.role === 'answer' || l.role === 'end') { T.ansN++; T.ansPull += b.pull; if (b.role === 'home') T.ansHome++; }
      }
      for (const b of map.beats.filter((x) => x.arrival > 0)) { T.arrivalsTotal++; if (lands.some((l: any) => l.step >= b.step && l.step < b.step + 8)) T.arrivalsHit++; }
      const eBar = bars.map((b: any) => mean(sec.soloCurve.energy.slice(b.start, b.start + b.len)));
      const pBar = bars.map((b: any) => mean(Array.from({ length: b.len }, (_, i) => beatAt(map, b.start + i).pull)));
      const tBar = sec.section.tension as number[];
      for (const [arr, c] of [[cEnergyPull, corr(eBar, pBar)], [cEnergyTension, corr(eBar, tBar)], [cPullTension, corr(pBar, tBar)]] as [number[], number][]) if (!Number.isNaN(c)) arr.push(c);
      const t = tuneScore(sec.guitar2, { bars, key: sec.song.key, chordAt: (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(total - 1, g)]].chord }).score;
      T.scoreSum += t;
      if (t >= TUNE_PASS) T.tunes++;
      if (extra.soloStory === 'on') {
        // the card says the plot: phrases of 2-4 bars adding up to the solo, a peak on the plot's bar
        const m = /phrases of ([\d +]+) bars/.exec((sec.notes ?? []).join(' '));
        const ls = m ? m[1].split('+').map((v: string) => Number(v.trim())) : [];
        if (bars.length > 3 && (ls.reduce((a: number, b: number) => a + b, 0) !== bars.length || ls.some((v: number) => v < 2 || v > 4))) fail(`${label} solo ${T.solos}: phrases ${ls.join('+')} for ${bars.length} bars`);
        for (const v of ls) byLen[v] = (byLen[v] ?? 0) + 1;
        const sm = /shape: (\w+)/.exec((sec.notes ?? []).join(' '));
        if (sm) {
          const o = (SH[sm[1]] ??= { n: 0, tested: 0, ok: 0, r: [], short: 0 });
          o.n++;
          if (/too short for/.test((sec.notes ?? []).join(' '))) o.short++;
          if (bars.length >= 6) {
            o.tested++;
            if (hasShape(sm[1], eBar)) o.ok++; else if (process.env.DEBUG) console.log(`  ${sm[1]} does not show in ${eBar.map((v: number) => Math.round(v * 9)).join(' ')}`);
            const played = bars.map((b: any) => mean(sec.guitar2.filter((h: any) => h.step >= b.start && h.step < b.start + b.len && h.notes.length && !h.mute).map((h: any) => h.notes[0])));
            const keep = played.map((v: number, q: number) => (Number.isNaN(v) ? -1 : q)).filter((q: number) => q >= 0);
            const c = corr(keep.map((q: number) => played[q]), keep.map((q: number) => eBar[q]));
            if (!Number.isNaN(c)) o.r.push(c);
          }
        }
        if (!(sec.notes ?? []).some((n: string) => n.startsWith('plot ('))) fail(`${label} solo ${T.solos}: no plot line on the card`);
        const pk = /the main peak on \S+ at the end of bar (\d+)/.exec((sec.notes ?? []).join(' '));
        const cl = lands.find((l: any) => l.role === 'climax');
        if (pk) {
          T.peakBars++;
          const endStep = bars[Number(pk[1]) - 1].start + bars[Number(pk[1]) - 1].len;
          if (cl && cl.step >= bars[Number(pk[1]) - 1].start && cl.step < endStep) T.peakOk++; else fail(`${label} solo ${T.solos}: the climax at ${cl?.step} is not on the plot's peak (bar ${pk[1]})`);
        }
      }
    }
  }
  const tt = Object.values(timeRole).reduce((a, b) => a + b, 0);
  if (!quiet) console.log(`[${label}] ${T.solos} solos; time on each role: ` + Object.entries(timeRole).map(([k, v]) => `${k} ${pct(v, tt)}%`).join(', '));
  if (!quiet) console.log(`  climax (${T.climax}): on ${Object.entries(T.climaxRole).map(([k, v]) => `${k} ${pct(v, T.climax)}%`).join(', ')}; mean pull ${(T.climaxPull / Math.max(1, T.climax)).toFixed(2)} (the solos' own ${(T.timePull / T.solos).toFixed(2)}); on an arrival chord ${pct(T.climaxArr, T.climax)}%; in the first 40% of the solo ${pct(T.climaxEarly, T.climax)}%`);
  if (!quiet) console.log(`  calls end on a waiting chord (pull .4+) ${pct(T.callWait, T.callN)}% (mean pull ${(T.callPull / Math.max(1, T.callN)).toFixed(2)}); answers and the end on home ${pct(T.ansHome, T.ansN)}% (mean pull ${(T.ansPull / Math.max(1, T.ansN)).toFixed(2)}); home takes ${pct(timeRole.home, tt)}% of the time`);
  if (!quiet) console.log(`  a landing within half a bar of an arrival ${pct(T.arrivalsHit, T.arrivalsTotal)}% of ${T.arrivalsTotal}; energy against the chords' pull r ${mean(cEnergyPull).toFixed(2)}, against the section's tension r ${mean(cEnergyTension).toFixed(2)}; as a tune ${pct(T.tunes, T.solos)}% (mean ${(T.scoreSum / T.solos).toFixed(2)})`);
  if (extra.soloStory === 'on' && !quiet) { const n = byLen[2] + byLen[3] + byLen[4]; console.log(`  phrases ${n}: ${[2, 3, 4].map((v) => `${pct(byLen[v], n)}% of ${v} bars`).join(', ')}`); }
  if (extra.soloStory === 'on' && !quiet) console.log(`  the climax sits on the plot's peak bar in ${pct(T.peakOk, T.peakBars)}% of ${T.peakBars} solos with a peak`);
  return { T, dull, SH, loops: pct(T.loops, T.solos), open: pct(T.open, T.solos) };
}
const off = run('story off', {});
console.log(`  chord loops ${off.loops}%, end open ${off.open}%, ${(off.T.arrivals / off.T.solos).toFixed(1)} arrivals and ${(off.T.twists / off.T.solos).toFixed(1)} twists a solo, all-home solos ${off.dull}`);
const on = run('story on', { soloStory: 'on' });
// ---- the shapes
{
  const n = Object.values(on.SH).reduce((a, v) => a + v.n, 0);
  console.log(`shapes picked by the song (${n} solos; real solos: ${REAL}):`);
  for (const [k, v] of Object.entries(on.SH).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${k.padEnd(7)} ${String(pct(v.n, n)).padStart(3)}% of ${v.n}; shows in the played energy ${pct(v.ok, v.tested)}% of ${v.tested}; the played height follows the plan r ${mean(v.r).toFixed(2)}`);
    if (v.tested >= 8 && pct(v.ok, v.tested) < 80) fail(`the ${k} shape shows in only ${pct(v.ok, v.tested)}% of the played energy`);
    if (n >= 80 && pct(v.n, n) > 40) fail(`the ${k} shape takes ${pct(v.n, n)}% of the solos`);
  }
  if (n >= 80 && Object.keys(on.SH).length < 6) fail(`only ${Object.keys(on.SH).length} shapes are ever picked`);
  console.log('every shape forced by hand (Solo story shape):');
  for (const sh of ['arch', 'rounds', 'climb', 'fall', 'valley', 'level', 'steps']) {
    const f = run(`forced ${sh}`, { soloStory: 'on', soloStoryShape: sh }, Math.max(8, Math.round(N / 3)), true);
    const v = f.SH[sh] ?? { n: 0, tested: 0, ok: 0, r: [], short: 0 };
    const all = Object.values(f.SH).reduce((a, x) => a + x.n, 0);
    console.log(`  ${sh.padEnd(7)} ${v.n} of ${all} solos have it${v.short ? `, ${v.short} too short` : ''}; shows ${pct(v.ok, v.tested)}% of ${v.tested}; played height r ${mean(v.r).toFixed(2)}; climax on the peak ${pct(f.T.peakOk, f.T.peakBars)}%; as a tune ${pct(f.T.tunes, f.T.solos)}%`);
    if (v.tested >= 6 && pct(v.ok, v.tested) < 80) fail(`forced ${sh}: it shows in only ${pct(v.ok, v.tested)}% of the played energy`);
    if (f.T.peakBars && pct(f.T.peakOk, f.T.peakBars) < 95) fail(`forced ${sh}: the climax is not on the peak bar`);
    if (pct(f.T.tunes, f.T.solos) < 75) fail(`forced ${sh}: under 75% sound like a tune`);
  }
}
// an old or odd link: an unknown shape falls back to Auto
{
  const g = build(0, { soloStory: 'on', soloStoryShape: 'nonsense' }), au = build(0, { soloStory: 'on', soloStoryShape: 'auto' });
  if (!g.secs.length || g.secs.some((x: any, k: number) => (x.notes ?? []).join('|') !== (au.secs[k].notes ?? []).join('|'))) fail('an unknown shape value does not fall back to Auto');
}
if (off.loops === 0) fail('no solo has a chord loop (the loop read may be broken)');
if (off.T.arrivals === 0) fail('no arrivals found in any solo');
if (pct(on.T.peakOk, on.T.peakBars) < 95) fail('the climax is not on the plot\'s peak bar in 95% of the solos');
if (pct(on.T.tunes, on.T.solos) < 80) fail('under 80% of the story solos sound like a tune');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
