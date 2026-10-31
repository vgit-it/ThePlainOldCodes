// Checks the vocal's skeleton (docs/VOCAL-TUNE.md, step B): the strong note of every phrase of a verse and a chorus planned first.
// Off against on (and on with the Tune pick at best of 12), on real songs:
//  - the shape of the song: the chorus's top note above the verse's, a verse that falls (second half under the first), a chorus that
//    peaks in its first half, answers that end on the root,
//  - how close the line gets to its plan: phrase ends within 2 semitones of the planned note, on its pitch class,
//  - the tune score (src/verse/tune.ts), and the rest still holds: nothing overlaps, no empty section, no lone short unit, the
//    choruses of a song are one melody.
//   npm run vocal-skeleton-check        (N=60 songs)
import { MAIN_GUITARS, generate } from '../src/generator';
import { buildTrack, defaultTrackOptions } from '../src/track';
import { autoMood } from '../src/tension';
import { EMO_IDS } from '../src/verse/emotion';
import { songOptions, writeSong, type SectionVoice } from '../src/verse/sing';
import { chordsKey, chordsOf, isChorus, songGrid } from '../src/verse/section';
import { VOCAL_TUNE_PASS, vocalTune } from '../src/verse/tune';
import { fixUnits } from '../src/verse/verse';
import { keyStep } from '../src/verse/final';

const N = Number(process.env.N ?? 60);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (a: boolean[]) => (a.length ? Math.round((100 * a.filter(Boolean).length) / a.length) : 0);

interface Stat {
  chorusAbove: boolean[]; verseFalls: boolean[]; chorusEarly: boolean[]; answerRoot: boolean[]; callRoot: boolean[];
  near: boolean[]; samePc: boolean[]; parts: Record<string, Record<string, number[]>>; score: Record<string, number[]>; tune: Record<string, boolean[]>; ms: number;
}
const blank = (): Stat => ({ chorusAbove: [], verseFalls: [], chorusEarly: [], answerRoot: [], callRoot: [], near: [], samePc: [], parts: { verse: {}, chorus: {} }, score: { verse: [], chorus: [] }, tune: { verse: [], chorus: [] }, ms: 0 });
const MODES: [string, boolean, number][] = [['Off', false, 0], ['Best of 12', false, 12], ['Skeleton', true, 0], ['Skeleton + best of 12', true, 12]];
const S: Record<string, Stat> = Object.fromEntries(MODES.map(([n]) => [n, blank()]));

for (let i = 0; i < N; i++) {
  const genre = GENRES[i % 7], s = `vs-${i}-${genre}`;
  const idea = generate({ genre, meter: i % 9 === 8 ? '6/8' : '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b' } as never);
  const list = buildTrack(idea, { ...defaultTrackOptions(idea) } as never).sections;
  const mood = autoMood(idea.song, idea.seeds.song);
  for (const [name, skeleton, tune] of MODES) {
    const t0 = Date.now();
    const w = writeSong(list, songOptions(s + 'v', 0, { mood, on: new Set(EMO_IDS), climax: list[0], maxSets: 4, ...(skeleton ? { skeleton } : {}), ...(tune ? { tune } : {}) } as never, 0));
    const st = S[name];
    st.ms += Date.now() - t0;
    const firstOf = (k: string) => list.find((x) => (x.section?.kind ?? 'verse') === k);
    const topOf = (v?: SectionVoice) => (v?.built.notes.length ? Math.max(...v.built.notes.map((n) => n.midi)) : undefined);
    const vs = firstOf('verse'), cs = firstOf('chorus');
    const vt = topOf(vs && w.get(vs)), ct = topOf(cs && w.get(cs));
    if (vt !== undefined && ct !== undefined) st.chorusAbove.push(ct > vt);
    const chorusNotes = new Map<string, string>();
    for (const sec of list) {
      const v = w.get(sec);
      const k = sec.section?.kind ?? 'verse';
      if (!v) continue;
      if (!v.built.notes.length) { fail(`${s} ${k}: no notes (${name})`); continue; }
      const ns = v.built.notes, G = songGrid(sec), total = sec.chords.chordIdx.length;
      for (let j = 1; j < ns.length; j++) if (ns[j].step < ns[j - 1].step + ns[j - 1].len - 1e-6) fail(`${s} ${k}: overlap at ${ns[j].step} (${name})`);
      if (!fixUnits(ns, v.built.phrases, chordsOf(sec), G, false).ok) fail(`${s} ${k}: a lone short unit (${name})`);
      if (isChorus(sec)) {
        const key = `${chordsKey(sec)}|${ns.length}`, notes = ns.map((n) => `${n.step}:${n.len}:${n.midi - keyStep(list[0].song.key, sec.song.key)}`).join(',');
        const seen = chorusNotes.get(key);
        if (seen !== undefined && seen !== notes) fail(`${s}: choruses over the same chords differ (${name})`);
        chorusNotes.set(key, notes);
      }
      if (k !== 'verse' && k !== 'chorus') continue;
      if (sec !== firstOf(k)) continue;
      const tn = vocalTune(ns, v.built.phrases, { key: sec.song.key, grid: G, chordAt: chordsOf(sec) });
      const sc = tn.score;
      for (const [pn, pv] of Object.entries(tn.parts)) (st.parts[k][pn] ??= []).push(pv);
      st.score[k].push(sc); st.tune[k].push(sc >= VOCAL_TUNE_PASS);
      // the shape of the section
      const half = total / 2;
      const a = ns.filter((n) => n.step < half).map((n) => n.midi), b = ns.filter((n) => n.step >= half).map((n) => n.midi);
      if (k === 'verse' && a.length && b.length) st.verseFalls.push(mean(b) <= mean(a));
      if (k === 'chorus') { const top = Math.max(...ns.map((n) => n.midi)); st.chorusEarly.push(ns.find((n) => n.midi === top)!.step < half); }
      // the phrase ends: each phrase's last note
      const endOf = (g: { step: number; len: number }) => ns.filter((n) => n.step >= g.step - 1e-6 && n.step < g.step + g.len - 1e-6).pop();
      v.built.phrases.forEach((g, pi) => {
        const e = endOf(g);
        if (!e) return;
        const c = chordsOf(sec)[Math.min(total - 1, Math.floor(e.step))];
        const isRoot = ((e.midi - sec.song.key - c.root) % 12 + 12) % 12 === 0;
        const role = g.role ?? (pi % 2 ? 'response' : 'call');
        if (role === 'response') st.answerRoot.push(isRoot); else st.callRoot.push(isRoot);
      });
      for (const goal of v.built.goals) {
        const g = { step: goal.step - 1, len: 1 };
        const e = ns.filter((n) => n.step <= goal.step - 1 + 1e-6 && n.step + n.len > goal.step - 1 - 1e-6).pop() ?? endOf({ step: goal.step - 8, len: 8 });
        if (!e) continue;
        void g;
        st.near.push(Math.abs(e.midi - goal.midi) <= 2);
        st.samePc.push((((e.midi - goal.midi) % 12) + 12) % 12 === 0);
      }
    }
  }
}
for (const [name] of MODES) {
  const x = S[name];
  console.log(`${name.padEnd(22)} chorus top above verse's ${pct(x.chorusAbove)}%  verse falls ${pct(x.verseFalls)}%  chorus peaks early ${pct(x.chorusEarly)}%  answers end on root ${pct(x.answerRoot)}% (calls ${pct(x.callRoot)}%)`);
  for (const k of ['verse', 'chorus']) console.log(`${''.padEnd(22)} ${k}: ${Object.entries(x.parts[k]).map(([pn, pv]) => `${pn} ${mean(pv).toFixed(2)}`).join('  ')}`);
  console.log(`${''.padEnd(22)} verse score ${mean(x.score.verse).toFixed(3)} (${pct(x.tune.verse)}% tune)  chorus ${mean(x.score.chorus).toFixed(3)} (${pct(x.tune.chorus)}% tune)${x.near.length ? `  ends near the plan ${pct(x.near)}%, on its note ${pct(x.samePc)}%` : ''}  ${Math.round(x.ms / N)} ms/song`);
}
console.log(bad ? `${bad} problems` : `ok: ${N} songs, no problems`);
process.exit(bad ? 1 : 0);
