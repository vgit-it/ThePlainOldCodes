// Checks the vocal's cell motifs (docs/VOCAL-TUNE.md, step C): a phrase built from a motif in scale steps, a run-up into each held ending,
// answers that play their call's cells again. Off (rule 39's copies), the copies off, cells (they take rule 39's place), and cells with
// the other two switches, on real songs (the first verse and chorus of each):
//  - how many phrases got a motif and how, how many got a run-up, how many cells an answer plays again,
//  - the tune score (src/verse/tune.ts) and its parts: the cell that comes back, the phrase ends,
//  - how many phrase ends are arrived at by a step,
//  - the move sizes (the mood's size of move must not change much), and that the rhythm is exactly that of the same line without cells,
//  - the rest still holds: nothing overlaps, no empty section, notes in the voice's limits, no lone short unit, choruses over the same
//    chords are one melody.
//   npm run vocal-cells-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { autoMood } from '../src/tension';
import { EMO_IDS } from '../src/verse/emotion';
import { songOptions, writeSong, type SectionVoice } from '../src/verse/sing';
import { chordsKey, chordsOf, isChorus, songGrid } from '../src/verse/section';
import { VOCAL_TUNE_PASS, vocalTune } from '../src/verse/tune';
import { fixUnits } from '../src/verse/verse';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

interface Mode { name: string; copies: boolean; cells: boolean; skeleton: boolean; tune: number }
const MODES: Mode[] = [
  { name: 'Off (rule 39)', copies: true, cells: false, skeleton: false, tune: 0 },
  { name: 'No copies', copies: false, cells: false, skeleton: false, tune: 0 },
  { name: 'Cells', copies: true, cells: true, skeleton: false, tune: 0 },
  { name: 'Cells + all', copies: true, cells: true, skeleton: true, tune: 12 },
];
interface Acc { secs: number; phrases: number; motif: number; runUps: number; kinds: Record<string, number>; replay: number; answers: number; sum: number; pass: number; parts: Record<string, number>; stepEnd: number; ends: number; move: number; moves: number; leaps: number; ms: number }
const blank = (): Acc => ({ secs: 0, phrases: 0, motif: 0, runUps: 0, kinds: {}, replay: 0, answers: 0, sum: 0, pass: 0, parts: {}, stepEnd: 0, ends: 0, move: 0, moves: 0, leaps: 0, ms: 0 });
const T: Record<string, Record<string, Acc>> = {};
const acc = (name: string, kind: string): Acc => ((T[name] ??= {})[kind] ??= blank());
let rhythmSame = 0, rhythmTotal = 0;

for (let i = 0; i < N; i++) {
  const genre = GENRES[i % 7], s = `vc-${i}-${genre}`;
  const idea = generate({ genre, meter: i % 9 === 8 ? '6/8' : '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b' } as never);
  const list = buildTrack(idea, { ...defaultTrackOptions(idea) } as never).sections;
  const mood = autoMood(idea.song, idea.seeds.song);
  const rhythm = new Map<string, string>();
  for (const m of MODES) {
    const on = new Set(EMO_IDS.filter((id) => m.copies || (id !== 'shape' && id !== 'shape2')));
    const t0 = Date.now();
    const w = writeSong(list, songOptions(s + 'v', 0, { mood, on, climax: list[0], maxSets: 4, ...(m.cells ? { cells: true } : {}), ...(m.skeleton ? { skeleton: true } : {}), ...(m.tune ? { tune: m.tune } : {}) } as never, 0));
    const ms = Date.now() - t0;
    const chorusNotes = new Map<string, string>();
    for (const sec of list) {
      const v: SectionVoice | undefined = w.get(sec);
      const k = sec.section?.kind ?? 'verse';
      if (!v) continue;
      if (!v.built.notes.length) { fail(`${s} ${k}: no notes (${m.name})`); continue; }
      const ns = v.built.notes, G = songGrid(sec);
      for (let j = 1; j < ns.length; j++) if (ns[j].step < ns[j - 1].step + ns[j - 1].len - 1e-6) fail(`${s} ${k}: overlap at ${ns[j].step} (${m.name})`);
      for (const n of ns) if (n.midi < v.range.xlo - 12 || n.midi > v.range.xhi + 12) fail(`${s} ${k}: note ${n.midi} out of range (${m.name})`);
      if (!fixUnits(ns, v.built.phrases, chordsOf(sec), G, false).ok) fail(`${s} ${k}: a lone short unit (${m.name})`);
      if (isChorus(sec)) {
        const key = `${chordsKey(sec)}|${ns.length}`, notes = ns.map((n) => `${n.step}:${n.len}:${n.midi}`).join(',');
        const seen = chorusNotes.get(key);
        if (seen !== undefined && seen !== notes) fail(`${s}: choruses over the same chords differ (${m.name})`);
        chorusNotes.set(key, notes);
      }
      const first = list.find((x) => (x.section?.kind ?? 'verse') === k);
      if (sec !== first || (k !== 'verse' && k !== 'chorus')) continue;
      // (cells alone change only the pitches: the rhythm is the line without copies')
      const rh = ns.map((n) => `${n.step}:${n.len}`).join(',');
      if (!m.copies && !m.cells && !m.skeleton && !m.tune) rhythm.set(`false|${k}`, rh);
      if (m.cells && !m.skeleton && !m.tune) { rhythmTotal++; if (rhythm.get(`false|${k}`) === rh) rhythmSame++; else fail(`${s} ${k}: cells changed the rhythm (${m.name})`); }
      const a = acc(m.name, k);
      const sc = vocalTune(ns, v.built.phrases, { key: sec.song.key, grid: G, chordAt: chordsOf(sec) });
      a.secs++; a.sum += sc.score; if (sc.score >= VOCAL_TUNE_PASS) a.pass++; a.ms += ms;
      for (const [p, x] of Object.entries(sc.parts)) a.parts[p] = (a.parts[p] ?? 0) + x;
      a.phrases += v.built.phrases.length;
      a.motif += new Set(v.built.cells.filter((c) => c.kind === 'a').map((c) => `${c.step}`)).size;
      a.runUps += v.built.runUps;
      for (const c of v.built.cells) a.kinds[c.kind] = (a.kinds[c.kind] ?? 0) + 1;
      a.replay += v.built.cells.filter((c) => c.kind === 'replay').length;
      a.answers += v.built.leaves.filter((l) => l.source !== null).length;
      for (const g of v.built.phrases) {
        const inside = ns.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6);
        for (let j = 1; j < inside.length; j++) {
          const d = Math.abs(inside[j].midi - inside[j - 1].midi);
          if (d) { a.move += d; a.moves++; if (d >= 5) a.leaps++; }
        }
        if (inside.length >= 2) { a.ends++; if (Math.abs(inside[inside.length - 1].midi - inside[inside.length - 2].midi) <= 2) a.stepEnd++; }
      }
    }
  }
}
for (const m of MODES) {
  for (const k of ['verse', 'chorus']) {
    const a = T[m.name]?.[k];
    if (!a || !a.secs) continue;
    const parts = ['repeat', 'ends', 'steps'].map((p) => `${p} ${(a.parts[p] / a.secs).toFixed(2)}`).join('  ');
    const cell = m.cells ? `  motif in ${Math.round((100 * a.motif) / a.phrases)}% of phrases, run-up in ${Math.round((100 * a.runUps) / a.phrases)}%, kinds ${Object.entries(a.kinds).map(([x, c]) => `${x} ${c}`).join(' ')}, replays ${a.replay} (${a.answers} answering leaves)` : '';
    console.log(`${m.name.padEnd(14)} ${k.padEnd(7)} score ${(a.sum / a.secs).toFixed(3)}  tune ${Math.round((100 * a.pass) / a.secs)}%  ${parts}  ends by a step ${Math.round((100 * a.stepEnd) / a.ends)}%  move ${(a.move / a.moves).toFixed(2)} leaps ${Math.round((100 * a.leaps) / a.moves)}%  ${Math.round(a.ms / a.secs)} ms/section${cell}`);
  }
}
console.log(`rhythm of the cells lines is the same line without cells: ${rhythmSame} of ${rhythmTotal}`);
console.log(bad ? `${bad} problems` : `ok: ${N} songs, no problems`);
process.exit(bad ? 1 : 0);
