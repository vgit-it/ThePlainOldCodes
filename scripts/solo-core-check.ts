// Checks the core-notes switch (docs/SOLO-CORE.md, step 1): "Chosen bars, cores only" writes one note that stands out in about half the bars.
//  - Share of bars with a core note: about half; the last bar and the climax bar always; never 3 bars in a row, never 4 bars without.
//  - Every core is a chord note, the climax core is the highest, the last is held to the end.
//  - Where cores sit: more often on a bar where a chord arrives than the bars do; the chord's 3rd or 7th more than the phrase endings of "every phrase"; the mood's colour note more often.
//  - Determinism: the same seed plays the same, and a link without the switch plays as before.
//   npm run solo-core-check        (N=80 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { MOOD_COLOUR } from '../src/parts/solocore';
import { QUALITIES, chordPc } from '../src/theory';

const N = Number(process.env.N ?? 80);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '4/4', '3/4', '6/8', '7/8', '5/4', 'mixed'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) + '%' : '-');
const mod = (n: number, m: number) => ((n % m) + m) % m;

type Sw = { soloCores?: 'only' | 'off' };
const play = (i: number, sw: Sw) => {
  const genre = GENRES[i % 7], meter = METERS[i % METERS.length], mood = MOODS[i % MOODS.length], s = `sm-${i}-${genre}`;
  const idea = generate({ genre, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), soloPlan: 'perform', mood, ...sw } as never).sections as any[]).filter((x) => x.section?.solo).map((sec) => ({ s, mood, sec, lands: (sec.soloCurve?.landings ?? []).filter((l: any) => l.role !== 'waypoint') as { step: number; midi: number; len: number; role: string }[] }));
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

const R = { solos: 0, bars: 0, cored: 0, arriveBars: 0, arriveCored: 0, cores: 0, onArrive: 0, off: { n: 0, tv: 0, col: 0 }, only: { n: 0, tv: 0, col: 0 } };
for (let i = 0; i < N; i++) {
  const a = play(i, { soloCores: 'only' }), b = play(i, { soloCores: 'off' });
  a.forEach((x, k) => {
    const { bars, key: tonic, total } = x.sec.song, ch = x.sec.chords, at = (g: number) => ch.timeline[ch.chordIdx[Math.min(Math.max(0, g), total - 1)]].chord;
    const barOf = (g: number) => bars.findIndex((br: any) => g >= br.start && g < br.start + br.len);
    const got = new Set<number>(x.lands.map((l) => barOf(l.step)));
    R.solos++; R.bars += bars.length; R.cored += got.size;
    const arrive = (j: number) => j > 0 && (at(bars[j].start).root !== at(bars[j].start - 1).root || at(bars[j].start).q !== at(bars[j].start - 1).q);
    bars.forEach((_: any, j: number) => { if (arrive(j)) { R.arriveBars++; if (got.has(j)) R.arriveCored++; } });
    for (const l of x.lands) { R.cores++; if (arrive(barOf(l.step))) R.onArrive++; }
    if (!x.sec.guitar2.length) fail(`${x.s}: a solo with no notes`);
    if (x.sec.guitar2.length !== x.lands.length && x.sec.guitar2.length !== x.lands.length - 1) fail(`${x.s}: ${x.sec.guitar2.length} notes but ${x.lands.length} cores`);
    const last = bars.length - 1;
    if (!got.has(last)) fail(`${x.s}: no core in the last bar`);
    const lastL = x.lands[x.lands.length - 1];
    if (lastL.step + lastL.len !== total) fail(`${x.s}: the last core is not held to the end`);
    for (let j = 0; j < bars.length; j++) {
      if (got.has(j) && got.has(j + 1) && got.has(j + 2)) fail(`${x.s}: 3 bars in a row`);
      if (!got.has(j) && !got.has(j + 1) && !got.has(j + 2) && !got.has(j + 3) && j + 3 < bars.length) fail(`${x.s}: 4 bars without a core`);
    }
    const cl = x.lands.find((l) => l.role === 'climax');
    if (cl && x.lands.some((l) => l !== cl && l.midi >= cl.midi)) fail(`${x.s}: the climax core is not the highest`);
    for (const l of x.lands.filter((q) => q.role !== 'end')) {
      // (the last bar is made over as a held home chord when the song ends there: its core is checked against the chord it was written on, not here)
      const c = at(l.step), tones = (QUALITIES[c.q] as readonly number[]).map((t) => mod(chordPc(tonic, c) + t, 12));
      const power = new Set(tones).size <= 2, d = mod(l.midi - chordPc(tonic, c), 12);
      if (!tones.includes(mod(l.midi, 12)) && !(power && (d === 3 || d === 4))) fail(`${x.s}: a core that is not a chord note (step ${l.step}, midi ${l.midi}, key ${tonic}, chord ${c.root}${c.q})`);
    }
    // what stands out: the 3rd or 7th, the mood's colour note, against the phrase endings of "every phrase"
    for (const [name, lands] of [['only', x.lands], ['off', b[k]?.lands ?? []]] as const) {
      for (const l of lands) {
        const c = at(l.step), d = mod(l.midi - chordPc(tonic, c), 12), t = (QUALITIES[c.q] as readonly number[]).map((v) => v % 12);
        const r = R[name]; r.n++;
        if (d === 3 || d === 4 || ((d === 10 || d === 11) && t.includes(d))) r.tv++;
        if ((MOOD_COLOUR[x.mood] as Record<number, number>)[mod(l.midi - tonic, 12)]) r.col++;
      }
    }
  });
  // the same switches, the same song, the same notes
  if (i % 5 === 0) { const c = play(i, { soloCores: 'only' }); if (a.map((x) => key(x.sec)).join('#') !== c.map((x) => key(x.sec)).join('#')) fail(`song ${i}: not the same twice`); }
}
// a link from before the switch (nothing set) plays as 'off' set by hand
for (let i = 0; i < Math.min(N, 12); i++) if (play(i, {}).map((x) => key(x.sec)).join('#') !== play(i, { soloCores: 'off' }).map((x) => key(x.sec)).join('#')) fail(`song ${i}: off is not the same as nothing set`);

console.log(`solos ${R.solos}: ${pct(R.cored, R.bars)} of bars have a core note`);
console.log(`bars where a chord arrives: ${pct(R.arriveCored, R.arriveBars)} have a core (all bars: ${pct(R.cored, R.bars)}); cores on an arrival bar: ${pct(R.onArrive, R.cores)}`);
console.log(`3rd or 7th:   cores ${pct(R.only.tv, R.only.n)}   phrase endings (every phrase) ${pct(R.off.tv, R.off.n)}`);
console.log(`mood colour:  cores ${pct(R.only.col, R.only.n)}   phrase endings (every phrase) ${pct(R.off.col, R.off.n)}`);
const share = R.cored / Math.max(1, R.bars);
if (!(share > 0.35 && share < 0.65)) fail(`share of bars with a core: ${(100 * share).toFixed(0)}%`);
if (!(R.arriveCored / Math.max(1, R.arriveBars) > share)) fail('cores are not more likely on a bar where a chord arrives');
if (!(R.only.tv / R.only.n > R.off.tv / Math.max(1, R.off.n))) fail('cores are not more often the 3rd or 7th');
if (!(R.only.col / R.only.n > R.off.col / Math.max(1, R.off.n))) fail('cores do not carry the mood colour more often');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
