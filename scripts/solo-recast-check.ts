// Checks the Solo recast (docs/SOLO-RECAST.md, src/parts/soloexpress.ts `recast`) on Tune first solos with Solo expression on, all genres and meters:
//  - Off (and a link without the option): nothing changes;
//  - On: the goal notes of the tune (the landings) are as they were, the last note ends where it did, nothing outside the solos changes;
//  - the line is still playable: no overlaps, a speed the hands can play at the tempo;
//  - it does what it says: library licks, legato rolls, pedal figures, trill climbs, slide-ins and held-note trills all turn up, in many solos,
//    and most of a solo is still as the plan had it (a seasoning, not a rewrite);
//  - a slide-in is never on a bent note, a held-note trill is on a long note;
//  - the same seed gives the same track.
//   npm run solo-recast-check        (N=60 songs)
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

const T = { songs: 0, solos: 0, changedSolos: 0, notes: 0, kept: 0, lick: 0, roll: 0, pedal: 0, trillClimb: 0, slideIn: 0, heldTrill: 0 };
for (let j = 0; j < N; j++) {
  const off = build(j, {}), off2 = build(j, { soloRecast: 'off' }), on = build(j, { soloRecast: 'on' }), again = build(j, { soloRecast: 'on' });
  T.songs++;
  if (J(off.secs) !== J(off2.secs)) fail(`${off.s}: "Off" changed the track`);
  if (J(on.secs) !== J(again.secs)) fail(`${off.s}: not the same twice`);
  on.secs.forEach((sec, si) => {
    const was = off.secs[si];
    if (!sec.section?.solo) { if (J(sec) !== J(was)) fail(`${off.s}: section ${si} is not a solo but changed`); return; }
    T.solos++;
    const s6 = 15000 / sec.song.bpm / 1000;
    const a = live(was.guitar2), b = live(sec.guitar2);
    // goal notes (the tune's landings) and the last note
    // (a landing the plain expression had kept: the recast must not lose it)
    const has = (xs: any[], l: any) => xs.some((h) => Math.abs(h.t - l.step) < 0.26 && (h.notes[0] === l.midi || h.notes[0] - (h.lateBend ?? 0) === l.midi));
    for (const l of was.soloCurve?.landings ?? []) if (has(a, l) && !has(b, l)) fail(`${off.s}: landing ${l.step} (${l.midi}) lost`);
    const endOf = (xs: any[]) => Math.max(...xs.map((h) => h.t + h.len));
    if (Math.abs(endOf(a) - endOf(b)) > 0.01) fail(`${off.s}: the solo ends at another time`);
    // playable: no overlap, a speed the hands can play
    for (let k = 1; k < b.length; k++) {
      const gap = b[k].t - (b[k - 1].t + b[k - 1].len);
      if (gap < -0.26) fail(`${off.s}: overlap at ${b[k].t}`);
      const fast = b[k - 1].trill || b[k - 1].tremolo || b[k].tremolo;
      const ms = (b[k].t - b[k - 1].t) * s6 * 1000;
      if (!fast && ms < 38) fail(`${off.s}: ${ms.toFixed(0)} ms between two notes at ${b[k].t}`);
    }
    for (const h of b) {
      // (a slide the plan already had, from the lead-in, is not the recast's)
      if (h.slide && (h.bend || h.lateBend || h.unbend) && !a.some((x) => x.t === h.t && x.slide)) fail(`${off.s}: a slide-in on a bent note at ${h.t}`);
      if (h.trill && h.len < 3 && !was.guitar2.some((x: any) => x.trill)) fail(`${off.s}: a trill on a note ${h.len} steps long at ${h.t}`);
    }
    if (J(a.map((h: any) => h.notes)) !== J(b.map((h: any) => h.notes)) || b.some((h, k) => !same(h, a[k]))) T.changedSolos++;
    T.notes += b.length;
    T.kept += b.filter((h) => a.some((x) => same(x, h))).length;
    const m = /recast: (\d+) licks, (\d+) legato rolls, (\d+) pedal figures, (\d+) trill climbs, (\d+) slide-ins, (\d+) held-note trills/.exec(J(sec));
    if (!m) fail(`${off.s}: no recast line on the card`);
    else { T.lick += +m[1]; T.roll += +m[2]; T.pedal += +m[3]; T.trillClimb += +m[4]; T.slideIn += +m[5]; T.heldTrill += +m[6]; }
  });
}
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
console.log(`${T.songs} songs, ${T.solos} solos (${T.changedSolos} recast); licks ${T.lick}, legato rolls ${T.roll}, pedal figures ${T.pedal}, trill climbs ${T.trillClimb}, slide-ins ${T.slideIn}, held trills ${T.heldTrill}`);
console.log(`notes as the plan had them: ${pct(T.kept, T.notes)}% of ${T.notes}`);
if (!T.lick || !T.roll || !T.pedal || !T.trillClimb || !T.slideIn || !T.heldTrill) fail('a kind of recast never turns up');
if (T.solos > 5 && T.changedSolos < T.solos * 0.6) fail(`only ${T.changedSolos} of ${T.solos} solos recast`);
if (T.notes && T.kept / T.notes < 0.45) fail('the recast rewrites more than half the solo');
console.log(bad ? `${bad} FAIL` : 'solo recast ok');
process.exit(bad ? 1 : 0);
