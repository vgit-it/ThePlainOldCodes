// Checks the Solo amount (docs/SOLO-AMOUNT.md, `amount` in src/parts/soloexpress.ts) on Tune first solos with Solo expression on, all genres and meters:
//  - Normal (and a link without the option) is exactly what it was;
//  - the same seed gives the same track for every amount;
//  - Light leaves more of the tune as written than Normal, and Full less (averaged over all the solos);
//  - the goal notes of the tune are kept, nothing outside the solos changes, the line is playable, with echo, recast and dials on too;
//  - the card names the amount.
//   npm run solo-amount-check        (N=60 songs)
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
/** Checks one built track against the plain tune: landings, ends, overlaps, hand speed. Returns the share of notes still as the tune had them. */
const look = (tag: string, s: string, sec: any, was: any, tot: { n: number; kept: number }, tune?: any) => {
  const s6 = 15000 / sec.song.bpm / 1000;
  const a = live(was.guitar2), b = live(sec.guitar2);
  const has = (xs: any[], l: any) => xs.some((h) => Math.abs(h.t - l.step) < 0.26 && (h.notes[0] === l.midi || h.notes[0] - (h.lateBend ?? 0) === l.midi));
  // (the goal notes of the phrases; a 'mid' core note may sit inside a held window, as it always could. The last note is left out: the hand-over
  // to the next section may bend it to a chord note of that section, whatever the amount)
  const lastStep = Math.max(...(was.soloCurve?.landings ?? []).map((x: any) => x.step));
  for (const l of (was.soloCurve?.landings ?? []).filter((x: any) => ['call', 'answer', 'climax', 'end'].includes(x.role) && x.step < lastStep)) if (has(a, l) && !has(b, l)) fail(`${s}: (${tag}) landing ${l.step} (${l.midi}) lost`);
  for (let k = 1; k < b.length; k++) {
    if (b[k].t - (b[k - 1].t + b[k - 1].len) < -0.26) fail(`${s}: (${tag}) overlap at ${b[k].t}`);
    const fast = b[k - 1].trill || b[k - 1].tremolo || b[k].tremolo;
    if (!fast && (b[k].t - b[k - 1].t) * s6 * 1000 < 38) fail(`${s}: (${tag}) two notes too close at ${b[k].t}`);
  }
  // (the tune's notes: the ones the plain build has, and how many of them are still there untouched)
  const t = live((tune ?? was).guitar2);
  tot.n += t.length;
  tot.kept += t.filter((h) => b.some((x) => same(x, h))).length;
};

const T = { solos: 0 };
const tot = { normal: { n: 0, kept: 0 }, light: { n: 0, kept: 0 }, full: { n: 0, kept: 0 } };
for (let j = 0; j < N; j++) {
  const base = build(j, { soloExpress: 'off' }), def = build(j, {}), normal = build(j, { soloAmount: 'normal' });
  const light = build(j, { soloAmount: 'light' }), full = build(j, { soloAmount: 'full' });
  if (J(def.secs) !== J(normal.secs)) fail(`${def.s}: "Normal" changed the track`);
  if (J(light.secs) !== J(build(j, { soloAmount: 'light' }).secs)) fail(`${def.s}: Light is not the same twice`);
  if (J(full.secs) !== J(build(j, { soloAmount: 'full' }).secs)) fail(`${def.s}: Full is not the same twice`);
  def.secs.forEach((sec, si) => {
    if (!sec.section?.solo) return;
    T.solos++;
    // (landings are kept as the Normal build has them; the share is counted against the tune as written)
    look('normal', def.s, sec, def.secs[si], tot.normal, base.secs[si]);
    look('light', def.s, light.secs[si], def.secs[si], tot.light, base.secs[si]);
    look('full', def.s, full.secs[si], def.secs[si], tot.full, base.secs[si]);
    if (!/Solo expression \([^)]*light\)/.test(J(light.secs[si]))) fail(`${def.s}: the card does not say light`);
    if (!/Solo expression \([^)]*full\)/.test(J(full.secs[si]))) fail(`${def.s}: the card does not say full`);
  });
}
// every switch on at once, light and full: still playable, goal notes kept
for (let j = 0; j < N; j += 3) {
  const base = build(j, {});
  for (const amount of ['light', 'full']) {
    const all = build(j, { soloAmount: amount, soloEcho: 'on', soloRecast: 'on', soloBends: 'dials' });
    all.secs.forEach((sec, si) => { if (sec.section?.solo) look(`${amount}, all on`, all.s, sec, base.secs[si], { n: 0, kept: 0 }); });
  }
}
const pct = (x: { n: number; kept: number }) => (x.n ? Math.round((1000 * x.kept) / x.n) / 10 : 0);
console.log(`${N} songs, ${T.solos} solos; tune notes left as written: light ${pct(tot.light)}%, normal ${pct(tot.normal)}%, full ${pct(tot.full)}%`);
if (!(pct(tot.light) > pct(tot.normal) + 10)) fail('Light does not leave clearly more of the tune');
if (!(pct(tot.full) < pct(tot.normal))) fail('Full does not change more than Normal');
console.log(bad ? `${bad} FAIL` : 'solo amount ok');
process.exit(bad ? 1 : 0);
