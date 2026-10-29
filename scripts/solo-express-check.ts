// Checks the Solo expression pass (docs/SOLO-EXPRESSION.md, src/parts/soloexpress.ts) on Tune first solos, all meters, genres and moods:
//  - Off: nothing changes (the same notes as before);
//  - On: no overlaps, in range, no silence over a beat, a speed the hands can play at the tempo;
//  - the tune stays: the goal notes of every phrase (call, answer, climax, end) are there on their pitch, at their time, and the last note ends where it did;
//    at least 60% of all the tune's notes are still at their own start on their own pitch;
//  - it is playing, not a pattern: held notes and quick notes mix inside bars, no long stretch of bars all in one pace, the windows are of many lengths,
//    several kinds of window in most solos, and solos differ from each other in pace (the player's temper);
//  - the same seed gives the same notes.
//   npm run solo-express-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `ex-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  const secs = (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', ...extra } as never).sections as any[]).filter((x) => x.section?.solo);
  return { s, genre, meter, mood, secs };
};
const sounding = (hits: any[]) => hits.filter((h) => !h.mute && h.notes.length).map((h) => ({ ...h, t: h.step + (h.shift ?? 0) })).sort((a, b) => a.t - b.t);
const key = (hits: any[]) => hits.map((h) => `${h.step}:${h.shift ?? 0}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.lateBend ?? 0}:${h.art ?? ''}`).join('|');

const T = { solos: 0, notes: 0, overlap: 0, range: 0, silence: 0, speed: 0, goals: 0, goalLost: 0, endLost: 0, keepSum: 0, mixedBars: 0, bars: 0, longRun: 0, solosBars6: 0, kinds3: 0, quick: 0, held: 0, changed: 0, wins: 0, hash: 0, offSame: 0, offTotal: 0, below60: 0 };
const lens = new Set<number>();
const winLens: number[] = [];
const fastShares: number[] = [];
const byGenre: Record<string, { fast: number; n: number }> = {};
const kindsSeen = new Map<string, number>();
for (let j = 0; j < N; j++) {
  const off = build(j, {}), offTrue = build(j, { soloExpress: 'off' }), on = build(j, { soloExpress: 'on' }), again = build(j, { soloExpress: 'on' });
  on.secs.forEach((sec, si) => {
    T.solos++;
    const song = sec.song, s16 = 15000 / song.bpm;
    const h = sounding(sec.guitar2);
    const plain = sounding(off.secs[si].guitar2);
    T.offTotal++;
    if (JSON.stringify(off.secs[si].guitar2) === JSON.stringify(offTrue.secs[si].guitar2)) T.offSame++;
    if (key(sec.guitar2) !== key(again.secs[si].guitar2)) T.hash++;
    const lastBar = song.bars[song.bars.length - 1];
    h.forEach((x: any, k: number) => {
      T.notes++;
      const nx = h[k + 1];
      lens.add(Math.round(x.len * 12) / 12);
      if (x.notes[0] < 50 || x.notes[0] > 90) { T.range++; fail(`${on.s}: note ${x.notes[0]} out of range`); }
      if (nx) {
        if (x.t + x.len > nx.t + 1e-6 + 1 / 12) { T.overlap++; fail(`${on.s}: overlap at ${x.t}`); }
        const beat = Math.min(...(song.bars.find((b: any) => x.t + x.len >= b.start && x.t + x.len < b.start + b.len) ?? lastBar).groups);
        if (nx.t - (x.t + x.len) > beat + 1e-6 && x.t + x.len < lastBar.start) { T.silence++; fail(`${on.s}: silence after ${x.t}`); }
        const ms = (nx.t - x.t) * s16, min = nx.art === 'legato' || nx.art === 'slide' ? 40 : x.chug || nx.chug ? 50 : 60;
        if (!x.tremolo && !x.trill && !nx.tremolo && ms < min - 1e-6) { T.speed++; fail(`${on.s}: ${ms.toFixed(0)} ms between notes at ${nx.t}`); }
      }
    });
    // the tune stays: the goal notes, and the last note's end
    const goals: { step: number }[] = (sec.soloCurve?.landings ?? []).filter((l: any) => ['call', 'answer', 'climax', 'end'].includes(l.role));
    for (const g of goals) {
      T.goals++;
      const p = plain.find((x: any) => Math.abs(x.t - g.step) < 1e-6);
      if (!p) continue;
      const e = h.find((x: any) => Math.abs(x.t - p.t) < 1e-6 && (x.notes[0] === p.notes[0] || x.notes[0] - (x.lateBend ?? 0) === p.notes[0]));
      if (!e) { T.goalLost++; fail(`${on.s}: goal ${p.notes[0]} at ${g.step} is gone`); continue; }
      if (Math.abs(e.t + e.len - (p.t + p.len)) > 1 / 12 + 1e-6) { T.endLost++; fail(`${on.s}: goal at ${g.step} ends at ${e.t + e.len}, not ${p.t + p.len}`); }
    }
    // how much of the whole tune is still at its own start on its own pitch
    let kept = 0;
    for (const p of plain) if (h.some((x: any) => Math.abs(x.t - p.t) < 1e-6 && (x.notes[0] === p.notes[0] || x.notes[0] - (x.lateBend ?? 0) === p.notes[0]))) kept++;
    const keep = kept / Math.max(1, plain.length);
    T.keepSum += keep;
    if (keep < 0.6) { T.below60++; }
    // mixed bars, stretches of one pace, quick and held notes
    const qf = song.bars.map(() => 0), hd = song.bars.map(() => 0);
    let quick = 0;
    for (const x of h) {
      const b = song.bars.findIndex((bb: any) => x.t >= bb.start && x.t < bb.start + bb.len);
      if (b < 0) continue;
      if (x.len * s16 <= 150) { qf[b]++; quick++; }
      if (x.len * s16 >= 420) { hd[b]++; T.held++; }
    }
    T.quick += quick;
    const total = h.length || 1;
    fastShares.push(quick / total);
    (byGenre[sec.song.genre] ??= { fast: 0, n: 0 }).fast += quick / total, byGenre[sec.song.genre].n++;
    song.bars.forEach((_: any, b: number) => { T.bars++; if (qf[b] >= 3 && hd[b] >= 1) T.mixedBars++; });
    const bucket = qf.map((x: number) => (x < 2 ? 0 : x < 7 ? 1 : 2));
    let longest = 1, run = 1;
    for (let b = 1; b < bucket.length; b++) { run = bucket[b] === bucket[b - 1] ? run + 1 : 1; longest = Math.max(longest, run); }
    if (song.bars.length >= 6) { T.solosBars6++; if (longest > 4) { T.longRun++; } }
    const ex: { t0: number; t1: number; pattern: string }[] = sec.soloCurve?.express ?? [];
    const kinds = new Set(ex.filter((w) => w.pattern !== 'plain').map((w) => w.pattern));
    for (const k of kinds) kindsSeen.set(k, (kindsSeen.get(k) ?? 0) + 1);
    if (kinds.size >= 3) T.kinds3++;
    for (const w of ex) { T.wins++; if (w.pattern !== 'plain') T.changed++; if (w.pattern !== 'plain' && w.pattern !== 'decor') winLens.push(Math.round(w.t1 - w.t0)); }
  });
}
const sd = (a: number[]) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
console.log(`solos ${T.solos}, notes ${T.notes}`);
console.log(`off = default: ${T.offSame}/${T.offTotal}; same seed same notes: ${T.solos - T.hash}/${T.solos}`);
console.log(`overlaps ${T.overlap}, out of range ${T.range}, silences over a beat ${T.silence}, too quick ${T.speed}`);
console.log(`goal notes ${T.goals}: lost ${T.goalLost}, ends moved ${T.endLost}`);
console.log(`tune notes kept at their own start and pitch: ${(100 * T.keepSum / T.solos).toFixed(0)}% on average; ${T.below60} solos under 60%`);
console.log(`bars mixed (a held note and 3+ quick notes): ${pct(T.mixedBars, T.bars)}%; solos with a stretch of 5+ bars in one pace: ${pct(T.longRun, T.solosBars6)}%`);
console.log(`windows played another way: ${pct(T.changed, T.wins)}%; solos with 3+ kinds: ${pct(T.kinds3, T.solos)}%; kinds: ${[...kindsSeen].map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`window lengths (steps) of runs and holds: ${[...new Set(winLens)].sort((a, b) => a - b).join(' ')}; note lengths seen: ${[...lens].sort((a, b) => a - b).slice(0, 8).join(' ')}...`);
console.log(`quick-note share per solo: mean ${mean(fastShares).toFixed(2)}, spread (sd) ${sd(fastShares).toFixed(2)}; by genre ${Object.entries(byGenre).map(([g, v]) => `${g} ${(v.fast / v.n).toFixed(2)}`).join(', ')}`);
if (T.offSame !== T.offTotal) fail('Off changed the notes');
if (T.hash) fail(`${T.hash} solos differ with the same seed`);
if (T.goalLost + T.endLost) fail('goal notes moved');
if (T.keepSum / T.solos < 0.65) fail('too little of the tune kept');
if (T.mixedBars / T.bars < 0.12) fail('too few mixed bars');
if (T.solosBars6 && T.longRun / T.solosBars6 > 0.25) fail('too many long stretches in one pace');
if (T.kinds3 / T.solos < 0.6) fail('too little variety of windows');
if (sd(fastShares) < 0.06) fail('every solo has the same pace');
console.log(bad ? `${bad} problems` : 'all good');
process.exit(bad ? 1 : 0);
