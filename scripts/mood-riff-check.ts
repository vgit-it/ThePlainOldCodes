// Checks Mood riff (docs/MOOD-RIFF.md): the mood picks the riff styles; a major key's riff takes the major 3rd.
//  - Sad moods get fewer gallops and big chords and more single notes, arpeggios and pedal notes than bold ones, in the riff genres.
//  - Switch off (or a wrong value, or Auto) is the song as it was; the same seeds give the same song.
//  - In a major key the riff's notes are major (not minor) with the switch on.
//  - A whole track builds for every riff genre and mood; its verse and bridge styles follow the mood too.
//   npm run mood-riff-check        (N=60 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { GENRES, GENRE_LIST, type RiffStyle } from '../src/genres';
import { buildTrack, defaultTrackOptions, moodSongOf } from '../src/track';

const N = Number(process.env.N ?? 60);
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const SAD = ['melancholic', 'dark', 'dreamy'], BOLD = ['triumphant', 'angry', 'happy'];
const BOLD_STYLES: RiffStyle[] = ['gallop', 'big', 'picked', 'lick'], SOFT_STYLES: RiffStyle[] = ['arp', 'single', 'pedal'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x: number) => x.toFixed(2);
const RIFF = GENRE_LIST.filter((g) => GENRES[g].riff);

const seeds = (s: string) => ({ song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
const make = (g: string, j: number, extra: Record<string, unknown>) => generate({ genre: g, meter: '4/4', weirdness: 0.3, ...MAIN_GUITARS, ...extra } as never, seeds(`mr-${j}-${g}`));
const sig = (i: any) => `${i.song.key}|${i.song.mode}|${i.song.bpm}|${(i.song.sections ?? []).join()}|${(i.guitar ?? []).map((h: any) => h.step + ':' + h.notes.join('.')).join(',')}`;

// off, undefined, a wrong value: the song as it was
for (const g of RIFF) for (let j = 0; j < 6; j++) {
  const was = sig(make(g, j, {}));
  if (sig(make(g, j, { moodSong: undefined })) !== was) fail(`${g} ${j}: undefined is not the same song`);
}
const t0 = defaultTrackOptions(make('metal', 0, {}));
if (moodSongOf({ ...t0, mood: 'dark', moodRiff: 'nonsense' as never })) fail('a wrong Mood riff value asks for something');
if (moodSongOf({ ...t0, mood: 'auto', moodRiff: 'on' })) fail('Auto mood asks for a mood riff');
const ask = moodSongOf({ ...t0, mood: 'dark', moodRiff: 'on' });
if (!ask || !ask.riff || ask.tempo || ask.mode) fail('Mood riff alone asks for more than the riff');

// the styles by mood: the share of the arrangement (8 bars, two styles) that is bold or soft
const share = (i: any, set: RiffStyle[]) => (i.song.sections as RiffStyle[]).filter((x) => set.includes(x)).length / 8;
console.log('genre      bold styles (gallop, big, picked, lick) sad / bold moods, soft styles (arp, single, pedal) sad / bold moods   (off in brackets)');
for (const g of RIFF) {
  const row = { sadBold: [] as number[], boldBold: [] as number[], sadSoft: [] as number[], boldSoft: [] as number[], offBold: [] as number[], offSoft: [] as number[] };
  for (let j = 0; j < N; j++) {
    row.offBold.push(share(make(g, j, {}), BOLD_STYLES)); row.offSoft.push(share(make(g, j, {}), SOFT_STYLES));
    for (const m of MOODS) {
      const on = make(g, j, { moodSong: { mood: m, riff: true } }), again = make(g, j, { moodSong: { mood: m, riff: true } });
      if (sig(on) !== sig(again)) fail(`${g} ${j} ${m}: not the same twice`);
      if (on.song.key !== make(g, j, {}).song.key) fail(`${g} ${j} ${m}: the key moved`);
      if (SAD.includes(m)) { row.sadBold.push(share(on, BOLD_STYLES)); row.sadSoft.push(share(on, SOFT_STYLES)); }
      if (BOLD.includes(m)) { row.boldBold.push(share(on, BOLD_STYLES)); row.boldSoft.push(share(on, SOFT_STYLES)); }
    }
  }
  console.log(g.padEnd(10) + `${f(mean(row.sadBold))} / ${f(mean(row.boldBold))}  (${f(mean(row.offBold))})        ${f(mean(row.sadSoft))} / ${f(mean(row.boldSoft))}  (${f(mean(row.offSoft))})`);
  // (hard rock has almost nothing but bold styles to start with: its sad moods show in what they add)
  if (!((mean(row.boldBold) - mean(row.boldSoft)) - (mean(row.sadBold) - mean(row.sadSoft)) > 0.15)) fail(`${g}: bold moods are not bolder in their riff styles than sad ones`);
  if (!(mean(row.sadSoft) > mean(row.boldSoft) + 0.05)) fail(`${g}: sad moods do not play more single notes, arpeggios and pedal notes than bold ones`);
}

// the riff's 3rd in a major key: minor 3rd (3 above the key) against major (4), among the single-note and lick riffs
let majorMinor3 = 0, majorMajor3 = 0, majorMinor3Off = 0, majorMajor3Off = 0, majorSongs = 0;
for (let j = 0; j < N * 3; j++) {
  const g = 'hardrock';
  const on = make(g, j, { mode: 'major', moodSong: { mood: 'happy', riff: true } }), off = make(g, j, { mode: 'major' });
  majorSongs++;
  for (const [i, set] of [[on, 'on'], [off, 'off']] as const) for (const h of i.guitar ?? []) {
    if (h.mute || h.notes.length !== 1) continue;
    const pc = ((h.notes[0] - i.song.key) % 12 + 12) % 12;
    if (set === 'on') { if (pc === 3) majorMinor3++; if (pc === 4) majorMajor3++; } else { if (pc === 3) majorMinor3Off++; if (pc === 4) majorMajor3Off++; }
  }
}
console.log(`hard rock in a major key (${majorSongs} songs): minor 3rd / major 3rd in the riff: off ${majorMinor3Off} / ${majorMajor3Off}, on ${majorMinor3} / ${majorMajor3}`);
// (a chord on the flat 3rd has it as its root, so the minor 3rd never goes: it falls and the major 3rd rises)
if (!(majorMajor3 > 2 * majorMajor3Off && majorMinor3 < 0.7 * majorMinor3Off)) fail('a major key riff does not take the major 3rd');
if (!(majorMinor3Off >= majorMajor3Off)) fail('off: the riff should be as it was (minor 3rd)');

// a whole track, every riff genre and mood
for (const g of RIFF) for (const m of MOODS) {
  const idea = make(g, 2, {});
  const opts = { ...defaultTrackOptions(idea), solo: 'on', mood: m, moodRiff: 'on' } as never;
  const t = buildTrack(idea, opts);
  const want = make(g, 2, { moodSong: moodSongOf(opts) });
  if (sig(t.source) !== sig(want)) fail(`${g} ${m}: the track is not the mood riff song`);
  if (idea.song.sections!.join() !== make(g, 2, {}).song.sections!.join()) fail(`${g} ${m}: the page's idea was changed`);
  const off = buildTrack(idea, { ...opts, moodRiff: 'off' } as never), none = buildTrack(idea, { ...opts, moodRiff: undefined } as never);
  if (off.sections.map((s) => s.guitar.length + ':' + s.notes.length).join() !== none.sections.map((s) => s.guitar.length + ':' + s.notes.length).join()) fail(`${g} ${m}: off is not as it was`);
}
// the verse and bridge styles follow the mood
// (a section's first note names the riff it plays: "... · galloping riff")
const label = (t: any) => t.sections.map((s: any) => s.notes[0] ?? '').join('|');
let sadGallop = 0, boldGallop = 0, nT = 0;
for (let j = 0; j < 30; j++) for (const g of ['hardrock', 'metal'] as const) {
  const idea = make(g, j, {});
  for (const m of [...SAD, ...BOLD]) {
    const t = buildTrack(idea, { ...defaultTrackOptions(idea), mood: m, moodRiff: 'on' } as never);
    const n = (label(t).match(/gallop/gi) ?? []).length;
    if (SAD.includes(m)) sadGallop += n; else boldGallop += n;
  }
  nT++;
}
console.log(`gallop riff sections in whole tracks (hard rock and metal, ${nT * 2} songs): sad moods ${sadGallop}, bold moods ${boldGallop}`);
if (!(boldGallop > sadGallop)) fail('whole tracks: bold moods do not gallop more than sad ones');
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
