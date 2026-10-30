// Checks Solo variation (docs/SOLO-VARY.md, src/sections/solovary.ts) on tracks of all genres, moods and meters:
//  - Off (and a link without the option): nothing changes;
//  - On: only solos of 16 bars or more get a stretch; it is 4 or 8 bars, on a four-bar phrase, never the first four bars;
//  - sections other than the solo (and the bars next to it, for the hand-over) are note for note the same;
//  - the drums really change over the stretch (breakdown: no snare, no ride, hats on the beats only; heavy half-time: one snare, on the 3rd beat);
//  - held chords: the rhythm guitar and the bass play only on the strikes in the stretch, and are as before outside it;
//  - the other section's chords: the progression stays a valid one (every step has its chord);
//  - the solo is still a solo (notes, in range, no overlaps) and the same seed gives the same track.
//   npm run solo-vary-check        (N=120 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 120);
const GENRES = ['metal', 'hardrock', 'rock', 'grunge', 'altmetal', 'funk', 'pop'];
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
const MOODS = ['auto', 'happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[(j >> 1) % METERS.length], s = `vy-${j}-${genre}`;
  // (fast songs, so the long solos come up often)
  const idea = generate({ genre, meter, weirdness: 0.3, bpm: 112 + (j % 5) * 12, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, genre, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', soloPlan: 'tune', soloExpress: 'on', mood: MOODS[j % MOODS.length], ...extra } as never).sections as any[] };
};
const J = JSON.stringify;

const T = { songs: 0, soloSecs: 0, longSolos: 0, long: 0, pairs: 0, long24: 0, varied: 0, drums: { light: 0, half: 0, same: 0 } as Record<string, number>, chords: { other: 0, held: 0, same: 0 } as Record<string, number>, otherDiffers: 0, spans: {} as Record<string, number>, heldRiff: 0 };
for (let j = 0; j < N; j++) {
  const base = build(j, {}), off = build(j, { soloVary: 'off' }), on = build(j, { soloVary: 'on' }), again = build(j, { soloVary: 'on' });
  T.songs++;
  if (J(base.secs) !== J(off.secs)) fail(`${base.s}: "Off" changed the track`);
  if (J(on.secs) !== J(again.secs)) fail(`${base.s}: not the same twice`);
  on.secs.forEach((sec, si) => {
    const was = base.secs[si], vs = sec.section?.soloVary as any[] | undefined;
    const isSolo = sec.section?.kind === 'solo';
    if (isSolo) { T.soloSecs++; if (sec.song.bars.length >= 16) T.longSolos++; if (sec.song.bars.length >= 24) T.long24++; }
    if (!vs) {
      const near = [si - 1, si + 1].some((k) => on.secs[k]?.section?.soloVary);
      if (!near && J(sec) !== J(was)) fail(`${base.s}: section ${si} (${sec.section?.label}) has no stretch but changed`);
      return;
    }
    const { song } = sec, bars = song.bars, n = bars.length;
    if (!isSolo) { fail(`${base.s}: a stretch in a ${sec.section.kind}`); return; }
    if (n < 16) { fail(`${base.s}: a stretch in a ${n}-bar solo`); return; }
    T.long++; T.varied++;
    if (vs.length > (n >= 24 ? 2 : 1)) fail(`${base.s}: ${vs.length} stretches in ${n} bars`);
    if (vs.length === 2) {
      T.pairs++;
      if (vs[1].from - vs[0].to < 4) fail(`${base.s}: stretches ${vs[0].from}-${vs[0].to} and ${vs[1].from}-${vs[1].to} too close`);
      // (a song that is not in 4/4 has the breakdown only)
      if (vs[0].drums === vs[1].drums && vs[0].drums !== 'same' && song.bars.every((b: any) => b.len === 16 && b.groups.length === 4)) fail(`${base.s}: both stretches change the drums the same way`);
      if (vs.filter((x: any) => x.chords === 'held').length > 1) fail(`${base.s}: two held stretches`);
    }
    for (const v of vs) {
    T.drums[v.drums]++; T.chords[v.chords]++;
    T.spans[`${v.from}-${v.to}`] = (T.spans[`${v.from}-${v.to}`] ?? 0) + 1;
    const len = v.to - v.from;
    if (len !== 4 && len !== 8) fail(`${base.s}: stretch of ${len} bars`);
    if (v.from % 4 || v.from < 4 || v.to > n) fail(`${base.s}: stretch ${v.from}-${v.to} of ${n} bars is out of place`);
    if (v.drums === 'same' && v.chords === 'same') fail(`${base.s}: a stretch that changes nothing`);
    const at = bars[v.from].start, end = v.to >= n ? song.total : bars[v.to].start, d = sec.drums;
    const filled = new Set(d.fills.map((f: any) => f.bar));
    const inside = bars.map((b: any, i: number) => ({ b, i })).filter(({ i }: any) => i >= v.from && i < v.to && i < n - 1 && !filled.has(i));
    // drums
    if (v.drums === 'light') {
      for (const { b, i } of inside) {
        for (let g = b.start; g < b.start + b.len; g++) {
          if (d.ride[g]) { fail(`${base.s}: ride in a lighter bar ${i}`); break; }
          if (d.crash[g] && g !== at) { fail(`${base.s}: crash in a lighter bar ${i} at ${g}`); break; }
        }
        if (!d.hat.slice(b.start, b.start + b.len).some(Boolean) && b.len > 4) fail(`${base.s}: no hats in a lighter bar ${i}`);
        // a breakdown: no snare, and hats on the beats only
        if (d.snare.slice(b.start, b.start + b.len).some(Boolean)) fail(`${base.s}: snare in a breakdown bar ${i}`);
        let at0 = 0; const beatSteps = new Set<number>(); for (const w of b.groups) { beatSteps.add(b.start + at0); at0 += w; }
        for (let g = b.start; g < b.start + b.len; g++) if (d.hat[g] && !beatSteps.has(g)) { fail(`${base.s}: an off-beat hat in a breakdown bar ${i}`); break; }
      }
    } else if (v.drums === 'half') {
      // heavy half-time: one snare, on the 3rd beat (the bars that are not 4/4 fall back to the breakdown)
      let half = 0;
      for (const { b } of inside) if (d.snare[b.start + 8] >= 0.5 && d.snare[b.start + 4] < 0.5 && d.snare[b.start + 12] < 0.5) half++;
      for (const { b, i } of inside) {
        if (d.snare[b.start + 8] >= 0.5) {
          const n = d.snare.slice(b.start, b.start + b.len).filter((x: number) => x > 0).length;
          if (n !== 1) fail(`${base.s}: ${n} snares in a heavy half-time bar ${i}`);
        }
      }
      if (inside.length && half < inside.length * 0.5) fail(`${base.s}: half-time stretch but only ${half} half-time bars of ${inside.length}`);
    }
    // chords
    const tl = sec.chords.timeline;
    for (let g = 0; g < song.total; g++) {
      const e = tl[sec.chords.chordIdx[g]];
      if (!e || e.step > g || (tl[sec.chords.chordIdx[g] + 1]?.step ?? song.total) <= g) { fail(`${base.s}: chordIdx wrong at ${g}`); break; }
    }
    if (v.chords === 'other') {
      const sig = (s: any, a: number, b: number) => J(s.chords.timeline.filter((e: any) => e.step >= a && e.step < b).map((e: any) => [e.step, e.chord]));
      if (sig(sec, at, end) !== sig(was, at, end)) T.otherDiffers++;
      if (v === vs[0] && sig(sec, 0, at) !== sig(was, 0, at)) fail(`${base.s}: chords before the stretch changed`);
    }
    if (v.chords === 'held') {
      const back = sec.section.soloBack, strikes = new Set<number>(back?.strikes ?? []);
      if (!back || back.from !== at || back.to !== end) fail(`${base.s}: held stretch without its plan`);
      if (!strikes.has(at)) fail(`${base.s}: no strike at the start of the held stretch`);
      for (const e of tl) if (e.step >= at && e.step < end && !strikes.has(e.step)) fail(`${base.s}: chord at ${e.step} not struck`);
      const riff = !!(sec.guitar && song.tuning);
      if (riff) T.heldRiff++;
      // (the last bar is the hand-over to the next section: a push, band hits, a ring-out; the checks stop before it)
      const upto = Math.min(end, bars[n - 1].start);
      for (let g = at; g < upto; g++) {
        if (!strikes.has(g) && (sec.strum[g] !== '.' || sec.bass[g])) { fail(`${base.s}: rhythm or bass plays off a strike at ${g}`); break; }
        if (strikes.has(g) && !sec.bass[g]) { fail(`${base.s}: no bass root on a strike at ${g}`); break; }
      }
      if (riff) for (const h of sec.guitar) if (h.step >= at && h.step < upto && !strikes.has(h.step)) { fail(`${base.s}: riff hit off a strike at ${h.step}`); break; }
      // outside the stretch it is as before (the first bar and the hand-over bar can move; with two stretches the other may differ)
      if (vs.length === 1) {
      const lastStart = bars[n - 1].start, first = bars[0].len;
      for (let g = first; g < Math.min(at, lastStart); g++) {
        if (sec.strum[g] !== was.strum[g] || (sec.bass[g] || 0) !== (was.bass[g] || 0)) { fail(`${base.s}: rhythm or bass before the stretch changed at ${g}`); break; }
      }
      if (end < lastStart) for (let g = end; g < lastStart; g++) {
        if (sec.strum[g] !== was.strum[g] || (sec.bass[g] || 0) !== (was.bass[g] || 0)) { fail(`${base.s}: rhythm or bass after the stretch changed at ${g}`); break; }
      }
      }
    }
    }
    // still a solo
    const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step);
    if (hits.length < 10) fail(`${base.s}: the solo has ${hits.length} notes`);
    hits.forEach((h: any, k: number) => {
      if (h.notes[0] < 48 || h.notes[0] > 92) fail(`${base.s}: note ${h.notes[0]} out of range`);
      const nx = hits[k + 1];
      if (nx && h.step + (h.shift ?? 0) + h.len > nx.step + (nx.shift ?? 0) + 1 / 12 + 1e-6) fail(`${base.s}: overlap at ${h.step}`);
    });
  });
}
console.log(`${T.songs} songs, ${T.soloSecs} solo sections, ${T.longSolos} of 16+ bars, ${T.long} with a stretch (${T.long24} solos of 24+ bars, ${T.pairs} with two)`);
if (T.long < T.longSolos * 0.6) fail(`only ${T.long} of ${T.longSolos} long solos got a stretch`);
console.log('drums', J(T.drums), 'chords', J(T.chords), `(other differs: ${T.otherDiffers}; held riff: ${T.heldRiff})`);
console.log('spans', J(T.spans));
if (T.long < N / 6) fail(`only ${T.long} stretches in ${N} songs`);
console.log(bad ? `${bad} FAIL` : 'solo variation ok');
process.exit(bad ? 1 : 0);
