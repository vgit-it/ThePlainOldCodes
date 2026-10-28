// Checks the Solo echo (docs/SOLO-ECHO.md, src/parts/soloecho.ts + `echo` in src/parts/soloexpress.ts) on Tune first solos with Solo expression on,
// all genres and meters:
//  - Off (and a link without the option): nothing changes;
//  - On: the goal notes of the tune (the landings) are as they were, the last note ends where it did, nothing outside the solos changes,
//    and inside a solo nothing changes outside the windows that play another window's figure;
//  - the line is still playable: no overlaps, a speed the hands can play at the tempo;
//  - it does what it says: answers play their call's figure again (the same speed, cuts and kind, on the answer's own notes), many solos have it, a signature
//    figure turns up, and a copy is the same figure at other pitches (often the same way up or down, not always);
//  - with the recast and the bend dials on as well it is still playable (goal notes kept, no overlaps, speeds the hands can play);
//  - the same seed gives the same track.
//   npm run solo-echo-check        (N=60 songs)
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
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], mood = MOODS[(j + (j >> 3)) % MOODS.length], s = `rc-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloExpress: 'on', ...extra } as never).sections as any[] };
};
const live = (hits: any[]) => hits.filter((h) => !h.mute && h.notes.length).map((h) => ({ ...h, t: h.step + (h.shift ?? 0) })).sort((a, b) => a.t - b.t);
const same = (a: any, b: any) => a.t === b.t && a.len === b.len && J(a.notes) === J(b.notes) && a.art === b.art && a.slide === b.slide && a.trill === b.trill;
/** The notes inside a window: their onsets from its start, and the steps between their pitches. */
const inWin = (xs: any[], t0: number, t1: number) => xs.filter((h) => h.t >= t0 - 0.01 && h.t < t1 - 0.01);
const steps = (xs: any[]) => xs.slice(1).map((h, k) => Math.sign(h.notes[0] - xs[k].notes[0]));

const T = { songs: 0, solos: 0, echoSolos: 0, answers: 0, sig: 0, sigSolos: 0, notes: 0, kept: 0, pairs: 0, sameRhythm: 0, sameWay: 0, sameWayN: 0, outside: 0, outsideN: 0 };
for (let j = 0; j < N; j++) {
  const off = build(j, {}), off2 = build(j, { soloEcho: 'off' }), on = build(j, { soloEcho: 'on' }), again = build(j, { soloEcho: 'on' });
  T.songs++;
  if (J(off.secs) !== J(off2.secs)) fail(`${off.s}: "Off" changed the track`);
  if (J(on.secs) !== J(again.secs)) fail(`${off.s}: not the same twice`);
  on.secs.forEach((sec, si) => {
    const was = off.secs[si];
    if (!sec.section?.solo) { if (J(sec) !== J(was)) fail(`${off.s}: section ${si} is not a solo but changed`); return; }
    T.solos++;
    const s6 = 15000 / sec.song.bpm / 1000;
    const a = live(was.guitar2), b = live(sec.guitar2);
    const has = (xs: any[], l: any) => xs.some((h) => Math.abs(h.t - l.step) < 0.26 && (h.notes[0] === l.midi || h.notes[0] - (h.lateBend ?? 0) === l.midi));
    for (const l of was.soloCurve?.landings ?? []) if (has(a, l) && !has(b, l)) fail(`${off.s}: landing ${l.step} (${l.midi}) lost`);
    const endOf = (xs: any[]) => Math.max(...xs.map((h) => h.t + h.len));
    if (Math.abs(endOf(a) - endOf(b)) > 0.01) fail(`${off.s}: the solo ends at another time`);
    for (let k = 1; k < b.length; k++) {
      const gap = b[k].t - (b[k - 1].t + b[k - 1].len);
      if (gap < -0.26) fail(`${off.s}: overlap at ${b[k].t}`);
      const fast = b[k - 1].trill || b[k - 1].tremolo || b[k].tremolo;
      const ms = (b[k].t - b[k - 1].t) * s6 * 1000;
      if (!fast && ms < 38) fail(`${off.s}: ${ms.toFixed(0)} ms between two notes at ${b[k].t}`);
    }
    // nothing changes outside the windows that play another's figure
    const echo: { from: number; fromEnd: number; t0: number; t1: number; via: string }[] = sec.soloCurve?.echo ?? [];
    const inEcho = (t: number) => echo.some((e) => t >= e.t0 - 0.01 && t < e.t1 - 0.01);
    const outA = a.filter((h) => !inEcho(h.t)), outB = b.filter((h) => !inEcho(h.t));
    // (the hands read the line in order, so a window the checker had sent back may now pass, or the other way round: a few notes at most)
    T.outsideN += outA.length;
    T.outside += outA.filter((h) => !outB.some((x) => same(x, h))).length;
    T.notes += b.length;
    T.kept += b.filter((h) => a.some((x) => same(x, h))).length;
    const m = /echo: (\d+) answer windows play their call again(?:, the signature figure comes back (\d+) times?)?/.exec(J(sec));
    if (!m) { fail(`${off.s}: no echo line on the card`); return; }
    if (+m[1] !== echo.filter((e) => e.via === 'answer').length) fail(`${off.s}: the card and the curve disagree`);
    T.answers += +m[1]; T.sig += +(m[2] ?? 0);
    if (+m[1]) T.echoSolos++;
    if (+(m[2] ?? 0)) T.sigSolos++;
    // a copy plays its source's figure: the same quickest note (a run at the same speed), and mostly the same way up or down
    for (const e of echo) {
      if (e.t1 - e.t0 < 2 || echo.some((x) => x.t0 === e.from)) continue; // (a source that was itself a copy: its own check covers it)
      const xs = inWin(b, e.t0, e.t1), ys = inWin(b, e.from, e.fromEnd);
      if (xs.length < 3 || ys.length < 3) continue; // (a goal note's dress is not a run)
      T.pairs++;
      if (Math.min(...xs.map((h) => h.len)) === Math.min(...ys.map((h) => h.len))) T.sameRhythm++;
      if (xs.length === ys.length) { T.sameWayN++; if (J(steps(xs)) === J(steps(ys))) T.sameWay++; }
    }
  });
}
// with the recast and the bend dials on too: still playable, goal notes kept
let every = 0;
for (let j = 0; j < N; j += 2) {
  const off = build(j, {}), all = build(j, { soloEcho: 'on', soloRecast: 'on', soloBends: 'dials' });
  all.secs.forEach((sec, si) => {
    const was = off.secs[si];
    if (!sec.section?.solo) return;
    every++;
    const s6 = 15000 / sec.song.bpm / 1000;
    const a = live(was.guitar2), b = live(sec.guitar2);
    const has = (xs: any[], l: any) => xs.some((h) => Math.abs(h.t - l.step) < 0.26 && (h.notes[0] === l.midi || h.notes[0] - (h.lateBend ?? 0) === l.midi));
    for (const l of was.soloCurve?.landings ?? []) if (has(a, l) && !has(b, l)) fail(`${off.s}: (all on) landing ${l.step} (${l.midi}) lost`);
    for (let k = 1; k < b.length; k++) {
      if (b[k].t - (b[k - 1].t + b[k - 1].len) < -0.26) fail(`${off.s}: (all on) overlap at ${b[k].t}`);
      const fast = b[k - 1].trill || b[k - 1].tremolo || b[k].tremolo;
      if (!fast && (b[k].t - b[k - 1].t) * s6 * 1000 < 38) fail(`${off.s}: (all on) two notes too close at ${b[k].t}`);
    }
  });
}
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
console.log(`${T.songs} songs, ${T.solos} solos (${T.echoSolos} with answers that echo, ${T.sigSolos} with a signature); echo windows: ${T.answers} answers, ${T.sig} signature`);
console.log(`notes as the plan had them: ${pct(T.kept, T.notes)}% of ${T.notes}; outside the echo windows, notes changed: ${T.outside} of ${T.outsideN}; echo runs at their source's speed: ${pct(T.sameRhythm, T.pairs)}% of ${T.pairs}; same way up and down: ${pct(T.sameWay, T.sameWayN)}% of ${T.sameWayN}`);
if (T.outside > T.outsideN * 0.02) fail('the echo changes the solo outside its windows');
if (!T.answers || !T.sig) fail('an echo of a kind never turns up');
if (T.solos > 5 && T.echoSolos < T.solos * 0.3) fail(`only ${T.echoSolos} of ${T.solos} solos echo`);
if (T.pairs && T.sameRhythm / T.pairs < 0.85) fail('the copies do not play their source\'s speed');
console.log(`with the recast and the dials on too: ${every} solos playable`);
console.log(bad ? `${bad} FAIL` : 'solo echo ok');
process.exit(bad ? 1 : 0);
