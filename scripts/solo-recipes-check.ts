// Checks the story told in licks (docs/SOLO-RECIPES.md, stage 2): "Chosen bars, story told in licks" plays a recipe in each part of the story.
//  - The cores and the story are the same as in "story plan only"; the licks sit between the cores, never over one and never in a link gap.
//  - Notes are in the key, do not overlap, and the last one before a core is within 2 scale steps of it.
//  - A ramp: 6 or more 16ths, climbing, ending under the climax. A bend + pull-offs tag: a bent, let-down note and pulled-off notes after it.
//    A unison bend: a double-stop bent a whole tone. A sung phrase is followed by its tag.
//  - A gap the size of the opening plays the opening's rhythm again (when it can); a return keeps its tag.
//  - Every tag and every ramp shape turns up; the same seed plays the same; nothing set plays as off.
//   npm run solo-recipes-check        (N=100 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { SCALES } from '../src/theory';
import { scaleSteps } from '../src/parts/solomoves';
import type { StoryGap, StoryPart } from '../src/idea';

const N = Number(process.env.N ?? 100);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

type Sw = { soloCores?: 'only' | 'travel' | 'story' | 'recipes' | 'off' };
type Land = { step: number; midi: number; len: number; role: string };
const play = (j: number, sw: Sw) => {
  const i = j >> 1, genre = GENRES[i % 7], meter = METERS[Math.floor(i / 7) % METERS.length], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `st-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({
    s, sec, genre, lands: (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint') as Land[],
    story: (sec.soloCurve?.story ?? []) as StoryGap[], parts: (sec.soloCurve?.parts ?? []) as StoryPart[],
  }));
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}:${h.bend ?? 0}:${h.art ?? ''}`).join('|');
const landKey = (ls: Land[]) => ls.map((l) => `${l.step}:${l.midi}:${l.len}`).join('|');
const storyKey = (g: StoryGap[]) => g.map((x) => `${x.into}:${x.from}:${x.to}:${x.role}:${x.label}`).join('|');

const tally: Record<string, number> = {};
const count = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
let solos = 0, partsN = 0, spaces = 0, repeats = 0, repeated = 0, hitsN = 0, legatoN = 0, bentLong = 0, noteBars = 0, bars = 0;
for (let i = 0; i < 2 * N; i++) {
  const a = play(i, { soloCores: 'recipes' }), s0 = play(i, { soloCores: 'story' });
  a.forEach((x, k) => {
    solos++;
    const { song } = x.sec, pcs = (SCALES[song.mode as keyof typeof SCALES] as readonly number[]).map((p) => (p + song.key) % 12);
    if (landKey(x.lands) !== landKey(s0[k].lands)) fail(`${x.s}: the cores are not the same as in 'story'`);
    if (storyKey(x.story) !== storyKey(s0[k].story)) fail(`${x.s}: the story is not the same as in 'story'`);
    const hits = x.sec.guitar2 as any[], cores = new Set(x.lands.map((l) => l.step));
    hitsN += hits.length; bars += song.bars.length;
    noteBars += new Set(hits.map((h) => song.bars.findIndex((b: any, q: number) => h.step >= b.start && (q === song.bars.length - 1 || h.step < song.bars[q + 1].start)))).size;
    const endAt = x.lands.length ? x.lands[x.lands.length - 1].step : 1e9;
    const free = hits.filter((h) => !cores.has(h.step) && h.step < endAt);
    for (const h of free) {
      const part = x.parts.find((p) => h.step >= p.from && h.step + h.len <= p.to);
      if (!part) { fail(`${x.s}: a lick at ${h.step} sits outside every part`); continue; }
      if (part.recipe === 'space' || part.role === 'link') fail(`${x.s}: notes in a part that should be silent (${part.role})`);
      for (const m of h.notes) if (!pcs.includes(((m % 12) + 12) % 12)) fail(`${x.s}: a note off the key at ${h.step} (${m})`);
      if (h.art === 'legato') legatoN++;
      if ((h.bend ?? 0) > 0 && h.len >= 4) bentLong++;
    }
    // no two hits on top of each other (the song's ending may trim the last one)
    const sorted = hits.slice().sort((p, q) => p.step - q.step);
    for (let q = 0; q < sorted.length - 2; q++) if (sorted[q].step + sorted[q].len > sorted[q + 1].step) fail(`${x.s}: notes overlap at ${sorted[q].step}`);
    // parts
    const statement = x.parts.find((p) => p.role === 'statement' && p.recipe !== 'space');
    const leadLens = (p: StoryPart) => { const b = p.bits.find((z) => z.what === 'sung phrase'); return b ? free.filter((h) => h.step >= b.from && h.step < b.to).map((h) => h.len).join(',') : ''; };
    for (const p of x.parts) {
      partsN++;
      const core = x.lands[p.into];
      if (p.recipe === 'space') { spaces++; count('space ' + p.role); continue; }
      const mine = free.filter((h) => h.step >= p.from && h.step + h.len <= p.to).sort((q, r) => q.step - r.step);
      if (!mine.length) { fail(`${x.s}: a played part with no notes (${p.role})`); continue; }
      if (p.to > core.step) fail(`${x.s}: a part runs into its core`);
      const z = mine[mine.length - 1], zTop = z.notes[z.notes.length - 1];
      if (scaleSteps(song, zTop, core.midi) > 2 && !((z.bend ?? 0) > 0) && z.art !== 'slide') fail(`${x.s}: ${p.role} ends ${scaleSteps(song, zTop, core.midi)} steps from its core`);
      if (p.role === 'ramp') {
        const tops = mine.map((h) => h.notes[h.notes.length - 1]);
        if (mine.length < 6) fail(`${x.s}: a ramp of ${mine.length} notes`);
        if (mine.some((h) => h.len !== 1)) fail(`${x.s}: a ramp with a slow note`);
        const low = Math.min(...tops), high = Math.max(...tops);
        if (high - low < 4 || tops.indexOf(low) > 3 || tops[tops.length - 1] < Math.max(...tops.slice(0, 3))) fail(`${x.s}: a ramp that does not climb from the bottom (${tops.join(' ')})`);
        count('ramp ' + p.recipe.replace(/^\d+ fast notes climbing from the bottom, /, '').replace(', hammered', ''));
        if (/hammered/.test(p.recipe)) count('ramp hammered');
      }
      if (/bend, let down, pulled off/.test(p.recipe)) {
        count('tag bend + pull-offs');
        const bi = mine.findIndex((h) => (h.bend ?? 0) > 0 && (h.unbend ?? 0) > 0 && h.len >= 4);
        if (bi < 0 || mine.slice(bi + 1).filter((h) => h.art === 'legato').length < 2) fail(`${x.s}: bend + pull-offs without a let-down note and two pull-offs`);
      }
      if (/unison bend/.test(p.recipe)) {
        count('tag unison bend');
        if (!mine.some((h) => h.notes.length === 2 && h.notes[0] === h.notes[1] && (h.bend ?? 0) === 2)) fail(`${x.s}: a unison bend that is not a bent double-stop`);
      }
      if (/quick run/.test(p.recipe)) count('tag held + quick run');
      if (/long note/.test(p.recipe)) count('fall');
      if (/rising/.test(p.recipe)) count('build');
      if (p.bits.some((b) => b.what === 'sung phrase')) {
        count('sung phrase');
        const tag = p.bits[p.bits.length - 1];
        if (tag.what === 'sung phrase') fail(`${x.s}: a sung phrase with no tag`);
      }
      if (/again/.test(p.recipe)) {
        repeated++;
        if (!statement || leadLens(p) !== leadLens(statement)) fail(`${x.s}: the opening phrase "again" has another rhythm (${leadLens(p)} vs ${statement ? leadLens(statement) : '-'})`);
      }
    }
    for (const g of x.story) if (g.repeatOf !== undefined && g.role !== 'link') repeats++;
  });
  if (i % 5 === 0 && key(a[0].sec) !== key(play(i, { soloCores: 'recipes' })[0].sec)) fail(`song ${i}: not the same twice`);
}
for (let i = 0; i < Math.min(2 * N, 12); i++) if (play(i, {}).map((x) => key(x.sec)).join('#') !== play(i, { soloCores: 'off' }).map((x) => key(x.sec)).join('#')) fail(`song ${i}: off is not the same as nothing set`);

const share = (x: number) => Math.round(100 * x) / 100;
console.log(`solos ${solos}, parts ${partsN} (${spaces} left as space), ${hitsN} hits, notes in ${Math.round((100 * noteBars) / bars)}% of bars`);
console.log(Object.entries(tally).sort().map(([k, n]) => `${k} ${n}`).join('\n'));
console.log(`legato (pull-off / hammer) notes ${legatoN}, long bent notes ${bentLong}; gaps the size of the opening ${repeats}, played again ${repeated}`);
for (const need of ['tag bend + pull-offs', 'tag unison bend', 'tag held + quick run', 'sung phrase', 'fall', 'build', 'ramp hammered']) if (!tally[need]) fail(`never seen: ${need}`);
for (const need of ['scale', 'threes', 'fours', 'cascade']) if (!Object.keys(tally).some((k) => k.startsWith('ramp ') && (need === 'scale' ? /plain run/.test(k) : need === 'threes' ? /groups of three/.test(k) : need === 'fours' ? /groups of four/.test(k) : /cascade/.test(k)))) fail(`no ramp of the kind ${need}`);
if (repeats > 10 && repeated < repeats * 0.4) fail(`only ${repeated} of ${repeats} gaps the size of the opening play it again`);
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
