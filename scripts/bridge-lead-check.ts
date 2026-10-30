// Checks Lead in bridges and breakdowns (docs/BRIDGE-LEAD.md, src/track.ts bridgeLead) on tracks of all genres, moods and meters:
//  - Off (and a link without the option): nothing changes;
//  - On: only bridges and breakdowns change, and only where Guitar 2 had a melodic line (the other sections are note for note the same);
//  - such a section is marked (`leadSolo`), has a lead line (notes in range, no overlaps) and the drummer fills under it;
//  - the same seed gives the same track.
//   npm run bridge-lead-check        (N=160 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 160);
const GENRES = ['altmetal', 'metal', 'hardrock', 'rock', 'grunge', 'funk', 'pop'];
const METERS = ['4/4', '4/4', '4/4', '4/4', '3/4', '6/8', '7/8', 'mixed'];
const MOODS = ['auto', 'happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const J = JSON.stringify;

const build = (j: number, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], meter = METERS[(j >> 1) % METERS.length], s = `bl-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, bpm: 100 + (j % 5) * 10, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return { s, secs: buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'auto', soloPlan: 'tune', soloExpress: 'on', mood: MOODS[j % MOODS.length], ...extra } as never).sections as any[] };
};

const T = { songs: 0, candidates: 0, led: 0, filled: 0, fillable: 0, byGenre: {} as Record<string, number> };
for (let j = 0; j < N; j++) {
  const base = build(j, {}), off = build(j, { bridgeLead: 'off' }), on = build(j, { bridgeLead: 'on' }), again = build(j, { bridgeLead: 'on' });
  T.songs++;
  if (J(base.secs) !== J(off.secs)) fail(`${base.s}: "Off" changed the track`);
  if (J(on.secs) !== J(again.secs)) fail(`${base.s}: not the same twice`);
  on.secs.forEach((sec, si) => {
    const was = base.secs[si], kind = sec.section.kind;
    const bb = kind === 'bridge' || kind === 'breakdown';
    if (bb) T.candidates++;
    if (!sec.section.leadSolo) {
      // (the section before it may hand over into the lead line: the pickup notes into the next section)
      const before = !!on.secs[si + 1]?.section.leadSolo;
      if (!before && J(sec) !== J(was)) fail(`${base.s}: section ${si} (${kind}) is not a lead-line one but changed`);
      return;
    }
    if (!bb) { fail(`${base.s}: a lead line in a ${kind}`); return; }
    T.led++;
    const g = sec.song.partGenres.strum; T.byGenre[g] = (T.byGenre[g] ?? 0) + 1;
    const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step);
    if (!sec.section.lead) fail(`${base.s}: lead line not marked as lead`);
    if (sec.section.solo) fail(`${base.s}: a lead line marked as a solo`);
    // (the song may have no lead guitar at all: then the line is gone and there is nothing more to check)
    if (!hits.length) return;
    if (hits.length < 3) fail(`${base.s}: the lead line has ${hits.length} notes`);
    hits.forEach((h: any, k: number) => {
      if (h.notes[0] < 48 || h.notes[0] > 92) fail(`${base.s}: note ${h.notes[0]} out of range`);
      const nx = hits[k + 1];
      if (nx && h.step + (h.shift ?? 0) + h.len > nx.step + (nx.shift ?? 0) + 1 / 12 + 1e-6) fail(`${base.s}: overlap at ${h.step}`);
    });
    // the drummer: a fill at the end of a phrase (a bar 4, 8... that is not the last), where the guitar is not busy
    const n = sec.song.bars.length;
    if (n >= 8) { T.fillable++; if (sec.drums.fills.some((f: any) => f.bar < n - 1)) T.filled++; }
    // the band keeps its own hats: no hat turned to ride
    const rideBefore = was.drums.ride.filter(Boolean).length, rideNow = sec.drums.ride.filter(Boolean).length;
    if (rideNow > rideBefore) fail(`${base.s}: the drummer moved to the ride under a lead line`);
  });
}
console.log(`${T.songs} songs, ${T.candidates} bridges and breakdowns, ${T.led} with a lead line written as a solo (${J(T.byGenre)}); of ${T.fillable} of 8+ bars, ${T.filled} have a fill inside`);
if (T.led < 5) fail(`only ${T.led} lead lines in ${N} songs`);
if (T.filled < T.fillable * 0.6) fail(`only ${T.filled} of ${T.fillable} lead lines have a drum fill under them`);
console.log(bad ? `${bad} FAIL` : 'bridge lead ok');
process.exit(bad ? 1 : 0);
