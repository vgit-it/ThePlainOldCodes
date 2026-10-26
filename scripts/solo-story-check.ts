// Checks the story plan (docs/SOLO-STORY.md, stage 1): "Chosen bars, story plan only" gives every gap between the cores a part in the solo.
//  - The cores are the same as in "cores only" and no notes are written but the cores (the plan is read before it is built on).
//  - Every gap has a part: a link only where the gap is shorter than a beat; one statement at most, before the climax; the ramp is the gap
//    into the climax (when it has the room) and nothing else; releases and returns come after the climax; a return repeats the statement.
//  - The first long gap before the climax is the statement; a gap of the same size as the statement is marked.
//  - Nothing set plays as off; the same seed plays the same.
//   npm run solo-story-check        (N=100 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { PHRASE_MIN, RAMP_MIN } from '../src/parts/solostory';
import type { StoryGap } from '../src/idea';

const N = Number(process.env.N ?? 100);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

type Sw = { soloCores?: 'only' | 'travel' | 'story' | 'off' };
type Land = { step: number; midi: number; len: number; role: string };
const play = (j: number, sw: Sw) => {
  const i = j >> 1, genre = GENRES[i % 7], meter = METERS[Math.floor(i / 7) % METERS.length], mood = MOODS[(i + (j & 1) * 3) % MOODS.length], s = `st-${j}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', solo: 'on', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({
    s, sec, lands: (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint') as Land[], story: (sec.soloCurve?.story ?? []) as StoryGap[],
  }));
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');
const landKey = (ls: Land[]) => ls.map((l) => `${l.step}:${l.midi}:${l.len}`).join('|');

const roles: Record<string, number> = {};
let solos = 0, gapsN = 0, withStatement = 0, withRamp = 0, withReturn = 0, withRepeat = 0, withClimax = 0;
for (let i = 0; i < 2 * N; i++) {
  const a = play(i, { soloCores: 'story' }), b = play(i, { soloCores: 'only' });
  a.forEach((x, k) => {
    solos++;
    const { bars } = x.sec.song;
    const beatAt = (g: number) => { for (let q = bars.length - 1; q >= 0; q--) if (g >= bars[q].start) return Math.min(...bars[q].groups) as number; return 4; };
    if (landKey(x.lands) !== landKey(b[k].lands)) fail(`${x.s}: the cores are not the same as in 'only'`);
    if (key(x.sec) !== key(b[k].sec)) fail(`${x.s}: the story plan wrote notes beyond the cores`);
    const ci = x.lands.findIndex((l) => l.role === 'climax');
    if (ci >= 0) withClimax++;
    if (x.story.length === 0 && x.lands.length > 1 && x.lands[0].step > 0) fail(`${x.s}: no story for a solo with gaps`);
    // one record for each gap, in order, ending where the core starts
    let end = 0;
    x.story.forEach((g, q) => {
      gapsN++; roles[g.role] = (roles[g.role] ?? 0) + 1;
      const len = g.to - g.from;
      if (g.to !== x.lands[g.into]?.step || len <= 0) fail(`${x.s}: gap ${q} does not end on its core`);
      if (g.from < end) fail(`${x.s}: gaps overlap`);
      end = g.to + x.lands[g.into].len;
      if ((g.role === 'link') !== (len < beatAt(g.from))) fail(`${x.s}: gap ${g.into} (${len} 16ths) is ${g.role}`);
      if (!g.label) fail(`${x.s}: a gap with no name`);
      if (g.role === 'ramp' && (g.into !== ci || len < RAMP_MIN)) fail(`${x.s}: a ramp that is not the climax's gap (${g.into}, ${len} 16ths)`);
      if (ci >= 0 && g.into === ci && len >= RAMP_MIN && g.role !== 'ramp') fail(`${x.s}: the gap into the climax is ${g.role}`);
      if ((g.role === 'release' || g.role === 'return') && ci >= 0 && g.into <= ci) fail(`${x.s}: a ${g.role} before the climax`);
      if (ci >= 0 && g.into > ci && g.role !== 'link' && g.role !== 'release' && g.role !== 'return') fail(`${x.s}: ${g.role} after the climax`);
      if (ci >= 0 && g.into < ci && (g.role === 'release' || g.role === 'return' || g.role === 'ramp')) fail(`${x.s}: ${g.role} before the climax`);
    });
    const st = x.story.filter((g) => g.role === 'statement');
    if (st.length > 1) fail(`${x.s}: ${st.length} statements`);
    const first = x.story.find((g) => g.role !== 'link' && g.role !== 'ramp' && (ci < 0 || g.into < ci) && g.to - g.from >= PHRASE_MIN);
    if (first && first.role !== 'statement') fail(`${x.s}: the first long gap is ${first.role}, not the statement`);
    if (st.length && ci >= 0 && st[0].into >= ci) fail(`${x.s}: the statement is not before the climax`);
    if (st.length) withStatement++;
    if (x.story.some((g) => g.role === 'ramp')) withRamp++;
    const ret = x.story.filter((g) => g.role === 'return');
    if (ret.length > 1) fail(`${x.s}: ${ret.length} returns`);
    if (ret.length) { withReturn++; if (!st.length || ret[0].repeatOf !== st[0].into) fail(`${x.s}: a return that repeats nothing`); }
    for (const g of x.story) if (g.repeatOf !== undefined) { withRepeat++; if (!st.length || g.repeatOf !== st[0].into || g === st[0]) fail(`${x.s}: a repeat of something that is not the statement`); }
  });
  if (i % 5 === 0 && JSON.stringify(a.map((x) => x.story)) !== JSON.stringify(play(i, { soloCores: 'story' }).map((x) => x.story))) fail(`song ${i}: not the same twice`);
}
// a link from before the switch (nothing set) plays as 'off' set by hand
for (let i = 0; i < Math.min(2 * N, 12); i++) if (play(i, {}).map((x) => key(x.sec)).join('#') !== play(i, { soloCores: 'off' }).map((x) => key(x.sec)).join('#')) fail(`song ${i}: off is not the same as nothing set`);

console.log(`solos ${solos} (${withClimax} with a climax), gaps ${gapsN}: ` + Object.entries(roles).map(([r, n]) => `${r} ${n}`).join(', '));
console.log(`solos with a statement ${withStatement}, a ramp ${withRamp}, a return ${withReturn}; gaps the size of the statement ${withRepeat}`);
if (!(withStatement > solos * 0.6)) fail(`only ${withStatement} of ${solos} solos have a statement`);
if (!(withRamp > withClimax * 0.6)) fail(`only ${withRamp} of ${withClimax} solos with a climax have a ramp`);
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
