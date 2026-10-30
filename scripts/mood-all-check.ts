// Checks Mood: all the way (docs/MOOD-ALL.md): one switch for Tune first solos, Solo mood, Mood scale, Mood song and Mood riff.
//  - On is the same track as the five switches set one by one, whatever they were set to.
//  - On Auto it uses the mood Auto picks for the song as the genre wrote it, and the song follows that mood.
//  - Off, missing or a wrong value is the track as it was; the track keeps the options it was given; the same seeds give the same track.
//   npm run mood-all-check        (N=6 songs a genre)
import { MAIN_GUITARS, generate } from '../src/generator';
import { GENRE_LIST } from '../src/genres';
import { autoMood } from '../src/tension';
import { buildTrack, defaultTrackOptions, moodAllOpts } from '../src/track';

const N = Number(process.env.N ?? 6);
const MOODS = ['happy', 'melancholic', 'nostalgic', 'tense', 'angry', 'dreamy', 'triumphant', 'dark'] as const;
const METERS = ['4/4', '4/4', '3/4', '6/8'];
let bad = 0;
const fail = (m: string) => { if (bad++ < 25) console.log('FAIL ' + m); };

const seeds = (s: string) => ({ song: s, chords: s + 'c', drums: s + 'd', strum: s + 's', bass: s + 'b', vocal: s + 'v' } as never);
const make = (g: string, j: number, meter = '4/4') => generate({ genre: g, meter, weirdness: 0.3, ...MAIN_GUITARS } as never, seeds(`ma-${j}-${g}`));
const sig = (t: any) => `${t.mood}|${t.source.song.mode}|${t.source.song.bpm}|` + t.sections.map((s: any) => `${s.song.bpm}:${s.guitar?.length ?? 0}:${s.guitar2.map((h: any) => h.step + '.' + h.notes.join('-')).join(',')}`).join('|');
const FIVE = { soloPlan: 'tune', soloMood: 'on', soloMoodScale: 'on', moodSong: 'both', moodRiff: 'on' };

let built = 0;
for (const g of GENRE_LIST) for (let j = 0; j < N; j++) {
  const idea = make(g, j, METERS[j % METERS.length]);
  const base = { ...defaultTrackOptions(idea), solo: 'on' };
  const m = MOODS[(j + GENRE_LIST.indexOf(g)) % MOODS.length];
  // on = the five set one by one
  const on = buildTrack(idea, { ...base, mood: m, moodAll: 'on' } as never), by = buildTrack(idea, { ...base, mood: m, ...FIVE } as never);
  built++;
  if (sig(on) !== sig(by)) fail(`${g} ${j} ${m}: on is not the five switches`);
  // whatever the five were set to
  const clash = buildTrack(idea, { ...base, mood: m, moodAll: 'on', soloPlan: 'off', soloMood: 'off', soloMoodScale: 'off', moodSong: 'off', moodRiff: 'off' } as never);
  if (sig(clash) !== sig(on)) fail(`${g} ${j} ${m}: the five switches changed what on does`);
  // the track keeps the options it was given
  if (on.opts.moodAll !== 'on' || on.opts.soloPlan !== base.soloPlan || on.opts.mood !== m) fail(`${g} ${j}: the track's options were rewritten`);
  if (JSON.stringify(clash.opts.moodSong) !== JSON.stringify('off')) fail(`${g} ${j}: the five switches were rewritten`);
  // off, missing, a wrong value: as it was
  const plain = buildTrack(idea, { ...base, mood: m } as never);
  for (const v of ['off', undefined, 'nonsense']) if (sig(buildTrack(idea, { ...base, mood: m, moodAll: v } as never)) !== sig(plain)) fail(`${g} ${j} ${m}: moodAll ${v} is not the track as it was`);
  // twice the same
  if (sig(buildTrack(idea, { ...base, mood: m, moodAll: 'on' } as never)) !== sig(on)) fail(`${g} ${j} ${m}: not the same twice`);
  // Auto: the mood Auto picks for the song as the genre wrote it, and the song follows it
  const auto = buildTrack(idea, { ...base, mood: 'auto', moodAll: 'on' } as never);
  const picked = autoMood(idea.song, idea.seeds.song);
  if (auto.mood !== picked) fail(`${g} ${j}: Auto picked ${auto.mood}, not ${picked}`);
  if (sig(auto) !== sig(buildTrack(idea, { ...base, mood: picked, moodAll: 'on' } as never))) fail(`${g} ${j}: Auto is not the mood it picked`);
  if (auto.opts.mood !== 'auto') fail(`${g} ${j}: Auto was rewritten in the track's options`);
  if (moodAllOpts({ ...base, mood: 'auto', moodAll: 'on' } as never, idea).mood !== picked) fail(`${g} ${j}: moodAllOpts on Auto`);
  if (moodAllOpts({ ...base, mood: 'nonsense', moodAll: 'on' } as never, idea).mood !== picked) fail(`${g} ${j}: moodAllOpts on a wrong mood`);
}
console.log(`${built} tracks (every genre; 4/4, 3/4, 6/8)`);
console.log(bad ? `${bad} FAIL` : '0 FAIL');
if (bad) process.exitCode = 1;
