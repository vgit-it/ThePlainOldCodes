// Checks the vocal's Tune pick (docs/VOCAL-TUNE.md) on real songs: a verse and a chorus written in several versions, the best as a tune kept.
//  - the score (src/verse/tune.ts) of the verses and choruses: one version (off) against the best of 4, 8, 12,
//  - the rest still holds with the pick on: nothing overlaps, every sung section has notes, the notes stay in the voice's limits, no lone
//    short unit, the choruses of a song are one melody (the same notes over the same chords, moved by the step of a key change), the phrasing of a section is the baseline's.
//   npm run vocal-tune-check        (N=60 songs; PICKS=4,8,12)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { autoMood } from '../src/tension';
import { EMO_IDS } from '../src/verse/emotion';
import { songOptions, writeSong, type SectionVoice } from '../src/verse/sing';
import { barOf, chordsKey, chordsOf, isChorus, songGrid } from '../src/verse/section';
import { VOCAL_TUNE_PASS, vocalTune } from '../src/verse/tune';
import { fixUnits } from '../src/verse/verse';
import type { Idea } from '../src/idea';
import { keyStep } from '../src/verse/final';

const N = Number(process.env.N ?? 60);
const PICKS = (process.env.PICKS ?? '4,8,12').split(',').map(Number);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const secMs: Record<string, number> = {};
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

interface Acc { secs: number; sum: number; pass: number; samePhrasing: number; ms: number; tune: Record<string, number> }
const blank = (): Acc => ({ secs: 0, sum: 0, pass: 0, samePhrasing: 0, ms: 0, tune: {} });
const T: Record<string, Record<string, Acc>> = {};
const acc = (name: string, kind: string): Acc => ((T[name] ??= {})[kind] ??= blank());
const phrasing = (v: SectionVoice) => v.built.phrases.map((g) => `${g.step}:${g.len}`).join(',');

for (let i = 0; i < N; i++) {
  const genre = GENRES[i % 7], s = `vt-${i}-${genre}`;
  const idea = generate({ genre, meter: i % 9 === 8 ? '6/8' : '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b' } as never);
  const list = buildTrack(idea, { ...defaultTrackOptions(idea) } as never).sections;
  const mood = autoMood(idea.song, idea.seeds.song);
  const mk = (tune: number) => writeSong(list, songOptions(s + 'v', 0, { mood, on: new Set(EMO_IDS), climax: list[0], maxSets: 4, ...(tune ? { tune } : {}) } as never, 0));
  const runs: [string, number][] = [['Off', 0], ...PICKS.map((p): [string, number] => [`Best of ${p}`, p])];
  let base: Map<Idea, SectionVoice> | undefined;
  for (const [name, tune] of runs) {
    const t0 = Date.now();
    const w = mk(tune);
    const ms = Date.now() - t0;
    if (!base) base = w;
    secMs[name] = (secMs[name] ?? 0) + ms;
    const chorusNotes = new Map<string, string>();
    for (const sec of list) {
      const v = w.get(sec);
      const k = sec.section?.kind ?? 'verse';
      if (!v) continue;
      if (!v.built.notes.length) { fail(`${s} ${k}: no notes (${name})`); continue; }
      const ns = v.built.notes, G = songGrid(sec), total = sec.chords.chordIdx.length;
      for (let j = 1; j < ns.length; j++) if (ns[j].step < ns[j - 1].step + ns[j - 1].len - 1e-6) fail(`${s} ${k}: overlap at ${ns[j].step} (${name})`);
      for (const n of ns) if (n.midi < v.range.xlo - 12 || n.midi > v.range.xhi + 12) fail(`${s} ${k}: note ${n.midi} out of range (${name})`);
      const units = fixUnits(ns, v.built.phrases, chordsOf(sec), G, false);
      if (!units.ok) fail(`${s} ${k}: a lone short unit (${name})`);
      void total; void barOf;
      if (isChorus(sec)) {
        const key = `${chordsKey(sec)}|${ns.length}`;
        const notes = ns.map((n) => `${n.step}:${n.len}:${n.midi - keyStep(list[0].song.key, sec.song.key)}`).join(',');
        const seen = chorusNotes.get(key);
        if (seen !== undefined && seen !== notes) fail(`${s}: choruses over the same chords differ (${name})`);
        chorusNotes.set(key, notes);
      }
      if (k !== 'verse' && k !== 'chorus') continue;
      // (the first section of a kind counts, once a song: the others repeat it)
      const first = list.find((x) => (x.section?.kind ?? 'verse') === k);
      if (sec !== first) continue;
      const sc = vocalTune(ns, v.built.phrases, { key: sec.song.key, grid: G, chordAt: chordsOf(sec) });
      const a = acc(name, k);
      a.secs++; a.sum += sc.score; if (sc.score >= VOCAL_TUNE_PASS) a.pass++;
      for (const [p, x] of Object.entries(sc.parts)) a.tune[p] = (a.tune[p] ?? 0) + x;
      if (base.get(sec) && phrasing(base.get(sec)!) === phrasing(v)) a.samePhrasing++;
      }
  }
}
for (const name of Object.keys(T)) {
  for (const k of ['verse', 'chorus']) {
    const a = T[name][k];
    if (!a || !a.secs) continue;
    const parts = Object.entries(a.tune).map(([p, x]) => `${p} ${(x / a.secs).toFixed(2)}`).join('  ');
    console.log(`${name.padEnd(11)} ${k.padEnd(7)} score ${(a.sum / a.secs).toFixed(3)}  tune ${Math.round((100 * a.pass) / a.secs)}%  same phrasing ${Math.round((100 * a.samePhrasing) / a.secs)}%  ${Math.round(secMs[name] / N)} ms/song (whole vocal)\n            ${parts}`);
  }
}
console.log(bad ? `${bad} problems` : `ok: ${N} songs, no problems`);
process.exit(bad ? 1 : 0);
