// The song snapshot (docs/CLEANUP-PLAN.md, Phase 0): makes about 40 songs from fixed seeds exactly as the page does and compares a short hash
// of every part with scripts/song-reference.json. After a clean-up step the songs must come out note for note the same.
//   npm run song-check            compares; prints the songs and parts that differ; exits 1 if any do
//   npm run song-check -- --write writes the reference (only ever before a clean-up, never to make a failing check pass)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { MAIN_METHOD, generate } from '../src/generator';
import { GENRE_LIST } from '../src/genres';
import { METERS } from '../src/rhythm';
import { buildTrack, defaultTrackOptions } from '../src/track';

const REF = 'scripts/song-reference.json';
const SOLO_PLANS = ['off', 'on', 'perform'] as const;
const VOCAL_WRITERS = [undefined, 'bass', 'classic'] as const;

/** Which part each key of a section belongs to; a key missing here goes to "other", so nothing escapes the check. */
const PART: Record<string, string> = {
  chords: 'chords',
  drums: 'drums',
  strum: 'strum', strumVel: 'strum', strumColour: 'strum', strumGain: 'strum', strumFeel: 'strum', changeTouch: 'strum', shapes: 'strum', rhythmPick: 'strum', rhythmTime: 'strum', guitarOut: 'strum', cover: 'strum', written: 'strum',
  guitar: 'riff',
  bass: 'bass', bassLen: 'bass', bassLine: 'bass', bassTouch: 'bass', bassFeel: 'bass',
  guitar2: 'lead', g2Feel: 'lead', lilt: 'lead',
  vocal: 'vocal', sung: 'vocal', sungTop: 'vocal', vocalTimbre: 'vocal', vocalVoice: 'vocal', vocalHigh: 'vocal', vocalDouble: 'vocal', vocalEnergy: 'vocal', vocalLay: 'vocal',
  backing: 'backing',
  song: 'song',
};
const PARTS = ['song', 'chords', 'strum', 'riff', 'drums', 'bass', 'lead', 'solo', 'vocal', 'backing', 'other'];

/** Stable text: keys sorted, numbers rounded to 4 decimals, nothing undefined. */
function stable(v: unknown): string {
  if (v === undefined || typeof v === 'function') return 'u';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4) : String(v);
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined && typeof o[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}';
}
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

interface Case { name: string; genre: string; meter: string; soloPlan: (typeof SOLO_PLANS)[number]; writer: (typeof VOCAL_WRITERS)[number] }
const cases: Case[] = [];
// every genre, four seeds each, in 4/4
GENRE_LIST.forEach((genre, g) => {
  for (let k = 0; k < 4; k++) {
    const n = g * 4 + k;
    cases.push({ name: `${genre}-${k}`, genre, meter: '4/4', soloPlan: SOLO_PLANS[n % 3], writer: VOCAL_WRITERS[(n + Math.floor(n / 3)) % 3] });
  }
});
// every meter at least once, then Auto and Mixed
[...Object.keys(METERS), 'auto', 'mixed'].forEach((meter, i) => {
  cases.push({ name: `meter-${meter.replace('/', '_')}`, genre: GENRE_LIST[i % GENRE_LIST.length], meter, soloPlan: SOLO_PLANS[i % 3], writer: VOCAL_WRITERS[i % 3] });
});

function snapshot(c: Case) {
  const s = `snap-${c.name}`;
  const seeds = { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' };
  // as the page does: the options, then the main method, then the song's seeds (src/main.ts)
  const idea = generate({ genre: c.genre, meter: c.meter, weirdness: 0.3, vocalWriter: c.writer, ...MAIN_METHOD } as never, seeds as never);
  // a solo section always on, so the solos are there to compare
  const track = buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', soloPlan: c.soloPlan } as never);
  const per: Record<string, string[]> = Object.fromEntries(PARTS.map(p => [p, [] as string[]]));
  for (const sec of track.sections as unknown as Record<string, unknown>[]) {
    const info = sec.section as { solo?: boolean } | undefined;
    const bits: Record<string, Record<string, unknown>> = Object.fromEntries(PARTS.map(p => [p, {}]));
    for (const k of Object.keys(sec)) {
      let p = PART[k] ?? 'other';
      if (info?.solo && (k === 'guitar2' || k === 'soloCurve')) p = 'solo';
      bits[p][k] = sec[k];
    }
    for (const p of PARTS) per[p].push(stable(bits[p]));
  }
  const parts: Record<string, string> = {};
  for (const p of PARTS) parts[p] = hash(per[p].join('|'));
  return { sections: track.order.join(','), bars: track.bars, mood: track.mood, parts };
}

const out: Record<string, ReturnType<typeof snapshot>> = {};
for (const c of cases) out[c.name] = snapshot(c);

if (process.argv.includes('--write')) {
  writeFileSync(REF, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${REF}: ${cases.length} songs`);
} else {
  if (!existsSync(REF)) { console.log(`no ${REF}: run  npm run song-check -- --write  first`); process.exit(1); }
  const ref = JSON.parse(readFileSync(REF, 'utf-8')) as typeof out;
  let bad = 0;
  for (const name of new Set([...Object.keys(ref), ...Object.keys(out)])) {
    const a = ref[name], b = out[name];
    if (!a || !b) { console.log(`DIFF ${name}: ${a ? 'song no longer made' : 'song not in the reference'}`); bad++; continue; }
    const diff: string[] = [];
    if (a.sections !== b.sections) diff.push(`sections ${a.sections} -> ${b.sections}`);
    if (a.bars !== b.bars) diff.push(`bars ${a.bars} -> ${b.bars}`);
    if (a.mood !== b.mood) diff.push(`mood ${a.mood} -> ${b.mood}`);
    for (const p of PARTS) if (a.parts[p] !== b.parts[p]) diff.push(p);
    if (diff.length) { console.log(`DIFF ${name}: ${diff.join(', ')}`); bad++; }
  }
  console.log(bad ? `${bad} of ${cases.length} songs differ` : `all ${cases.length} songs match the reference`);
  process.exit(bad ? 1 : 0);
}
