// Checks the story told in licks with the lick library (docs/SOLO-LIBRARY.md): "Chosen bars, story told in licks + the lick library".
//  - The cores and the story are the same as in "story plan only".
//  - No rest longer than a beat (4 16ths) from the start of the solo to the last core: the gaps are strung together.
//  - Notes are in the key and do not overlap; none after the last core.
//  - Named licks from the library turn up as recipes, and gaps get strung (pieces laid end to end); both are named on the card.
//  - The same seed plays the same. The step before ("recipes") is untouched by this switch (solo-recipes-check).
//   npm run solo-library-check        (N=100 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { SCALES } from '../src/theory';
import type { StoryGap, StoryPart } from '../src/idea';

const N = Number(process.env.N ?? 100);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
const BEAT = 4;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

type Land = { step: number; midi: number; len: number; role: string };
const play = (j: number, cores: 'story' | 'recipes' | 'library') => {
  const i = j >> 1, genre = GENRES[i % 7], meter = METERS[Math.floor(i / 7) % METERS.length], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `st-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, soloCores: cores } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({
    s, sec, lands: (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint') as Land[],
    story: (sec.soloCurve?.story ?? []) as StoryGap[], parts: (sec.soloCurve?.parts ?? []) as StoryPart[],
  }));
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.art ?? ''}`).join('|');
const landKey = (ls: Land[]) => ls.map((l) => `${l.step}:${l.midi}:${l.len}`).join('|');
const storyKey = (g: StoryGap[]) => g.map((x) => `${x.into}:${x.from}:${x.to}:${x.role}:${x.label}`).join('|');

let solos = 0, restsCut = 0, worst = 0, hitsN = 0, lickParts = 0, strungParts = 0, partsN = 0, lickNotes = 0;
const named = new Set<string>();
for (let i = 0; i < 2 * N; i++) {
  const a = play(i, 'library'), s0 = play(i, 'story');
  a.forEach((x, k) => {
    solos++;
    const { song } = x.sec, pcs = (SCALES[song.mode as keyof typeof SCALES] as readonly number[]).map((p) => (p + song.key) % 12);
    if (landKey(x.lands) !== landKey(s0[k].lands)) fail(`${x.s}: the cores are not the same as in 'story'`);
    if (storyKey(x.story) !== storyKey(s0[k].story)) fail(`${x.s}: the story is not the same as in 'story'`);
    const hits = (x.sec.guitar2 as any[]).slice().sort((p, q) => p.step - q.step);
    hitsN += hits.length;
    if (!x.lands.length) return;
    const endAt = x.lands[x.lands.length - 1].step;
    // rests: from the solo's start to the last core
    let cover = Math.min(x.parts.length ? x.parts[0].from : Infinity, hits[0].step);
    for (const h of hits) {
      if (h.step > endAt) break;
      const rest = h.step - cover;
      if (rest > worst) worst = rest;
      if (rest > BEAT) { restsCut++; fail(`${x.s}: a rest of ${rest} 16ths before step ${h.step}`); }
      cover = Math.max(cover, h.step + h.len);
    }
    const coreAt = new Set(x.lands.map((l) => l.step));
    for (const h of hits) if (h.step < endAt && !coreAt.has(h.step)) for (const m of h.notes) if (!pcs.includes(((m % 12) + 12) % 12)) fail(`${x.s}: a note off the key at ${h.step} (${m})`);
    for (let q = 0; q < hits.length - 2; q++) if (hits[q].step + hits[q].len > hits[q + 1].step) fail(`${x.s}: notes overlap at ${hits[q].step}`);
    for (const p of x.parts) {
      partsN++;
      const m = p.recipe.match(/the lick "([^"]+)"/g);
      if (m) { lickParts++; m.forEach((t) => named.add(t)); lickNotes += p.notes; }
      if (/^strung/.test(p.recipe)) strungParts++;
    }
  });
  if (i % 5 === 0 && key(a[0].sec) !== key(play(i, 'library')[0].sec)) fail(`song ${i}: not the same twice`);
}
console.log(`solos ${solos}, ${hitsN} hits, ${partsN} parts: ${lickParts} with a named lick (${named.size} different licks), ${strungParts} strung across a rest; longest rest ${worst} 16ths`);
if (!lickParts) fail('no named lick was ever used');
if (!strungParts) fail('nothing was ever strung');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
