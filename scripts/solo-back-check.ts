// Checks Solo backing (docs/SOLO-BACKING.md, src/sections/soloback.ts) on tracks of all genres and meters:
//  - As written (and a link without the option): nothing changes;
//  - Held: only the solo sections change (the bars next to them may, for the hand-over: a push, a build); every other section is note for note the same;
//  - in a solo the chord changes are the song's own (the same progression as without the switch, before the last bar's hand-over);
//  - the rhythm guitar and the bass play only where the chord is struck (riff songs: a power chord there), every strike is on a chord;
//  - (built with Solo expression on, the way it is meant to be used)
//  - the solo is still a solo (notes, in range, no overlaps), and the same seed gives the same track.
//   npm run solo-back-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[j % METERS.length], s = `bk-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, genre, meter, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', soloPlan: 'tune', soloExpress: 'on', ...extra } as never).sections as any[] };
};
const J = JSON.stringify;

const T = { songs: 0, solos: 0, chords: 0, riff: 0, strikes: 0, mutedWrong: 0 };
for (let j = 0; j < N; j++) {
  const base = build(j, {}), written = build(j, { soloBacking: 'written' }), held = build(j, { soloBacking: 'held' }), again = build(j, { soloBacking: 'held' });
  T.songs++;
  if (J(base.secs) !== J(written.secs)) fail(`${base.s}: "As written" changed the track`);
  if (J(held.secs) !== J(again.secs)) fail(`${base.s}: not the same twice`);
  held.secs.forEach((sec, si) => {
    const was = base.secs[si];
    if (!sec.section?.soloBack) {
      const near = [si - 1, si + 1].some((k) => held.secs[k]?.section?.soloBack);
      if (!near && J(sec) !== J(was)) fail(`${base.s}: section ${si} (${sec.section?.label}) is not a held solo but changed`);
      return;
    }
    T.solos++;
    const { song, chords } = sec, tl = chords.timeline, back = sec.section.soloBack;
    T.chords += tl.length;
    // (the last bar is the hand-over to the next section: a push, band hits, a ring-out; the checks stop before it)
    const lastBar = song.bars[song.bars.length - 1], upto = lastBar.start;
    const ch = (t: any[], upto2: number) => J(t.filter((e: any) => e.step < upto2).map((e: any) => [e.step, e.chord]));
    if (ch(tl, upto) !== ch(was.chords.timeline, upto)) fail(`${base.s}: the progression changed`);
    for (let g = 0; g < upto; g++) if (tl[chords.chordIdx[g]].step > g || (tl[chords.chordIdx[g] + 1]?.step ?? song.total) <= g) { fail(`${base.s}: chordIdx wrong at ${g}`); break; }
    const strikes = new Set<number>(back.strikes);
    if (!strikes.has(0)) fail(`${base.s}: no strike on the first beat`);
    tl.forEach((ev: any) => { if (ev.step < upto && !strikes.has(ev.step)) fail(`${base.s}: chord at ${ev.step} not struck`); });
    T.strikes += strikes.size;
    const riff = !!(sec.guitar && song.tuning);
    if (riff) T.riff++;
    for (let g = 0; g < upto; g++) {
      const on = strikes.has(g);
      // (the first bar can be a hand-over: a stop before the solo has the band come back in on the next downbeat)
      if (!on && g > song.bars[0].len && (sec.strum[g] !== '.' || sec.bass[g])) { T.mutedWrong++; fail(`${base.s}: rhythm or bass plays off a strike at ${g}`); break; }
      // (step 0 can be given away: the bar before pushed this chord in early)
      if (on && g && !sec.bass[g]) { fail(`${base.s}: no bass root on a strike at ${g}`); break; }
    }
    if (riff) {
      const hits = sec.guitar.filter((h: any) => h.step < upto);
      for (const h of hits) if (!strikes.has(h.step) || h.notes.length < 2) fail(`${base.s}: riff hit off a strike or not a chord at ${h.step}`);
      if (hits.length > [...strikes].filter((g) => g < upto).length) fail(`${base.s}: ${hits.length} riff hits for ${strikes.size} strikes`);
    } else if (!sec.strum.some((x: string) => x === 'D')) fail(`${base.s}: no strum`);
    // still a solo
    const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step);
    if (hits.length < 6) fail(`${base.s}: the solo has ${hits.length} notes`);
    hits.forEach((h: any, k: number) => {
      if (h.notes[0] < 50 || h.notes[0] > 90) fail(`${base.s}: note ${h.notes[0]} out of range`);
      const nx = hits[k + 1];
      if (nx && h.step + (h.shift ?? 0) + h.len > nx.step + (nx.shift ?? 0) + 1 / 12 + 1e-6) fail(`${base.s}: overlap at ${h.step}`);
    });
  });
}
console.log(`${T.songs} songs, ${T.solos} held solos (${T.riff} riff); ${(T.chords / Math.max(1, T.solos)).toFixed(1)} chords per solo; ${T.strikes} strikes`);
if (T.solos < N / 2) fail(`only ${T.solos} held solos in ${N} songs`);
console.log(bad ? `${bad} FAIL` : 'solo backing ok');
process.exit(bad ? 1 : 0);
