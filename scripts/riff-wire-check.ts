// Checks Riff writer in tracks (docs/RIFF-WIRE.md): the riff lab's writer plays the riffs of a track when asked.
//  - Switch off (classic, missing, a wrong value): the track is the one it was.
//  - Switch on, a 4/4 riff: the idea's riff is the writer's (every style, picked and arpeggio too), best of 24;
//    odd meters: the classic riff, hit for hit.
//  - The same seeds give the same track; every riff genre builds whole tracks; the drums and bass follow the new riff.
//   npm run riff-wire-check        (N=30 songs a genre)
import { MAIN_GUITARS, buildIdea, generate, withSheet } from '../src/generator';
import { GENRES, GENRE_LIST } from '../src/genres';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 30);
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const RIFF = GENRE_LIST.filter((g) => GENRES[g].riff);

const seeds = (s: string) => ({ song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
const make = (g: string, j: number, meter = '4/4') => generate({ genre: g, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, seeds(`rw-${j}-${g}`));
const hitsSig = (hs: any[] | undefined) => (hs ?? []).map((h) => `${h.step}:${h.len}:${h.notes.join('.')}:${h.mute ?? ''}`).join(',');
const trackSig = (t: any) => t.sections.map((s: any) => `${s.section.kind}|${hitsSig(s.guitar)}|${s.bass?.length}|${s.drums?.kick?.join?.('') ?? ''}`).join('/');
const isNew = (i: any) => i.notes.some((n: string) => n.includes('a written riff'));
/** The idea as the track builds it, with the new writer asked for or not. */
const idea = (src: any, on: boolean) => {
  const song = { ...src.song, noTacet: true, ...(on ? { newRiff: true } : {}) };
  return buildIdea(src.opts, src.seeds, song, withSheet(src.opts, src.seeds, song));
};

let ideas = 0, wrote = 0, odd = 0, oddKept = 0, tracks = 0, trackNew = 0, secs = 0, hitsN = 0;
const styleSeen = new Set<string>();
for (const g of RIFF) for (let j = 0; j < N; j++) {
  const src = make(g, j);
  const s = src.song.sections!;
  const classic = idea(src, false), fresh = idea(src, true), again = idea(src, true);
  ideas++;
  if (hitsSig(fresh.guitar) !== hitsSig(again.guitar)) fail(`${g} ${j}: the same seeds gave a different riff`);
  if (isNew(classic)) fail(`${g} ${j}: the classic riff says it is written by the new writer`);
  wrote++;
  styleSeen.add(s[0]); styleSeen.add(s[4]);
  if (!isNew(fresh)) fail(`${g} ${j}: ${s[0]}/${s[4]} should be written by the new writer but the classic riff played`);
  if (!fresh.guitar?.length) fail(`${g} ${j}: the new riff has no hits`);
  if (!fresh.bass.length) fail(`${g} ${j}: the bass is missing`);
  // odd meters keep the classic riff
  if (j < 4) {
    const o = make(g, j, '6/8');
    if (o.song.sections) {
      odd++;
      const a = idea(o, true), b = idea(o, false);
      if (!isNew(a) && hitsSig(a.guitar) === hitsSig(b.guitar)) oddKept++;
      else fail(`${g} ${j}: a 6/8 riff is not the classic one`);
    }
  }
}

// whole tracks: switch off is the track as it was; on builds, the same twice, and its riffs play
for (const g of RIFF) for (let j = 0; j < Math.min(N, 12); j++) {
  const src = make(g, j);
  const was = trackSig(buildTrack(src));
  for (const v of ['classic', undefined, 'nonsense'] as const) {
    if (trackSig(buildTrack(src, { ...defaultTrackOptions(src), riffWriter: v as never })) !== was) fail(`${g} ${j}: riffWriter ${v} is not the track as it was`);
  }
  const o = { ...defaultTrackOptions(src), riffWriter: 'new' as const };
  const t = buildTrack(src, o), t2 = buildTrack(src, o);
  tracks++;
  if (trackSig(t) !== trackSig(t2)) fail(`${g} ${j}: the same track twice is not the same`);
  // (a track's section notes are its own, so "written by the new writer" shows as different guitar hits)
  if (trackSig(t) !== was) trackNew++;
  for (const sec of t.sections) {
    secs++;
    for (const h of sec.guitar ?? []) {
      hitsN++;
      if (!Number.isInteger(h.step) || h.step < 0 || !Number.isInteger(h.len) || h.len < 1 || !h.notes.length) fail(`${g} ${j}: a bad hit in ${sec.section!.kind}: ${JSON.stringify(h)}`);
    }
  }
}

console.log(`${ideas} ideas: the writer wrote ${wrote}; ${oddKept} of ${odd} 6/8 riffs kept classic`);
console.log('styles in the songs: ' + [...styleSeen].sort().join(', '));
for (const st of ['picked', 'arp']) if (!styleSeen.has(st)) fail(`no song has a ${st} half`);
console.log(`${tracks} tracks built with the switch on (${trackNew} with the new writer's riffs in it), ${secs} sections, ${hitsN} guitar hits`);
if (!wrote) fail('the writer never wrote a riff');
if (!trackNew) fail('no track has the new writer in it');
console.log(bad ? `${bad} problems` : 'all good');
process.exit(bad ? 1 : 0);
