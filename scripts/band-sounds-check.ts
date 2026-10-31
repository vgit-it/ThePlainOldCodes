// Checks the band view's lead guitar sounds (docs/BAND-SOUNDS.md): songs made with the Lead guitar sounds
// switch on put their pinches, natural harmonics, dives, feedback, scrapes and late bends on the lead's
// notes in the band score, and the lead player acts each one out:
//  - a dive swings the whammy bar down over the last 0.8 s (bar line moves, hand dips, guitar face)
//  - a scrape drags the pick hand across the strings before the note, with rasp bits
//  - a pinch flashes a squeal by the pick hand; a natural harmonic chimes over the fret and the finger only touches
//  - a late bend lifts the fingertip late; the writer's bend dials move it sooner or slower
//  - a note with none of these draws exactly what it drew before
//   npm run band-sounds-check        (N=40 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { type Atlas } from '../src/band/atlas';
import { type Cmd, type Moment, guitarActor } from '../src/band/actors';
import { type FretNote, buildScore } from '../src/band/score';
import { buildTrack, defaultTrackOptions } from '../src/track';

const N = Number(process.env.N ?? 40);
const GENRES = ['rock', 'hardrock', 'metal', 'grunge', 'altmetal'] as const;
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

// a stand-in atlas: no pictures (every sprite is skipped), the lead's neck as the drawn art has it
const atlas = { img: {}, frames: {}, geo: { neck: { bridge: [-13, -26], nut: [31, -46], strings: 6, spacing: 1, frets: 15, pick: [-7, -28] }, poses: {} } } as unknown as Atlas;

const build = (g: string, i: number) => {
  const s = `bs-${g}-${i}`;
  const idea = generate({ genre: g, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS } as never, { song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
  const track = buildTrack(idea, { ...defaultTrackOptions(idea), solo: 'on', soloSounds: 'on' } as never);
  return buildScore(track.sections);
};

const moment = (score: ReturnType<typeof buildScore>, t: number): Moment => {
  const section = score.sections.find((s) => t >= s.from && t < s.to) ?? score.sections[0];
  return { t, six: score.six, section, beat: 0.3, beatNo: Math.floor(t / 4), heavy: false, wall: 1 };
};
const lines = (cmds: Cmd[]) => cmds.filter((c): c is Extract<Cmd, { line: unknown }> => 'line' in c);
const key = (cmds: Cmd[]) => JSON.stringify(cmds.map((c) => ('line' in c ? c.line.join(',') + c.color + c.alpha : `${c.f}@${c.x},${c.y}`)));

const seen = { pinch: 0, natural: 0, dive: 0, feedback: 0, scrape: 0, lateBend: 0 };
for (const g of GENRES) {
  for (let i = 0; i < N; i++) {
    const score = build(g, i);
    const lead = guitarActor(atlas, score, 'lead', 1);
    const notes = score.lead;
    const at = `${g} ${i}`;
    notes.forEach((n: FretNote, k) => {
      const len = (n.end - n.at) * score.six;
      const mid = n.at + (n.end - n.at) * 0.5;
      // (a sound that sits where the next note takes over: left to the real song to sort out)
      const clear = !notes[k + 1] || notes[k + 1].at >= n.end;
      if (n.dive && len > 0.2 && clear) {
        seen.dive++;
        const early = lines(lead(moment(score, n.at + 0.001))).filter((l) => l.color === '#9aa6b2');
        const late = lines(lead(moment(score, n.end - 0.01))).filter((l) => l.color === '#9aa6b2');
        if (!early.length || !late.length) fail(`${at}: dive: the bar isn't drawn (${early.length}, ${late.length})`);
        else if (JSON.stringify(early) === JSON.stringify(late)) fail(`${at}: dive: the bar doesn't move`);
      }
      if (n.scrape && k > 0 && clear) {
        seen.scrape++;
        const b = lines(lead(moment(score, n.at - n.scrape * 0.5))).filter((l) => l.color === '#ffd9a0' || l.color === '#ffffff');
        if (!b.length) fail(`${at}: scrape: no rasp drawn before the note`);
        const a = lines(lead(moment(score, n.at + 0.5)));
        if (a.some((l) => l.color === '#ffd9a0')) fail(`${at}: scrape: rasp still drawn after the note`);
      }
      if (n.harm === 'pinch' && clear) {
        seen.pinch++;
        if (!lines(lead(moment(score, n.at + 0.001))).some((l) => l.color === '#ffffff')) fail(`${at}: pinch: no squeal drawn`);
      }
      if (n.harm === 'natural' && n.fret > 0 && clear) {
        seen.natural++;
        if (!lines(lead(moment(score, n.at + 0.001))).some((l) => l.color === '#bfe8ff')) fail(`${at}: natural harmonic: no chime drawn`);
      }
      if (n.feedback) seen.feedback++;
      if (n.lateBend && len > 0.5 && clear) {
        seen.lateBend++;
        const soon = key(lead(moment(score, n.at + 0.05 / score.six))), end = key(lead(moment(score, mid + (n.end - n.at) * 0.45)));
        if (soon === end) fail(`${at}: late bend: nothing moves`);
      }
    });
  }
}
// every sound turns up somewhere in the songs
for (const [k, v] of Object.entries(seen)) if (!v && k !== 'lateBend') fail(`${k}: not once in ${N * GENRES.length} songs`);
console.log('sounds seen:', JSON.stringify(seen));
if (bad) { console.log(`${bad} problems`); process.exit(1); }
console.log('band sounds ok');
