// Checks Solo mood (docs/SOLO-MOOD.md): "Tune first" with the mood's own character.
//  - Every note is in the key, or is a note of the chord sounding; chord notes on the strong places; a passing note moves on by a step.
//  - The moods are different, in numbers: jumps, quick notes, height, the way it goes, rough intervals, against each other on the same songs.
//  - Mood off is Tune first as it was; the same seed plays the same.
//   npm run solo-mood-check        (N=24 songs, each in all 8 moods)
import { MAIN_GUITARS, generate } from '../src/generator';
import { chordTones } from '../src/parts/guitar2';
import { aimFor } from '../src/parts/solomood';
import { tuneScore, TUNE_PASS } from '../src/parts/solotune';
import { profileFor } from '../src/verse/intervals';
import { QUALITIES, SCALES, chordPc } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 24);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mod = (n: number, m: number) => ((n % m) + m) % m;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number, d = 2) => x.toFixed(d);
const isCore = (key: number, mode: string, chord: any, m: number) => {
  if (chordTones(key, chord).includes(mod(m, 12))) return true;
  if (new Set((QUALITIES[chord.q] as readonly number[]).map((x) => x % 12)).size > 2) return false;
  const d = mod(m - chordPc(key, chord), 12);
  return (d === 3 || d === 4) && (SCALES[mode as never] as readonly number[]).includes(mod(m - key, 12));
};

const build = (j: number, mood: string, extra: Record<string, unknown>) => {
  const genre = GENRES[j % 7], s = `mo-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', ...extra } as never).sections as any[]).filter((x) => x.section?.solo);
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

interface Stat { solos: number; moves: number; leaps: number; ups: number; downs: number; rough: number; notes: number; quick: number; len: number; high: number[]; tunes: number; plain: number; fit: number[]; sil: number; steps: number; colour: number; same: number }
const blank = (): Stat => ({ solos: 0, moves: 0, leaps: 0, ups: 0, downs: 0, rough: 0, notes: 0, quick: 0, len: 0, high: [], tunes: 0, plain: 0, fit: [], sil: 0, steps: 0, colour: 0, same: 0 });
const stats: Record<string, { on: Stat; off: Stat }> = {};
for (const m of MOODS) stats[m] = { on: blank(), off: blank() };
let strong = 0, strongCore = 0, offKey = 0, passing = 0, passingStep = 0, notes = 0;

for (let j = 0; j < N; j++) {
  for (const mood of MOODS) {
    for (const which of ['off', 'on'] as const) {
      const secs = build(j, mood, { soloMood: which });
      secs.forEach((sec) => {
        const st = stats[mood][which];
        const key0 = sec.song.key, mode = sec.song.mode, bars = sec.song.bars, total = sec.song.total;
        const chordAt = (g: number) => sec.chords.timeline[sec.chords.chordIdx[Math.min(total - 1, g)]].chord;
        const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length).sort((a: any, b: any) => a.step - b.step);
        if (hits.length < 6) return;
        const lastBar = bars[bars.length - 1];
        const barAt = (g: number) => bars.find((b: any) => g >= b.start && g < b.start + b.len) ?? lastBar;
        const beat = (g: number) => Math.min(...barAt(g).groups);
        const midi = hits.map((h: any) => h.notes[h.notes.length - 1]);
        st.solos++;
        hits.forEach((h: any, k: number) => {
          st.notes++; st.len += h.len; if (h.len <= Math.max(2, beat(h.step) / 2)) st.quick++;
          const m = midi[k];
          if (k) {
            const d = m - midi[k - 1], a = Math.abs(d);
            st.moves++; if (a >= 5) st.leaps++; if (d > 0) st.ups++; if (d < 0) st.downs++; if ([1, 6, 11].includes(a % 12)) st.rough++; if (a >= 1 && a <= 2) st.steps++; if (a === 0) st.same++;
          }
          if (k < hits.length - 1 && h.step + h.len < lastBar.start) st.sil = Math.max(st.sil, hits[k + 1].step - (h.step + h.len) > beat(h.step) ? 1 : 0);
          if (which !== 'on') return;
          notes++;
          if (h.step === lastBar.start) return; // (the last note is carried into the next section and bent to its chord: track.ts)
          const pc = mod(m - key0, 12);
          if (!(SCALES[mode as never] as readonly number[]).includes(pc) && !chordTones(key0, chordAt(h.step)).includes(mod(m, 12))) { offKey++; fail(`${mood} song ${j}: note ${m} at ${h.step} len ${h.len} is not in the key or the chord (${JSON.stringify(chordAt(h.step))}, key ${key0} ${mode}, ${JSON.stringify(sec.chords.timeline.filter((e: any) => e.step <= h.step + h.len && e.step >= h.step - 16).map((e: any) => [e.step, e.chord.root, e.chord.q]))})`); }
          const b = barAt(h.step), isStrong = h.step === b.start || h.len >= beat(h.step) * 1.5;
          if (isStrong && h.step !== lastBar.start) { strong++; if (isCore(key0, mode, chordAt(h.step), m)) strongCore++; }
          if (!isCore(key0, mode, chordAt(h.step), m) && k < hits.length - 1 && hits[k + 1].step <= h.step + h.len + 0) { passing++; if (Math.abs(midi[k + 1] - m) <= 4) passingStep++; else if (process.env.DEBUG) console.log(`passing ${mood} j${j} step ${h.step} len ${h.len} midi ${m} (${mod(m - key0, 12)} from key, ${mod(m - chordPc(key0, chordAt(h.step)), 12)} from chord root) prev ${midi[k - 1]} next ${midi[k + 1]} nextLen ${hits[k + 1].len} cell? strong=${h.step === barAt(h.step).start}`); }
          const root = chordPc(key0, chordAt(h.step));
          if ([2, 9, 10, 11].includes(mod(m - root, 12)) && !isCore(key0, mode, chordAt(h.step), m)) st.colour++;
        });
        st.high.push(mean(midi));
        const aim = aimFor(mood, profileFor(mood, 'solo').w);
        const t = tuneScore(sec.guitar2, { bars, key: key0, chordAt }, aim);
        st.fit.push(t.score);
        if (t.score >= TUNE_PASS) st.tunes++;
        if (tuneScore(sec.guitar2, { bars, key: key0, chordAt }).score >= TUNE_PASS) st.plain++;
      });
      if (which === 'on' && j % 6 === 0) {
        const again = build(j, mood, { soloMood: 'on' });
        if (key(again[0]) !== key(secs[0])) fail(`${mood} song ${j}: not the same twice`);
      }
    }
    // the switch off is Tune first as it was
    if (j % 8 === 0) {
      const a = build(j, mood, {}), b = build(j, mood, { soloMood: 'off' });
      if (key(a[0]) !== key(b[0])) fail(`${mood} song ${j}: Solo mood off is not Tune first as it was`);
    }
  }
}

const pct = (a: number, b: number) => (b ? a / b : 0);
console.log('mood'.padEnd(12) + ' jumps  up    quick  steps  rough  same  held  height  fit-ok  tune  (Solo mood on; off in brackets for jumps, quick)');
const row: Record<string, { leap: number; up: number; quick: number; rough: number; high: number; steps: number; leapOff: number; quickOff: number }> = {};
for (const mood of MOODS) {
  const { on, off } = stats[mood];
  row[mood] = { leap: pct(on.leaps, on.moves), up: pct(on.ups, on.ups + on.downs), quick: pct(on.quick, on.notes), rough: pct(on.rough, on.moves), high: mean(on.high), steps: pct(on.steps, on.moves), leapOff: pct(off.leaps, off.moves), quickOff: pct(off.quick, off.notes) };
  const r = row[mood];
  console.log(mood.padEnd(12) + [r.leap, r.up, r.quick, r.steps, r.rough].map((x) => f(x).padStart(6)).join(' ') + f(pct(on.same, on.moves)).padStart(6) + f(on.len / Math.max(1, on.notes), 1).padStart(6) + f(r.high, 1).padStart(8) + `   ${Math.round((100 * on.tunes) / Math.max(1, on.solos))}%`.padStart(8) + `${Math.round((100 * on.plain) / Math.max(1, on.solos))}%`.padStart(6) + `   (${f(r.leapOff)}, ${f(r.quickOff)}; same off ${f(pct(off.same, off.moves))})`);
  if (on.sil) fail(`${mood}: more than a beat of silence`);
}
const g = (ms: string[], k: 'leap' | 'up' | 'quick' | 'rough' | 'high' | 'steps') => mean(ms.map((m) => row[m][k]));
const order = (what: string, a: number, b: number, gap: number) => { if (!(a > b + gap)) fail(`${what}: ${f(a)} is not above ${f(b)} by ${gap}`); };
order('jumps: angry, tense, triumphant over melancholic, nostalgic, dark', g(['angry', 'tense', 'triumphant'], 'leap'), g(['melancholic', 'nostalgic', 'dark'], 'leap'), 0.04);
order('quick notes: angry, tense over melancholic, dreamy, nostalgic', g(['angry', 'tense'], 'quick'), g(['melancholic', 'dreamy', 'nostalgic'], 'quick'), 0.12);
order('height: triumphant over dark (semitones)', row.triumphant.high, row.dark.high, 3);
order('going up: triumphant over dark', row.triumphant.up, row.dark.up, 0.08);
order('steps: melancholic over angry', row.melancholic.steps, row.angry.steps, 0.08);
order('rough intervals: tense, angry, dark over happy, triumphant', g(['tense', 'angry', 'dark'], 'rough'), g(['happy', 'triumphant'], 'rough'), 0.005);
// the moods are further apart with Solo mood on than off
const spread = (k: 'leap' | 'quick', key2: 'leap' | 'leapOff' | 'quick' | 'quickOff') => Math.max(...MOODS.map((m) => row[m][key2])) - Math.min(...MOODS.map((m) => row[m][key2]));
console.log(`spread across the moods: jumps ${f(spread('leap', 'leapOff'))} off, ${f(spread('leap', 'leap'))} on; quick notes ${f(spread('quick', 'quickOff'))} off, ${f(spread('quick', 'quick'))} on`);
if (!(spread('leap', 'leap') > spread('leap', 'leapOff') + 0.05)) fail('the moods are not further apart in their jumps with Solo mood on');
if (!(spread('quick', 'quick') > spread('quick', 'quickOff') + 0.05)) fail('the moods are not further apart in their pace with Solo mood on');
console.log(`notes ${notes}: ${offKey} off the key and not the chord's; chord notes on ${Math.round((100 * strongCore) / Math.max(1, strong))}% of strong places; passing notes move on by a step or a third ${Math.round((100 * passingStep) / Math.max(1, passing))}% of ${passing}`);
if (pct(strongCore, strong) < 0.85) fail('chord notes on strong places under 85%');
if (pct(passingStep, passing) < 0.8) fail('passing notes that do not move on by a step or a third over 20%');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
