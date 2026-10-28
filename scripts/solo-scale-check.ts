// Checks Mood scale (docs/SOLO-MOOD.md, "Mood scale"): over chords with no third, the mood turns the solo's 3rd and 6th.
//  - Dark moods play the minor 3rd and 6th, bright moods the major ones, in every genre (power-chord songs especially), and more so than with it off.
//  - Every note is in the mood's scale or is a note of the chord sounding; a song of full chords keeps its own scale.
//  - Switch off is Solo mood as it was; the same seed plays the same.
//   npm run solo-scale-check        (N=20 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { chordTones } from '../src/parts/guitar2';
import { MOOD_SCALE_BARE } from '../src/parts/solotunefirst';
import { moodScale } from '../src/parts/solomood';
import { QUALITIES, SCALES, chordPc } from '../src/theory';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 20);
const GENRES = ['rock', 'pop', 'funk', 'hardrock', 'metal', 'grunge', 'altmetal'];
const BRIGHT = ['happy', 'triumphant'], DARK = ['melancholic', 'dark', 'tense', 'angry'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mod = (n: number, m: number) => ((n % m) + m) % m;
const bare = (c: any) => new Set((QUALITIES[c.q] as readonly number[]).map((q) => q % 12)).size <= 2;

const build = (j: number, mood: string, scale: 'on' | 'off') => {
  const genre = GENRES[j % 7], s = `ms-${j}-${genre}`;
  const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  return (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood, soloPlan: 'tune', soloMood: 'on', soloMoodScale: scale } as never).sections as any[]).filter((x) => x.section?.solo);
};
const key = (sec: any) => sec.guitar2.map((h: any) => `${h.step}:${h.len}:${h.notes.join('.')}`).join('|');

// per genre and side (bright / dark) and switch: minor and major 3rd and 6th notes over chords with no third
type Cnt = { minor: number; major: number; solos: number; applied: number };
const cnt: Record<string, Cnt> = {};
const at = (g: string, side: string, sw: string) => (cnt[`${g}|${side}|${sw}`] ??= { minor: 0, major: 0, solos: 0, applied: 0 });
let notes = 0, offScale = 0;
for (let j = 0; j < N * GENRES.length; j++) {
  const g = GENRES[j % 7];
  for (const [side, moods] of [['bright', BRIGHT], ['dark', DARK]] as const) {
    for (const mood of moods) {
      for (const sw of ['off', 'on'] as const) {
        const secs = build(j, mood, sw);
        secs.forEach((sec) => {
          const c = at(g, side, sw), k = sec.song.key, total = sec.song.total, tl = sec.chords.timeline;
          const chordAt = (st: number) => tl[sec.chords.chordIdx[Math.min(total - 1, st)]].chord;
          const hits = sec.guitar2.filter((h: any) => !h.mute && h.notes.length);
          if (hits.length < 6) return;
          let barSteps = 0;
          tl.forEach((e: any, i: number) => { if (bare(e.chord)) barSteps += (tl[i + 1]?.step ?? total) - e.step; });
          const applied = barSteps / total >= MOOD_SCALE_BARE;
          c.solos++; if (applied) c.applied++;
          const own = SCALES[sec.song.mode] as readonly number[];
          const ms = sw === 'on' && applied ? moodScale(own, mood as never) : own;
          hits.forEach((h: any) => {
            const m = h.notes[h.notes.length - 1];
            if (sw === 'on') {
              notes++;
              // (the last note is carried into the next section and bent to its chord: track.ts)
              if (h.step < sec.song.bars[sec.song.bars.length - 1].start && !ms.includes(mod(m - k, 12)) && !chordTones(k, chordAt(h.step)).includes(mod(m, 12))) { offScale++; fail(`${g} ${mood} song ${j}: note ${m} at ${h.step} is not in the mood's scale or the chord`); }
            }
            // (only the notes that are not the chord's own: a chord on the flat 3rd or 6th has them as its root)
            if (!bare(chordAt(h.step)) || !applied || chordTones(k, chordAt(h.step)).includes(mod(m, 12))) return;
            const pc = mod(m - k, 12);
            if (pc === 3 || pc === 8) c.minor++;
            if (pc === 4 || pc === 9) c.major++;
          });
        });
        if (sw === 'on' && j % 11 === 0 && mood === 'happy') { const again = build(j, mood, 'on'); if (key(again[0]) !== key(secs[0])) fail(`${g} song ${j}: not the same twice`); }
      }
    }
    if (j % 9 === 0) {
      // the switch off is Solo mood as it was (no option at all)
      const genre = GENRES[j % 7], s = `ms-${j}-${genre}`;
      const idea = generate({ genre, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
      const was = (buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', mood: moodsOf(side)[0], soloPlan: 'tune', soloMood: 'on' } as never).sections as any[]).filter((x) => x.section?.solo);
      if (key(was[0]) !== key(build(j, moodsOf(side)[0], 'off')[0])) fail(`${g} song ${j}: Mood scale off is not Solo mood as it was`);
    }
  }
}
function moodsOf(side: string) { return side === 'bright' ? BRIGHT : DARK; }

const minorShare = (c: Cnt) => (c.minor + c.major ? c.minor / (c.minor + c.major) : NaN);
const f = (x: number) => (Number.isNaN(x) ? '  -  ' : x.toFixed(2));
console.log('genre      songs on power chords   minor share of the 3rd/6th notes: bright off, bright on, dark off, dark on');
let darkOn = 0, brightOn = 0, darkOff = 0, brightOff = 0, nGen = 0;
for (const g of GENRES) {
  const bo = at(g, 'bright', 'off'), bn = at(g, 'bright', 'on'), dof = at(g, 'dark', 'off'), dn = at(g, 'dark', 'on');
  const applied = bn.solos ? Math.round((100 * bn.applied) / bn.solos) : 0;
  console.log(g.padEnd(10) + `${applied}%`.padStart(8) + '                ' + [bo, bn, dof, dn].map((c) => f(minorShare(c)).padStart(8)).join(''));
  if (bn.applied >= 6 && dn.applied >= 6) {
    nGen++;
    brightOn += minorShare(bn); darkOn += minorShare(dn); brightOff += minorShare(bo); darkOff += minorShare(dof);
    if (!(minorShare(dn) > minorShare(bn) + 0.3)) fail(`${g}: dark moods (${f(minorShare(dn))}) are not minor enough above bright moods (${f(minorShare(bn))}) with Mood scale on`);
  }
}
console.log(`notes ${notes}: ${offScale} outside the mood's scale and the chord's notes`);
if (nGen) {
  console.log(`across the ${nGen} power-chord genres: dark minus bright, off ${f((darkOff - brightOff) / nGen)}, on ${f((darkOn - brightOn) / nGen)}`);
  if (!((darkOn - brightOn) / nGen > (darkOff - brightOff) / nGen + 0.2)) fail('Mood scale does not pull dark and bright moods further apart');
}
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
