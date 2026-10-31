// Checks "Expression follows story" (docs/SOLO-EXPRESSION-FOLLOW.md, src/parts/soloexpress.ts `follow`):
//  - off is the default and changes nothing (also with Solo story off or Solo expression off); same seed, same notes;
//  - on: the tune stays (goal notes at their time and pitch, the last note's end), no overlaps, no note out of range, no silence over a beat;
//  - on, against off (Solo story on, Solo expression on): the quick notes follow the energy (quick notes in the loudest quarter of the bars
//    against the quietest, the bars' quick share against their energy), the quiet bars are not sparse (real solos are busy all through:
//    6-7 notes a bar in every quarter), the held notes in the loudest bars are dressed more, and the solo is not more regular.
//   npm run solo-follow-check        (N=96 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 96);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const corr = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN;
};
const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `fo-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on', ...extra } as never).sections as any[]).filter((x) => x.section?.solo) };
};
const sounding = (hits: any[]) => hits.filter((h) => !h.mute && h.notes.length).map((h) => ({ ...h, t: h.step + (h.shift ?? 0) })).sort((a, b) => a.t - b.t);
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.shift ?? 0}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.lateBend ?? 0}:${h.art ?? ''}`).join('|');
const dressed = (h: any) => !!(h.bend || h.vib || h.unbend || h.lateBend || h.trill || h.slide);

const SHP: Record<string, { n: number; off: number; on: number }> = {};
const S = { solos: 0, defaultSame: 0, defaultTotal: 0, hash: 0, goals: 0, lost: 0, ended: 0 };
type Acc = { rQ: number[]; lowQ: number[]; topQ: number[]; lowN: number[]; topN: number[]; stretch: number; n: number; dLow: number[]; dTop: number[] };
const acc = (): Acc => ({ rQ: [], lowQ: [], topQ: [], lowN: [], topN: [], stretch: 0, n: 0, dLow: [], dTop: [] });
const A = { off: acc(), on: acc() };
function measure(a: Acc, sec: any) {
  const bars = sec.song.bars as { start: number; len: number }[];
  if (bars.length < 6) return;
  a.n++;
  const eBar = bars.map((b) => mean(sec.soloCurve.energy.slice(b.start, b.start + b.len)));
  const ns = sounding(sec.guitar2);
  const inBar = (b: { start: number; len: number }) => ns.filter((h: any) => h.step >= b.start && h.step < b.start + b.len);
  const cnt = bars.map((b) => inBar(b).length), fast = bars.map((b) => inBar(b).filter((h: any) => h.len <= 1).length);
  const quick = bars.map((_, i) => (cnt[i] ? fast[i] / cnt[i] : 0));
  const r = corr(quick, eBar);
  if (!Number.isNaN(r)) a.rQ.push(r);
  const ord = eBar.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]);
  const q = Math.max(1, Math.floor(bars.length / 4)), low = ord.slice(0, q).map(([, i]) => i), top = ord.slice(-q).map(([, i]) => i);
  a.lowQ.push(mean(low.map((i) => quick[i]))); a.topQ.push(mean(top.map((i) => quick[i])));
  a.lowN.push(mean(low.map((i) => cnt[i]))); a.topN.push(mean(top.map((i) => cnt[i])));
  // (the longest stretch of bars in one pace, as the plan's score reads it)
  const bucket = fast.map((x) => (x < 2 ? 0 : x < 7 ? 1 : 2));
  let longest = 1, run = 1;
  for (let b = 1; b < bucket.length; b++) { run = bucket[b] === bucket[b - 1] ? run + 1 : 1; longest = Math.max(longest, run); }
  if (longest >= 5) a.stretch++;
  const dr = (idx: number[]) => { let t = 0, d = 0; for (const i of idx) for (const h of inBar(bars[i])) if (h.len >= 3) { t++; if (dressed(h)) d++; } return t ? d / t : NaN; };
  const dl = dr(low), dt = dr(top);
  if (!Number.isNaN(dl)) a.dLow.push(dl);
  if (!Number.isNaN(dt)) a.dTop.push(dt);
}

/** The tune stays and the hands can play it: range, no overlap, no silence over a beat, speeds, every goal note on its time and pitch (as in `plain`, the same without Follow). */
function invariants(label: string, sec: any, plainSec: any) {
  const song = sec.song, s16 = 15000 / song.bpm;
  const h = sounding(sec.guitar2), plain = sounding(plainSec.guitar2);
  const lastBar = song.bars[song.bars.length - 1];
  h.forEach((x: any, k: number) => {
    const nx = h[k + 1];
    if (x.notes[0] < 50 || x.notes[0] > 90) fail(`${label}: note ${x.notes[0]} out of range`);
    if (nx) {
      if (x.t + x.len > nx.t + 1e-6 + 1 / 12) fail(`${label}: overlap at ${x.t}`);
      const beat = Math.min(...(song.bars.find((b: any) => x.t + x.len >= b.start && x.t + x.len < b.start + b.len) ?? lastBar).groups);
      if (nx.t - (x.t + x.len) > beat + 1e-6 && x.t + x.len < lastBar.start) fail(`${label}: silence after ${x.t}`);
      const ms = (nx.t - x.t) * s16, min = nx.art === 'legato' || nx.art === 'slide' ? 40 : x.chug || nx.chug ? 50 : 60;
      if (!x.tremolo && !x.trill && !nx.tremolo && ms < min - 1e-6) fail(`${label}: ${ms.toFixed(0)} ms between notes at ${nx.t}`);
    }
  });
  for (const g of (sec.soloCurve?.landings ?? []).filter((l: any) => ['call', 'answer', 'climax', 'end'].includes(l.role))) {
    S.goals++;
    const p = plain.find((x: any) => Math.abs(x.t - g.step) < 1e-6);
    if (!p) continue;
    const e = h.find((x: any) => Math.abs(x.t - p.t) < 1e-6 && (x.notes[0] === p.notes[0] || x.notes[0] - (x.lateBend ?? 0) === p.notes[0]));
    if (!e) { S.lost++; fail(`${label}: goal ${p.notes[0]} at ${g.step} is gone`); continue; }
    if (Math.abs(e.t + e.len - (p.t + p.len)) > 1 / 12 + 1e-6) { S.ended++; fail(`${label}: goal at ${g.step} ends at ${e.t + e.len}, not ${p.t + p.len}`); }
  }
}

for (let j = 0; j < N; j++) {
  const base = { soloStory: 'on', soloExpress: 'on' };
  const off = build(j, base), offTrue = build(j, { ...base, soloStoryFollow: 'off' }), on = build(j, { ...base, soloStoryFollow: 'on' }), again = build(j, { ...base, soloStoryFollow: 'on' });
  // follow does nothing without Solo story, or without Solo expression
  const noStory = build(j, { soloStory: 'off', soloExpress: 'on' }), noStoryF = build(j, { soloStory: 'off', soloExpress: 'on', soloStoryFollow: 'on' });
  const noExp = build(j, { soloStory: 'on', soloExpress: 'off' }), noExpF = build(j, { soloStory: 'on', soloExpress: 'off', soloStoryFollow: 'on' });
  const same = (x: any, y: any) => x.secs.every((sec: any, si: number) => JSON.stringify(sec.guitar2) === JSON.stringify(y.secs[si].guitar2));
  S.defaultTotal += 3;
  if (same(off, offTrue)) S.defaultSame++; else fail(`${off.s}: follow 'off' is not the default`);
  if (same(noStory, noStoryF)) S.defaultSame++; else fail(`${off.s}: follow changed a solo with Solo story off`);
  if (same(noExp, noExpF)) S.defaultSame++; else fail(`${off.s}: follow changed a solo with Solo expression off`);
  on.secs.forEach((sec, si) => {
    S.solos++;
    const song = sec.song, s16 = 15000 / song.bpm;
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) S.hash++;
    const nOn = A.on.stretch, nOff = A.off.stretch;
    measure(A.on, sec); measure(A.off, off.secs[si]);
    const sm = /shape: (\w+)/.exec((sec.notes ?? []).join(' '));
    if (sm) { const o = (SHP[sm[1]] ??= { n: 0, off: 0, on: 0 }); o.n++; o.on += A.on.stretch - nOn; o.off += A.off.stretch - nOff; }
    invariants(on.s, sec, off.secs[si]);
  });
}

// with the other expression switches on too (recast, echo, bend dials, full amount): the same rules hold
const ALL = { soloStory: 'on', soloExpress: 'on', soloRecast: 'on', soloEcho: 'on', soloBends: 'dials', soloAmount: 'full' };
let combo = 0;
for (let j = 0; j < Math.ceil(N / 3); j++) {
  const a = build(j, ALL), b = build(j, { ...ALL, soloStoryFollow: 'on' });
  b.secs.forEach((sec, si) => { combo++; invariants(b.s + ' (all switches)', sec, a.secs[si]); });
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();
const pc = (a: number, b: number) => Math.round((100 * a) / Math.max(1, b));
console.log(`solos ${S.solos} (${A.on.n} with 6+ bars)`);
console.log(`default unchanged: ${S.defaultSame}/${S.defaultTotal}; same seed same notes: ${S.solos - S.hash}/${S.solos}`);
console.log(`with recast, echo, bend dials and full amount on too: ${combo} solos checked`);
console.log(`goal notes ${S.goals}: lost ${S.lost}, ends moved ${S.ended}`);
for (const k of ['off', 'on'] as const) {
  const a = A[k];
  console.log(`follow ${k.padEnd(3)}: quick vs energy r ${f(mean(a.rQ))} | quick share quietest/loudest quarter ${f(mean(a.lowQ))}/${f(mean(a.topQ))} | notes a bar ${f(mean(a.lowN))}/${f(mean(a.topN))} | held notes dressed ${f(mean(a.dLow))}/${f(mean(a.dTop))} | 5+ bars in one pace ${pc(a.stretch, a.n)}%`);
}
if (process.env.DEBUG) for (const [k, o] of Object.entries(SHP)) console.log(`  ${k.padEnd(7)} n ${o.n}: 5+ bars in one pace off ${pc(o.off, o.n)}% on ${pc(o.on, o.n)}%`);
if (S.defaultSame !== S.defaultTotal) fail('the default changed');
if (S.hash) fail('same seed gave other notes');
if (S.lost + S.ended) fail('goal notes moved');
const on = A.on, off = A.off;
if (mean(on.rQ) < mean(off.rQ) + 0.1) fail(`the quick notes do not follow the energy more (r ${f(mean(on.rQ))} against ${f(mean(off.rQ))})`);
if (mean(on.topQ) < mean(on.lowQ) + 0.08) fail('the loudest bars are not quicker than the quietest');
if (mean(on.lowN) < 5.5) fail(`the quiet bars are sparse (${f(mean(on.lowN))} notes a bar; real solos play 6-7 all through)`);
if (mean(on.dTop) < mean(off.dTop) + 0.05) fail(`the held notes at the high bars are not dressed more (${f(mean(on.dTop))} against ${f(mean(off.dTop))})`);
if (pc(on.stretch, on.n) > pc(off.stretch, off.n) + 4) fail('the solos got more regular');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
