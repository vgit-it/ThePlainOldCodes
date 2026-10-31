// Grows an 8-bar idea into a full track: intro, verses, choruses, bridge and outro.
// Like a real song, a track reuses a few blocks of music (verse, chorus, bridge) and plays
// them at different energy levels (1 quiet … 5 everything). Scope: docs/TRACKS.md
//
// Pure and deterministic: the same idea always grows into the same track.

import { arrangeBacking, pickBacking } from './parts/backing';
import type { MoveId } from './parts/moves';
import { autoVoice, singTrack } from './parts/vocal';
import type { EnergyStyle } from './parts/energy';
import { type Mood, type MoodChoice, PROFILES, arcNote, autoMood, planTension } from './tension';
import { type BuildOptions, buildIdea, generate, withSheet } from './generator';
import { type MoodSong, riffLike } from './moodsong';
import { GENRES, type Genre, QUIET_STYLES, type RiffStyle } from './genres';
import type { ChordSheet, GuitarHit, Idea, SectionKind, Song } from './idea';
import { type G2Options, type Guitar2Part, type Guitar2Style, chordTones, generateHook, leadFret } from './parts/guitar2';
import { TUNINGS } from './theory/fretboard';
import { generateSolo2 } from './parts/solo2';
import { generateSoloMelody } from './parts/solomelody';
import { generateSoloTune } from './parts/solotunefirst';
import { type Around, type ShapeChoice, type StoryIn, isShapeChoice } from './parts/soloplot';
import { generateSoloPlan, isCoreMode } from './parts/soloplan';
import { performSolo } from './parts/soloplayer';
import { addLeadSounds } from './parts/solosounds';
import { shapeStory } from './parts/solodynamics';
import { expressSolo } from './parts/soloexpress';
import { planWah } from './sections/wah';
import { heldBacking } from './sections/soloback';
import { planVary, varySegs, varyTension, varyDrums } from './sections/solovary';
import { LIVE_RULES, NO_RULES } from './parts/solorules-live';
import { singLead } from './parts/leadvocal';
import { emoOn, setsOf } from './verse/emotion';
import { bassShareOf } from './verse/bassline';
import { singSong } from './verse/sing';
import { BASS_LINE_DESC } from './parts/bass';
import { RIFF_STYLE_LABEL } from './parts/riff';
import { naturalStrokes } from './parts/strum';
import { applySheet, hasPins } from './parts/sheet';
import { playBand } from './players/band';
import { leadHands } from './players/hands';
import { type LickKind, pickLead } from './players/lead';
import { GUITAR_ROLE_DESC, applyGuitarShape, planGuitar } from './players/presence';
import { pickRhythm, pickRiffPlayer, playRhythm, playRiffPart } from './players/rhythm';
import { Rng } from './rng';
import { AUTO_GUITAR2, SOUND_NAME, type SoundId, type SoundSlot, describeSounds, orchestrate } from './sounds';
import { type Chord, type Mode, NOTE_NAMES } from './theory';
import { pickHigh } from './parts/singers';
import { Seg, seg, take, join, asWritten, block, chordSig, tonicOnly, fill8 } from './sections/join';
import { crashAt, ensureFill, pickup, shapeDrums, quarterTime, shapeStrum, shapeBass, carrySolo, bandStop, makeEnding } from './sections/energy';
import { Plan, MOOD_PLANS, CHORUS_PLANS, JAM_PLANS, RIFF_VERSE_MOVE, isMinor, plansFor, describeChords, planned, chordal, pedalBass, transpose } from './sections/harmony';
import { layerIntro, longIntro, jamBuild, snareBuild, bandHits } from './sections/arrangement';
import { turnaround, push, settleIn, ringOut, walkUp, g2Pickup } from './sections/seams';
import { runCount, writeGuitar2, writeGuitar2Styles, isLeadLine, FIGURE_SONGS, ROOM, makeRoom, NO_LEAD, BREAK, TWIN, TWIN_KINDS, addTwin, playingStyle } from './sections/guitar2';

export type Choice = 'auto' | 'on' | 'off';
export type IntroChoice = 'auto' | 'alone' | 'layered' | 'long' | 'band';
export type OutroChoice = 'auto' | 'short' | 'long' | 'jam';

/** How a track is built: its own seeds (so each block can be rerolled alone), structure choices, and an optional hand-edited order. */
export interface TrackOptions {
  /** `chorus`: a riff track's new chorus, when the idea's riff plays the verses (missing in older links). */
  seeds: { structure: string; verse: string; pre: string; bridge: string; hook: string; chorus?: string; band?: string; solo?: string };
  intro: IntroChoice;
  pre: Choice;
  interlude: Choice;
  keyChange: Choice;
  /** Short (4 bars), long (the last line repeats as a tag) or a jam (new music in a new key); missing in older links: Auto. */
  outro?: OutroChoice;
  /** Guitar solos (Auto: rock, hard rock, metal and grunge; missing in older links: Auto). */
  solo?: Choice;
  /** Riff genres: the idea's riff plays under the verses (missing in older links: Auto). */
  riffVerse?: Choice;
  /** Played by the band: each player plays the written parts their own way (missing in older links: on). */
  band?: 'on' | 'off';
  /** The Solo writer: off (As before), on (Planned, docs/SOLO-PLAN.md: landings first) or perform (Melody + player, docs/SOLO-MELODY.md and SOLO-PLAYER.md). Missing or removed values in older links: off. */
  soloPlan?: 'on' | 'off' | 'perform' | 'tune';
  /** Tune first only (docs/SOLO-TUNE.md): how many versions of a solo are written before the best as a tune is kept (the page never sets it). */
  soloTuneTries?: number;
  /** Tune first only (docs/SOLO-MOOD.md): the mood's character in the intervals, jumps, pace and colour notes (missing in older links: off). */
  soloMood?: 'on' | 'off';
  /** Tune first with Solo mood: the mood turns the scale's 3rd and 6th over chords with no third (missing in older links: off). */
  soloMoodScale?: 'on' | 'off';
  /** Tune first: the plot comes from the chords, the section's tension and the mood, not a random energy shape (docs/SOLO-HARMONY.md). */
  soloStory?: 'on' | 'off';
  /** With Solo story: the shape of the energy, picked by the song (auto) or chosen (docs/SOLO-HARMONY.md). */
  soloStoryShape?: ShapeChoice;
  /** With Solo story and Solo expression: the expression follows the story's energy (quick notes, bends and breaths rise and fall with it; docs/SOLO-EXPRESSION-FOLLOW.md). Missing in older links: off. */
  soloStoryFollow?: 'on' | 'off';
  /** With Solo story: each phrase's strong note is picked for the chord it lands on (a note that leans on a chord that wants to move, a root or 3rd on a place to rest), and a phrase one chord loop later plays the figure again (docs/SOLO-HARMONY.md step 3). Missing in older links: off. */
  soloStoryNotes?: 'on' | 'off';
  /** With Solo story: the solo's last note is picked to be a note of the next section's first chord, or a semitone from one (docs/SOLO-HARMONY.md step 3b). Missing in older links: off. */
  soloStoryHand?: 'on' | 'off';
  /** With Solo story: of the twelve versions, the one that tells the plot best wins among those that pass as a tune (docs/SOLO-HARMONY.md step 4). Missing in older links: off. */
  soloStoryScore?: 'on' | 'off';
  /** With Solo story: the notes inside the phrases follow the chord's pull (notes that want to move over a chord that wants to move, notes that rest over home; docs/SOLO-HARMONY.md step 3c). Missing in older links: off. */
  soloStoryTense?: 'on' | 'off';
  /** Mood song (docs/MOOD-SONG.md): the song's mode and/or its tempo and drum feel follow the mood chosen (not on Auto). Missing in older links: off. */
  moodSong?: 'off' | 'tempo' | 'mode' | 'both';
  /** Mood riff (docs/MOOD-RIFF.md): the mood picks the riff styles (sad: single notes, arpeggios, low pedal; bold: gallops, big chords) and a major key's riff takes the major 3rd. Missing in older links: off. */
  moodRiff?: 'on' | 'off';
  /** Riff genres (docs/RIFF-WIRE.md): 'new' = the riffs are written by the riff writer (src/parts/riffwriter.ts) where it can (4/4, styles it writes); otherwise, and in older links, the classic riffs. */
  riffWriter?: 'new' | 'classic';
  /** Mood: all the way (docs/MOOD-ALL.md): Tune first solos with Solo mood and Mood scale, Mood song and Mood riff, in one switch. On Auto it uses the mood Auto picks for the song. Missing in older links: off. */
  moodAll?: 'on' | 'off';
  /** Melody + player only (docs/SOLO-MELODY.md, step 0f): a phrase repeats its first beat or two of rhythm (missing in older links: off). */
  soloMotif?: 'on' | 'off';
  /** Melody + player only (step 0f): after a busy stretch of quick notes the player lets the next note be (missing in older links: off). */
  soloBreath?: 'on' | 'off';
  /** Melody + player only (step 0f): in a straight groove the player's figures start and land on the 8th, not on an odd 16th or in a triplet (missing in older links: off). */
  soloGrid?: 'on' | 'off';
  /** Melody + player only (docs/SOLO-CORE.md): "only" writes just the core notes of about half the bars, so they can be heard alone; "travel" adds moves between them (step 2); "story" plans the part of every gap in the solo's story, without notes yet (docs/SOLO-STORY.md). Missing in older links: every phrase, as before. */
  soloCores?: 'only' | 'travel' | 'story' | 'recipes' | 'library' | 'off';
  /** Core notes only (docs/SOLO-CLIMAX.md): the climax core is played, not just held (missing in older links: off). */
  soloClimax?: 'on' | 'off';
  /** Every solo writer (docs/SOLO-SOUNDS.md): solos and lead breaks get pinch and natural harmonics, whammy dives, feedback and a pick scrape, by genre (missing in older links: off). */
  soloSounds?: 'on' | 'off';
  /** Wah pedal in front of the guitar amp: an auto-wah on some funk rhythm guitars, a cocked wah on some solos (docs/WAH.md; missing in older links: off). */
  wah?: 'on' | 'off' | 'subtle' | 'strong';
  /** The solo player's polish on the chosen-bars (core note) modes: the story notes are dressed like the other solo writers' (docs/SOLO-POLISH.md). */
  soloPolish?: 'on' | 'off';
  /** The story's own dynamics on the core note modes: loudness follows the arc, a laid-back start, a closing ring (docs/SOLO-SHAPE.md). */
  soloShape?: 'on' | 'off';
  /** Tune first only (docs/SOLO-EXPRESSION.md): the melody played the way a guitarist would: held bent notes, quick runs, flurries and breaths in windows of any length; replaces Solo polish (missing in older links: off). */
  soloExpress?: 'on' | 'off';
  /** Bend dials (docs/SOLO-BENDS.md): on Solo expression, each bent note gets its own speed, shape and timing, by its place. 'plain' (default): the engine's one fixed bend. */
  soloBends?: 'dials' | 'plain';
  /** Recast (docs/SOLO-RECAST.md): on Solo expression, some runs become a named lick, a legato roll, a pedal figure or a trill climb, and some held notes slide in or trill. 'off' (default): the runs as they were. */
  soloRecast?: 'on' | 'off';
  /** Echo (docs/SOLO-ECHO.md): on Solo expression, an answer plays its call's figure again on its own notes, and one signature figure comes back near the climax and the end. 'off' (default): every window on its own. */
  soloEcho?: 'on' | 'off';
  /** How much Solo expression changes the tune (docs/SOLO-AMOUNT.md): 'light' leaves most of it as written; 'full' changes more. 'normal' (default, and missing in older links): as before. */
  soloAmount?: 'light' | 'normal' | 'full';
  /** What the band plays under a solo (docs/SOLO-BACKING.md): 'held' = the song's chords kept, the rhythm guitar ringing each one held (power chords or full chords) instead of its riff; otherwise as written (missing in older links: as written). */
  soloBacking?: 'held' | 'written';
  /** Solo variation (docs/SOLO-VARY.md): in a solo of 16 bars or more, one stretch of 4 or 8 bars gets another band feel (lighter, half-time or lifted drums; the other section's chords, or held chords). Off (default, and missing in older links): the same band all through. */
  soloVary?: 'on' | 'off';
  /** Lead in bridges and breakdowns (docs/BRIDGE-LEAD.md): a bridge or breakdown whose Guitar 2 plays a melodic line gets it written like a short lead break (the solo writer and Solo expression, sparse), and the drummer fills under it. Off (default, and missing in older links): the older Guitar 2 line. */
  bridgeLead?: 'on' | 'off';
  /** Checks only (scripts/solo-*-check.ts), never set by the page: a step of the melody + player writer on its own (the melody, with gap marks, with joins, or read and left as written). */
  soloCheck?: 'melody' | 'marks' | 'joins' | 'player';
  /** When the rhythm guitar plays (src/players/presence.ts): it sits out intros, verses and bridges, comes in late, drops out, as in real songs (missing in older links: off). */
  guitarPlan?: 'on' | 'off';
  /** The song's mood, which shapes its tension and release (missing in older links: Auto). */
  mood?: MoodChoice;
  /** Sections in order, when edited by hand (otherwise the genre template decides). */
  order?: SectionKind[];
  /** Rhythm instrument chosen by hand for a kind of section (every verse, every chorus...). */
  sounds?: Partial<Record<SoundSlot, SoundId>>;
  /** Chords you set on a block (every verse, pre-chorus or bridge plays them). The chorus is the idea's own sheet. */
  chords?: Partial<Record<ChordBlock, ChordSheet>>;
}

/** Blocks whose chords you can set in a track (the chorus is the idea itself). */
export type ChordBlock = 'verse' | 'pre' | 'bridge' | 'chorus';

/**
 * Where a section's chords are set: a block (its bars as written, `opts.chords` its sheet), or the idea
 * itself (`block` 'idea'). A section's bar i is bar `from + i % n` of `idea`.
 */
export interface ChordTarget { block: ChordBlock | 'idea'; idea: Idea; from: number; n: number }

export const defaultTrackOptions = (src: Idea): TrackOptions => {
  const s = src.seeds.song;
  return {
    seeds: { structure: `${s}-track`, verse: `${s}-verse`, pre: `${s}-pre`, bridge: `${s}-bridge`, hook: `${s}-hook`, chorus: `${s}-chorus` },
    // (Paul: layered intros and long outros by default: an 8-bar intro built up in two steps, and an
    // outro whose last line repeats as a tag)
    intro: 'layered', outro: 'long', pre: 'auto', interlude: 'auto', keyChange: 'auto',
  };
};

export interface Track {
  /** The idea the track grew from. */
  source: Idea;
  opts: TrackOptions;
  /** The order of sections actually built (edit a copy of this to rearrange the track). */
  order: SectionKind[];
  /** Each section is a playable idea with `section` set. */
  sections: Idea[];
  bars: number;
  steps: number;
  /** Where each kind of section's chords can be set (kinds missing here can't be edited). */
  edit: Partial<Record<SectionKind, ChordTarget>>;
  /** Riff genres: the idea's riff plays the verses, and (`newChorus`) the chorus is new music. */
  riffVerse: boolean;
  newChorus: boolean;
  /** The song's mood (picked, or chosen on Auto), and which section is its climax. */
  mood: Mood;
  climax: number;
}

/** Length in seconds at the track's tempo. */
export const trackSeconds = (t: Track) => (t.steps * 15) / t.source.song.bpm;

/* ------------------------------------------------------------ structure */

interface Slot {
  kind: SectionKind;
  energy: number;
  segs: Seg[];
  /** Guitar 2: keep what the block has, drop it, rewrite it, force roles, or play the track's hook. */
  g2: 'keep' | 'drop' | 'pick' | 'play' | 'lead' | 'swell' | 'hook' | 'build' | 'solo'
    // the lead player: answering the singer (sparse, or busier in later verses), a climb into the chorus
    | 'answer' | 'answerMore' | 'climb'
    // Breaks: a lead break (a short melodic solo, no singing)
    | 'break';
  intro?: 'alone' | 'band' | 'layered' | 'long';
  /** Number for repeated kinds ("Verse 2"). */
  n?: number;
  /** The last chorus: everything, and the key change. */
  final?: boolean;
}

export const KIND_LABEL: Record<SectionKind, string> = {
  intro: 'Intro', verse: 'Verse', prechorus: 'Pre-chorus', chorus: 'Chorus', interlude: 'Interlude',
  bridge: 'Bridge', breakdown: 'Breakdown', solo: 'Solo', outro: 'Outro',
};

const STRUM_DESC = (e: number, genre: Genre) =>
  e <= 1 ? 'held chords'
    : e === 2 ? (genre === 'funk' ? 'the same groove, softer' : genre === 'pop' ? 'lighter strumming' : 'palm mutes, lighter strumming')
      : e >= 5 ? (genre === 'funk' ? 'full groove' : 'fuller strumming, every beat struck') : 'full strumming';

/** Genres that get a guitar solo on Auto. */
const SOLO_GENRES: Genre[] = ['rock', 'hardrock', 'metal', 'grunge'];

/** How often a track gets pre-choruses. */
const PRE_CHANCE: Record<Genre, number> = { rock: 0.5, pop: 0.55, funk: 0.15, hardrock: 0.5, metal: 0.35, grunge: 0.35, altmetal: 0.4 };

/** Funk verses vamp. */
const FUNK_VERSE: Plan[] = [[[0, 8]], [[0, 4], [5, 4]], [[0, 2], [5, 2]]];

/** Riff styles that make the best hook to bring back in intros and interludes. */
const HOOKY: readonly RiffStyle[] = ['picked', 'lick', 'gallop', 'pedal', 'single'];

/** A pre-chorus that doesn't start on the chorus's first chord (or it would steal the chorus's arrival). */
function prePlan(rng: Rng, plans: Plan[], chorus: Seg[]): Plan {
  const first = join(take(chorus, 1), { kind: 'chorus', label: '', energy: 4 }).chords.timeline[0].chord.root;
  const ok = plans.filter((p) => p[0][0] !== first);
  return rng.pick(ok.length ? ok : plans);
}

/** Tracks run about 2–3 minutes: optional sections go when it would be longer. */
const MAX_SECONDS = 210;
/** Solo New, above 100 bpm: the chance of a longer solo, by genre. */
const LONG_SOLO: Record<Genre, number> = { metal: 0.7, hardrock: 0.65, rock: 0.5, altmetal: 0.5, grunge: 0.45, funk: 0.35, pop: 0.3 };

/** What Mood song asks of the idea: nothing on Auto (the Auto mood comes from the song), or on a mood no longer in the list. */
export function moodSongOf(opts: TrackOptions): MoodSong | undefined {
  const v = opts.moodSong, riff = opts.moodRiff === 'on';
  const song = v === 'tempo' || v === 'mode' || v === 'both';
  if ((!song && !riff) || !opts.mood || opts.mood === 'auto' || !PROFILES[opts.mood as Mood]) return undefined;
  return { mood: opts.mood as Mood, ...(song ? { tempo: v !== 'mode', mode: v !== 'tempo' } : {}), ...(riff ? { riff: true } : {}) };
}

/** The options Mood: all the way turns on (the mood on Auto is the one Auto picks for the song as the genre wrote it). */
export function moodAllOpts(given: TrackOptions, srcIn: Idea): TrackOptions {
  if (given.moodAll !== 'on') return given;
  const auto = !given.mood || given.mood === 'auto' || !PROFILES[given.mood as Mood];
  return { ...given, ...(auto ? { mood: autoMood(srcIn.song, srcIn.seeds.song) } : {}), soloPlan: 'tune', soloMood: 'on', soloMoodScale: 'on', moodSong: 'both', moodRiff: 'on' };
}

export function buildTrack(srcIn: Idea, given: TrackOptions = defaultTrackOptions(srcIn)): Track {
  // (Mood: all the way: the five mood switches, whatever they were set to)
  const moodAll = moodAllOpts(given, srcIn);
  // (an old link may carry a Solo writer that is gone: it plays as "As before")
  const opts: TrackOptions = moodAll.soloPlan === 'on' || moodAll.soloPlan === 'perform' || moodAll.soloPlan === 'tune' || moodAll.soloPlan === undefined ? moodAll : { ...moodAll, soloPlan: 'off' };
  // (Mood song: the same seeds, the song written again for the mood; switched off, back as it was)
  const want = moodSongOf(opts);
  const src = JSON.stringify(srcIn.opts.moodSong ?? null) === JSON.stringify(want ?? null) ? srcIn : generate({ ...srcIn.opts, moodSong: want }, srcIn.seeds);
  const S = opts.seeds;
  // (Tune first, docs/SOLO-TUNE.md: its own melody writer; the player dresses it, lightly, behind Solo polish)
  const tuneFirst = opts.soloPlan === 'tune';
  const coreOn = !tuneFirst && isCoreMode(opts.soloCores);
  // separate random streams, so rerolling one block leaves everything else as it was
  const rng = new Rng(S.structure);
  // the mood: how the song builds and lets go (tension.ts); it leans the quiet sections, the key
  // change and the stops its way
  const moodAuto = !given.mood || given.mood === 'auto';
  const mood: Mood = !opts.mood || opts.mood === 'auto' ? autoMood(src.song, src.seeds.song) : opts.mood as Mood;
  const MP = PROFILES[mood];
  const mr = new Rng(`${S.structure}-${mood}`);
  // (a block's chords: the mood's own about half the time)
  const moodPlan = (part: 'verse' | 'pre' | 'bridge', plan: Plan): Plan => {
    const extra = genre === 'funk' && part === 'verse' ? undefined : MOOD_PLANS[mood]?.[isMinor(src.song.mode) ? 'minor' : 'major']?.[part];
    return extra?.length && mr.chance(0.55) ? mr.pick(extra) : plan;
  };
  // (Mood riff: the riff styles of a verse or a bridge, weighted by what the mood likes)
  const likeRiffs = (list: [RiffStyle, number][]): [RiffStyle, number][] => (opts.moodRiff === 'on' ? list.map(([x, wt]) => [x, wt * riffLike(mood, x)]) : list);
  const vr = new Rng(S.verse), pr = new Rng(S.pre), br = new Rng(S.bridge);
  const { genre, mode } = src.song;
  const riff = !!src.song.sections;
  const P = plansFor(mode);
  // the idea again, but the drums never wait out its first bars (it gets sliced and repeated)
  const baseSong = { ...src.song, noTacet: true, ...(opts.riffWriter === 'new' ? { newRiff: true } : {}) };
  // (the idea as written: the rhythm player's performance of it is redone section by section)
  const written = asWritten(src);
  const base = riff ? buildIdea(src.opts, src.seeds, baseSong, withSheet(src.opts, src.seeds, baseSong)) : written;
  const preRoll = rng.chance(PRE_CHANCE[genre]);
  const withPre = opts.order ? opts.order.includes('prechorus') : opts.pre === 'on' || (opts.pre === 'auto' && preRoll);
  const vTag = `v-${S.verse}`, pTag = `p-${S.pre}`, bTag = `b-${S.bridge}`;
  const cSeed = S.chorus ?? `${src.seeds.song}-chorus`;
  const seedOf = (b: ChordBlock) => (b === 'chorus' ? cSeed : S[b]);
  let riffVerse = false, newChorus = false;
  // chords you set on a block: the block's own chords are written around them, like the idea's
  const pinned = (b: ChordBlock) => hasPins(opts.chords?.[b]);
  const pin = (b: ChordBlock, song: Song, f?: BuildOptions['chords']): BuildOptions['chords'] => {
    const sheet = opts.chords?.[b];
    if (!hasPins(sheet)) return f;
    return (c) => applySheet(new Rng(`${seedOf(b)}-sheet`), song, f ? f(c) : c, sheet);
  };

  let verse: Seg[], chorus: Seg[], bridge: Seg[], hookSegs: Seg[];
  let pre: Seg[] | null = null;
  let verseE: number, bridgeE: number, bridgeKind: SectionKind = 'bridge';
  let home: Chord;

  if (riff) {
    const R = GENRES[genre].riff!;
    const s = base.song.sections!;
    const [va, vb] = [s[0], s[4]];
    let verseStyle = va;
    // the hook: the most riff-like half of the idea
    const hookHalf = [0, 1].find((h) => HOOKY.includes(s[h * 4]));
    const split = va !== vb && S.verse === defaultTrackOptions(src).seeds.verse;
    const rv = opts.riffVerse ?? 'auto';
    riffVerse = rv === 'on' || (rv === 'auto' && new Rng(`${S.structure}-riffverse`).chance(hookHalf !== undefined ? 0.5 : 0.25));
    if (split) {
      // ideas that change style halfway split: first half is the verse, second half the chorus
      // (with chords you set on the verse: the same riff, written to them)
      const v = pinned('verse')
        ? block(base, vTag, [], { sections: fill8(va) }, pin('verse', base.song, withSheet(src.opts, src.seeds, baseSong).chords))
        : base;
      verse = [seg(v, 0, 4), seg(v, 0, 4)];
      chorus = [seg(base, 4, 4), seg(base, 4, 4)];
    } else {
      // a new verse riff (also when the verse is rerolled): it sits on the home chord and moves in its last bar
      chorus = va !== vb ? [seg(base, 4, 4), seg(base, 4, 4)] : [seg(base)];
      const chorusStyle = vb;
      const options = likeRiffs(R.verse).filter(([x]) => x !== chorusStyle);
      verseStyle = options.length ? vr.weighted(options) : 'arp';
      const move = vr.pick(RIFF_VERSE_MOVE[isMinor(mode) ? 'minor' : 'major']);
      verse = [seg(block(base, vTag, ['chords', 'strum'], { sections: fill8(verseStyle) },
        pin('verse', base.song, planned(base.song, [[0, 3], [move, 1]], vr, !chordal(verseStyle)))))];
    }
    hookSegs = hookHalf !== undefined ? [seg(base, hookHalf * 4, 4)] : take(chorus, 4);
    // the riff carries the song: it plays under the verses (an idea that splits with the riff first
    // already does). A chorus that would play the same riff gets new chords and big chords instead.
    if (riffVerse && !(split && hookHalf === 0)) {
      const h = hookSegs[0];
      verse = [h, h];
      verseStyle = s[h.from];
      if (chorus.some((c) => c.idea === h.idea && c.from < h.from + h.n && h.from < c.from + c.n)) {
        newChorus = true;
        const cr = new Rng(cSeed);
        const style = cr.weighted<RiffStyle>([['big', 3], ['chug', verseStyle === 'chug' ? 0 : 1]]);
        chorus = [seg(block(base, `c-${cSeed}`, ['chords', 'strum'], { sections: fill8(style) },
          pin('chorus', base.song, planned(base.song, cr.pick(CHORUS_PLANS[isMinor(mode) ? 'minor' : 'major']), cr, !chordal(style)))))];
      }
    }
    const quietVerse = QUIET_STYLES.includes(verseStyle);
    verseE = quietVerse ? 2 : 3;
    if (withPre) {
      const preStyle = pr.weighted<RiffStyle>([['big', 3], ['chug', 2]]);
      pre = [seg(block(base, pTag, ['strum', 'drums'], { sections: fill8(preStyle) },
        pin('pre', base.song, planned(base.song, moodPlan('pre', prePlan(pr, P.pre, chorus)), pr, !chordal(preStyle)))), 0, 4)];
    }
    if (R.breakdown) {
      bridgeKind = 'breakdown';
      bridgeE = 5;
      bridge = [seg(block(base, bTag, ['strum', 'drums'], { sections: fill8('chug'), forceHalf: true }, pin('bridge', base.song, tonicOnly)))];
    } else {
      br.chance(0.4);
      const quiet = !quietVerse && mr.chance(MP.quiet * 0.6);
      const options = likeRiffs(R.bridge).filter(([x]) => x !== vb && x !== verseStyle);
      const style: RiffStyle = quiet ? 'arp' : options.length ? br.weighted(options) : 'single';
      bridgeE = quiet ? 2 : 4;
      bridge = [seg(block(base, bTag, ['chords', 'strum'], { sections: fill8(style), forceHalf: quiet ? undefined : true },
        pin('bridge', base.song, planned(base.song, moodPlan('bridge', br.pick(P.bridge)), br, !chordal(style)))))];
    }
    home = { root: 0, q: '5' };
  } else {
    chorus = [seg(written)];
    // verse chords from a plan that ends on V (leading into the chorus), different from the chorus
    const vPlans = genre === 'funk' ? FUNK_VERSE : P.verse;
    let vb: Idea | null = null;
    for (let i = 0; i < 5 && (!vb || chordSig(vb) === chordSig(src)); i++) {
      // the verse gets its own groove (a drummer plays the verse differently from the chorus)
      vb = block(src, `${vTag}${i || ''}`, ['strum', 'drums'], { avoidGroove: src.drums.groove }, pin('verse', src.song, planned(src.song, moodPlan('verse', vr.pick(vPlans)), vr, false)));
    }
    verse = [seg(vb!)];
    // usually a soft first verse, so the chorus lands
    vr.pick([2, 2, 2, 3]);
    verseE = mr.chance(MP.quiet) ? 2 : 3;
    if (withPre) pre = [seg(block(src, pTag, ['strum'], {}, pin('pre', src.song, planned(src.song, moodPlan('pre', prePlan(pr, P.pre, chorus)), pr, false))), 0, 4)];
    br.weighted([[2, 1], [3, 2], [4, 1]]);
    bridgeE = mr.weighted([[2, MP.quiet], [3, 1], [4, 1 - MP.quiet * 0.8]]);
    // pop bridges are four bars: the plan at double speed, still ending on V
    const bPlan: Plan = moodPlan('bridge', br.pick(P.bridge)).map(([r, n, q]): Plan[number] => [r, genre === 'pop' ? Math.max(1, n / 2) : n, q]);
    const b = block(src, bTag, ['strum'], { forceHalf: bridgeE <= 3 ? !src.drums.halfTime : undefined }, pin('bridge', src.song, planned(src.song, bPlan, br, false)));
    bridge = genre === 'pop' ? [seg(b, 0, 4)] : [seg(b)];
    hookSegs = take(chorus, 4);
    const tl = src.chords.timeline;
    home = (tl.find((e) => e.chord.root === 0) ?? tl[0]).chord;
  }

  // where each kind of section's chords are set: a block's bars as written, or the idea (the chorus)
  const view = (b: ChordBlock, x: Seg): ChordTarget => {
    const v = join([x], { kind: 'verse', label: '', energy: 3 });
    return { block: b, idea: { ...v, section: undefined, notes: [], opts: { ...v.opts, chords: opts.chords?.[b] } }, from: x.from, n: x.n };
  };
  // (a riff that plays the verses is the idea's: its chords are the idea's; a new chorus is its own block)
  const ideaAt = (x: Seg): ChordTarget => ({ block: 'idea', idea: src, from: x.from, n: x.n });
  const chorusAt = newChorus ? view('chorus', chorus[0]) : ideaAt(chorus[0]);
  const edit: Track['edit'] = {
    verse: riffVerse && verse[0].idea === base ? ideaAt(verse[0]) : view('verse', verse[0]), chorus: chorusAt, outro: chorusAt,
    ...(pre ? { prechorus: view('pre', pre[0]) } : {}),
    [bridgeKind]: view('bridge', bridge[0]),
  };
  const kept: Partial<Record<SectionKind, boolean>> = {
    chorus: newChorus ? pinned('chorus') : hasPins(src.opts.chords), interlude: hasPins(src.opts.chords), outro: hasPins(src.opts.chords),
    verse: pinned('verse'), prechorus: pinned('pre'), bridge: pinned('bridge'), breakdown: pinned('bridge'),
  };

  // strummed genres: a lead hook over the chorus chords, which comes back through the track.
  // If the idea's Guitar 2 already plays a melody throughout, that melody is the hook.
  let hook: GuitarHit[] = [];
  let hookNote = '';
  const hookBase = join(chorus, { kind: 'chorus', label: '', energy: 4 });
  if (!riff) {
    const g2Line = src.notes.find((n) => n.startsWith('Guitar 2')) ?? '';
    const defaultHook = S.hook === defaultTrackOptions(src).seeds.hook;
    if (defaultHook && /^Guitar 2: (octave )?melody( \([^)]*\))? throughout/.test(g2Line) && hookBase.guitar2.length) {
      hook = hookBase.guitar2;
      hookNote = 'Guitar 2: the idea\'s melody, as the hook';
    } else {
      hook = generateHook(new Rng(S.hook), hookBase.song, hookBase.chords, null, { lines: src.opts.leadLines });
      hookNote = 'Guitar 2: the hook, a melody that comes back through the track';
    }
  }
  /** The hook's first `n` bars, placed from bar `at` of a section. */
  const placeHook = (idea: Idea, at: number, n: number) => {
    const len = hookBase.song.bars.slice(0, n).reduce((a, b) => a + b.len, 0);
    const off = idea.song.bars[at]?.start ?? 0;
    idea.guitar2 = hook.filter((h) => h.step < len && h.step + off < idea.song.total).map((h) => ({ ...h, step: h.step + off }));
  };

  // intro: layered (the hook alone, then the band joins), the hook alone, or the band playing softly
  const verseQuiet = verseE <= 2 && riff;
  const introRoll = rng.weighted<'alone' | 'band' | 'layered' | 'long'>(riff
    ? [['layered', verseQuiet ? 1 : 3], ['alone', 3], ['band', verseQuiet ? 0 : 1], ['long', verseQuiet ? 1 : 2]]
    : [['layered', 1], ['alone', 2], ['band', 2], ['long', 1]]);
  const introKind = opts.intro === 'auto' ? introRoll : opts.intro;
  const alone: Slot = { kind: 'intro', energy: riff && !verseQuiet ? 2 : 1, segs: take(verseQuiet ? verse : hookSegs, 4), g2: riff ? 'drop' : 'hook', intro: 'alone' };
  const layered: Slot = { kind: 'intro', energy: 3, segs: [...take(hookSegs, 4), ...take(hookSegs, 4)], g2: riff ? 'drop' : 'hook', intro: 'layered' };
  const introSlot: Slot = introKind === 'long'
    ? { kind: 'intro', energy: 3, segs: [0, 1, 2, 3].flatMap(() => take(hookSegs, 4)), g2: riff ? 'pick' : 'hook', intro: 'long' }
    : introKind === 'band'
      ? { kind: 'intro', energy: riff ? 4 : 2, segs: take(riff ? chorus : verse, 4), g2: 'drop', intro: 'band' }
      : introKind === 'layered' ? layered : alone;

  // the order of sections: by hand, or the genre's template
  rng.chance(0.3);
  const keyRoll = mr.chance(MP.keyChange);
  let order: SectionKind[];
  if (opts.order?.length) order = [...opts.order];
  else {
    // on Auto, an interlude only some of the time: it's the chorus chords again, and choruses already fill much of a song
    // (when the riff plays the verses, it comes back after the first chorus to lead into the next verse)
    const interlude = opts.interlude === 'on' || (opts.interlude === 'auto' && (riffVerse || new Rng(`${S.structure}-interlude`).chance(0.4)));
    order = ['intro', 'verse', ...(pre ? ['prechorus' as const] : []), 'chorus', ...(interlude ? ['interlude' as const] : []),
      'verse', ...(pre ? ['prechorus' as const] : []), ...(genre !== 'funk' ? ['chorus' as const] : []), bridgeKind, 'chorus', 'outro'];
  }
  // the bridge block plays wherever a bridge or breakdown is asked for
  order = order.map((k) => (k === 'bridge' || k === 'breakdown' ? bridgeKind : k));

  // guitar solos: usually after the second chorus (before the bridge); sometimes after the first
  // instead (in place of the interlude), and now and then a second one at the end, over the outro
  const soloSeed = S.solo ?? `${S.structure}-solo`;
  const sr = new Rng(soloSeed);
  const soloOpt = opts.solo ?? 'auto';
  const soloOn = soloOpt === 'on' || (soloOpt === 'auto' && SOLO_GENRES.includes(genre));
  let outroSolo = false;
  if (soloOn && !opts.order?.length) {
    const cs = order.flatMap((k, i) => (k === 'chorus' ? [i] : []));
    const early = cs.length < 3 || sr.chance(0.3);
    const at = early ? cs[0] : cs[1];
    if (at !== undefined) {
      if (early && order[at + 1] === 'interlude') order[at + 1] = 'solo';
      else order.splice(at + 1, 0, 'solo');
    }
    outroSolo = sr.chance(0.2);
  }
  // Breaks (switch): a song with no solo has no lead guitar now and then, else a lead break after a chorus
  const breakRng = new Rng(`${S.structure}-breaks`);
  const breaksOn = !!src.opts.leadBreaks && !order.includes('solo');
  const noLead = breaksOn && breakRng.chance(NO_LEAD[genre]);
  let leadBreak = false;
  // (an interlude the song already has becomes the break; else one goes in after a chorus)
  if (breaksOn && !noLead && !opts.order?.length && breakRng.chance(BREAK[genre])) {
    const cs = order.flatMap((k, i) => (k === 'chorus' ? [i] : []));
    const at = cs.length >= 3 ? cs[1] : cs[0];
    if (order.includes('interlude')) leadBreak = true;
    else if (at !== undefined) { order.splice(at + 1, 0, 'interlude'); leadBreak = true; }
  }
  // over the verse's chords or the chorus's; 16 bars for heavier styles, now and then
  const soloOverChorus = sr.chance(0.4);
  let soloBars = (genre === 'metal' || genre === 'hardrock') && sr.chance(0.5) ? 16 : 8;
  // Solo New: songs above 100 bpm get longer solos more often (room for the energy's waves): 16 bars, now and then
  // 24 above 130 bpm
  if (src.opts.leadSolo && src.song.bpm > 100) {
    const lr = new Rng(`${S.structure}-long-solo`);
    if (lr.chance(LONG_SOLO[genre])) soloBars = src.song.bpm > 130 && lr.chance(0.35) ? 24 : Math.max(soloBars, 16);
  }

  const verse2E = riff ? verseE : Math.min(3, verseE + 1);
  // the outro: a jam (new music in a new key), or long (the chorus's last line repeats as a tag), or short
  const outroOpt = opts.outro ?? 'auto';
  const jamSeed = riff ? S.structure : S.hook; // rerolling the outro rerolls its jam
  let outroJam = outroOpt === 'jam' || (outroOpt === 'auto' && new Rng(`${jamSeed}-jam`).chance(riff ? 0.3 : 0.15));
  let outroLong = !outroJam && (outroOpt === 'long' || (outroOpt === 'auto' && new Rng(`${S.structure}-outro`).chance(0.4)));
  // the jam: a new key (up a step to minor, or the relative minor or major), a short chord loop and
  // (riff genres) a new driving riff; half-time for 8 bars, then the full band for 8
  let jam: { segs: Seg[]; home: Chord; note: (key: number) => string } | null = null;
  if (outroJam) {
    const jr = new Rng(`${jamSeed}-jamkey`);
    const minorHome = isMinor(mode);
    const [shift, jamMode] = minorHome
      ? jr.weighted<[number, Mode]>([[[3, 'major'], 2], [[5, 'minor'], 1], [[2, 'minor'], 1]])
      : jr.weighted<[number, Mode]>([[[2, 'minor'], 2], [[9, 'minor'], 2]]);
    const R = GENRES[genre].riff;
    const loud = (R ? [...R.verse, ...R.bridge] : []).filter(([x]) => !QUIET_STYLES.includes(x) && x !== 'arp');
    const style: RiffStyle | undefined = R ? (loud.length ? jr.weighted(loud) : 'chug') : undefined;
    const plan = jr.pick(JAM_PLANS[isMinor(jamMode) ? 'minor' : 'major']);
    const over = { key: (src.song.key + shift) % 12, mode: jamMode, ...(style ? { sections: fill8(style) } : {}) };
    const from = riff ? base : written;
    const write = (half: boolean) => block(from, `j-${jamSeed}`, ['chords', 'strum', 'drums', 'bass'], { ...over, forceHalf: half },
      planned({ ...from.song, ...over }, plan, new Rng(`${jamSeed}-jamchords`), !!style && !chordal(style)));
    const a = write(true), b = write(false);
    jam = {
      segs: [seg(a), seg(b)],
      home: a.chords.timeline[0].chord,
      note: (key: number) => `Outro jam: a new key (${NOTE_NAMES[key]} ${jamMode}), a chord loop${style ? ` and a new ${RIFF_STYLE_LABEL[style]} riff` : ''}; half-time for 8 bars, then the full band, Guitar 2 leading`,
    };
  }
  const lastSeg = chorus[chorus.length - 1];
  const tag: Seg = { idea: lastSeg.idea, from: lastSeg.from + lastSeg.n - 2, n: 2 };
  const lastChorus = order.lastIndexOf('chorus');
  const choruses = order.filter((k) => k === 'chorus').length;
  // the lead player (Guitar 2, picked with the band): answers the singer through the verses and builds
  // up the pre-chorus, or (some players, some songs) leaves the verses to other parts
  const bandSeed = S.band ?? `${src.seeds.song}-band`;
  const lead = pickLead(bandSeed, src.song.partGenres.strum);
  const leadPlan = new Rng(`${bandSeed}-lead-plan`);
  // the solo player (Melody + player): the melody + joins, played like a guitarist would (the check step `player`: every note as written)
  const playSolo = (sol: Guitar2Part, seed: string, idea: Idea, mood: Mood, tension: number[], play: boolean): Guitar2Part =>
    performSolo(sol, { seed, band: bandSeed, song: idea.song, chords: idea.chords, lead, hands: leadHands(bandSeed, lead), mood, tension, drums: idea.drums, energy: idea.section!.energy, kind: idea.section!.kind, breath: opts.soloBreath === 'on' || coreOn || tuneFirst, grid: opts.soloGrid === 'on' || coreOn || tuneFirst, light: coreOn || tuneFirst }, play ? LIVE_RULES : NO_RULES);
  // Solo expression (docs/SOLO-EXPRESSION.md): the Tune first melody played again in windows, bent and held, run and breathed
  const expressTune = (sol: Guitar2Part, seed: string, idea: Idea, mood: Mood, tension: number[]): Guitar2Part =>
    expressSolo(sol, { seed, band: bandSeed, song: idea.song, chords: idea.chords, lead, hands: leadHands(bandSeed, lead), mood, tension, drums: idea.drums, energy: idea.section!.energy, kind: idea.section!.kind }, { dials: opts.soloBends === 'dials', recast: opts.soloRecast === 'on', echo: opts.soloEcho === 'on', follow: opts.soloStory === 'on' && opts.soloStoryFollow === 'on', amount: opts.soloAmount === 'light' || opts.soloAmount === 'full' ? opts.soloAmount : 'normal' });
  // Lead guitar sounds (docs/SOLO-SOUNDS.md): harmonics, dives, feedback and a pick scrape put on the finished solo (its own seed: nothing else changes)
  // (the amp is the section's own Guitar 2 sound, as on Auto; `before` and `after` are the sections either side)
  const withSounds = (sol: Guitar2Part, seed: string, idea: Idea, lick: LickKind, intensity: number, solo: boolean, said: string[], si: number): Guitar2Part => {
    const info = idea.section!, total = idea.song.total, before = slots[si - 1], after = slots[si + 1];
    const sound = info.sound?.guitar2 ?? AUTO_GUITAR2[idea.song.partGenres.strum];
    const got = addLeadSounds(new Rng(`${seed}-sounds`), sol.hits, {
      genre: idea.song.genre, lick, intensity, solo, energy: info.energy, bpm: idea.song.bpm,
      amp: sound === 'electric-clean' ? 'clean' : sound === 'acoustic' ? 'acoustic' : sound === 'piano' ? 'none' : 'driven',
      barStarts: idea.song.bars.map((b) => b.start),
      tonesAt: (g) => chordTones(idea.song.key, idea.chords.timeline[idea.chords.chordIdx[Math.max(0, Math.min(g, total - 1))]].chord),
      curve: sol.curve?.energy,
      dropAfter: !after || after.energy < info.energy, songEnd: !after, liftIn: !!before && before.energy < info.energy,
      keyUp: keyUp && finalAt >= 0 && si >= finalAt ? keyUp : 0,
    });
    const names = { pinch: 'pinch harmonic', natural: 'natural harmonic', dive: 'whammy dive', feedback: 'feedback', scrape: 'pick scrape' };
    if (got.done.length) said.push(`Lead sounds: ${[...new Set(got.done)].map((d) => names[d]).join(', ')}`);
    return { ...sol, hits: got.hits };
  };
  // how the melody writer is used: `perform` (the page) joins and plays; the check steps stop earlier
  const melody = opts.soloCheck ? { mode: opts.soloCheck === 'player' ? 'joins' as const : opts.soloCheck === 'melody' ? 'plain' as const : opts.soloCheck, play: false } : opts.soloPlan === 'perform' || tuneFirst ? { mode: 'joins' as const, play: true } : null;
  // Guitar 2's switches (Lines, Figures); with Figures, some songs (pop and rock most) have a picked figure through the verses
  const g2o: G2Options = { lines: src.opts.leadLines, figures: src.opts.leadFigures, figureSeed: `${bandSeed}-figure`, licks: src.opts.leadLicks ? new Set<string>() : undefined };
  const roomIntro = !!src.opts.leadRoom && new Rng(`${bandSeed}-room-intro`).chance(ROOM[src.song.partGenres.strum]);
  const twinRng = new Rng(`${bandSeed}-twin`);
  const twinKind = src.opts.leadTwin && twinRng.chance(TWIN[src.song.partGenres.strum]) ? twinRng.weighted(TWIN_KINDS[src.song.partGenres.strum]) : null;
  const figureVerses = !!src.opts.leadFigures && new Rng(`${bandSeed}-figure-song`).chance(FIGURE_SONGS[src.song.partGenres.strum]);
  const leadVerses = leadPlan.chance(lead.verses);
  const leadClimbs = leadVerses && leadPlan.chance(lead.climb);
  const seen: Partial<Record<SectionKind, number>> = {};
  const slotFor = (kind: SectionKind, i: number): Slot => {
    const n = (seen[kind] = (seen[kind] ?? 0) + 1);
    if (kind === 'intro') return { ...introSlot, n };
    if (kind === 'verse') {
      return n === 1 ? { kind, n, energy: verseE, segs: verse, g2: leadVerses ? 'answer' : 'drop' }
        : { kind, n, energy: verse2E, segs: verse, g2: leadVerses ? 'answerMore' : 'play' };
    }
    if (kind === 'prechorus') return { kind, n, energy: 3, segs: pre ?? take(verse, 4), g2: leadClimbs ? 'climb' : 'drop' };
    // (a lead break: eight bars over the chorus chords)
    if (kind === 'interlude' && leadBreak) return { kind, n, energy: 4, segs: take(chorus, 8), g2: 'break' };
    if (kind === 'interlude') return { kind, n, energy: 4, segs: hookSegs, g2: riff ? 'keep' : 'hook' };
    if (kind === 'bridge' || kind === 'breakdown') return { kind, n, energy: bridgeE, segs: bridge, g2: bridgeE <= 2 ? 'swell' : 'pick' };
    if (kind === 'solo') {
      const over = take(soloOverChorus ? chorus : verse, 8);
      return { kind, n, energy: 4, segs: Array.from({ length: soloBars / 8 }, () => over).flat(), g2: 'solo' };
    }
    if (kind === 'outro' && jam) return { kind, n, energy: 5, segs: jam.segs, g2: outroSolo ? 'solo' : 'lead' };
    if (kind === 'outro') return { kind, n, energy: 5, segs: outroLong ? [...take(chorus, 4), tag, tag] : take(chorus, 4), g2: outroSolo ? 'solo' : riff ? 'lead' : 'hook' };
    if (i === lastChorus && choruses > 1) return { kind, n, energy: 5, segs: chorus, g2: riff ? 'lead' : 'hook', final: true };
    return { kind, n, energy: 4, segs: chorus, g2: 'keep' };
  };
  let slots = order.map(slotFor);

  // automatic structure stays a song's length: drop the interlude, then pre-choruses, then shorten the intro
  const avgBar = src.song.total / src.song.bars.length;
  const seconds = (list: Slot[]) => (list.reduce((a, s) => a + s.segs.reduce((b, x) => b + x.n, 0), 0) * avgBar * 15) / src.song.bpm;
  if (!opts.order?.length) {
    if (seconds(slots) > MAX_SECONDS && opts.interlude === 'auto') slots = slots.filter((s) => s.kind !== 'interlude');
    // a 16-bar solo goes down to 8, and the outro solo back to the usual outro, before the pre-choruses go
    if (seconds(slots) > MAX_SECONDS && soloBars > 8) slots = slots.map((x) => (x.kind === 'solo' ? { ...x, segs: x.segs.slice(0, x.segs.length / (soloBars / 8)) } : x));
    if (seconds(slots) > MAX_SECONDS && outroSolo) slots = slots.map((x) => (x.kind === 'outro' && x.g2 === 'solo' ? { ...x, g2: jam ? 'lead' : riff ? 'lead' : 'hook' } : x));
    if (seconds(slots) > MAX_SECONDS && opts.pre === 'auto') slots = slots.filter((s) => s.kind !== 'prechorus');
    // a jam shortens to 4 + 4 bars before anything else goes
    if (seconds(slots) > MAX_SECONDS && jam) {
      const short = [seg(jam.segs[0].idea, 0, 4), seg(jam.segs[1].idea, 0, 4)];
      slots = slots.map((x) => (x.kind === 'outro' ? { ...x, segs: short } : x));
    }
    if (seconds(slots) > MAX_SECONDS && outroOpt === 'auto' && outroLong) {
      outroLong = false;
      slots = slots.map((x) => (x.kind === 'outro' ? { ...x, segs: take(chorus, 4) } : x));
    }
    if (seconds(slots) > MAX_SECONDS && opts.intro === 'auto' && slots[0].intro === 'long') slots[0] = { ...layered, n: 1 };
    if (seconds(slots) > MAX_SECONDS && opts.intro === 'auto' && slots[0].intro === 'layered') slots[0] = { ...alone, n: 1 };
  }
  // when there's room, the first verse plays twice through and Guitar 2 joins halfway: a song's verses
  // usually outweigh its choruses (8-bar verses left the chorus chords filling over half the track)
  const v1 = slots.findIndex((s) => s.kind === 'verse');
  if (v1 >= 0) {
    const longer = [...slots];
    longer[v1] = { ...slots[v1], segs: [...slots[v1].segs, ...slots[v1].segs], g2: 'build' as const };
    if (seconds(longer) <= MAX_SECONDS * 0.85) slots = longer;
  }
  // the tension curve over the whole song: each section's energy comes from it, and its level bar by bar
  const arc = planTension(slots.map((x) => ({
    kind: x.kind, bars: x.segs.reduce((a, g) => a + g.n, 0), final: x.final, energy: x.energy, intro: x.intro, solo: x.g2 === 'solo',
    big: x.kind === 'outro' && (x.g2 === 'solo' || !!jam),
  })), mood);
  slots.forEach((x, i) => { x.energy = arc.sections[i].energy; });
  // (Solo story: what the solo's plot is told about the song: the sections either side, whether the solo is the song's climax)
  const around = (i: number, edge: 'first' | 'last'): Around | undefined => {
    const sec = arc.sections[i], sl = slots[i];
    return sec && sl ? { kind: sl.kind, energy: sl.energy, edge: edge === 'first' ? sec.tension[0] : sec.tension[sec.tension.length - 1], mean: sec.tension.reduce((x, y) => x + y, 0) / sec.tension.length } : undefined;
  };
  const storyFor = (i: number): StoryIn | false => (opts.soloStory === 'on' ? { shape: isShapeChoice(opts.soloStoryShape) ? opts.soloStoryShape : 'auto', prev: around(i - 1, 'last'), next: around(i + 1, 'first'), climax: i === arc.climax } : false);

  // numbers only for kinds that repeat
  const total: Partial<Record<SectionKind, number>> = {};
  for (const s of slots) total[s.kind] = (total[s.kind] ?? 0) + 1;
  for (const s of slots) if ((total[s.kind] ?? 0) < 2) s.n = undefined;

  // the last chorus can go up a key (rock and pop do this)
  const canChange = genre === 'rock' || genre === 'pop' || genre === 'hardrock';
  const keyUp = opts.keyChange === 'off' || !canChange && opts.keyChange !== 'on' ? 0
    : opts.keyChange === 'on' || (keyRoll && (genre !== 'hardrock' || rng.chance(0.6))) ? (genre === 'pop' && rng.chance(0.5) ? 1 : 2) : 0;
  const finalAt = slots.findIndex((s) => s.final);
  // (Solo story, hand-over: the notes of the next section's first chord, as pitch classes in this solo's own key; the last chorus goes up a key)
  const handFor = (i: number): number[] | undefined => {
    const nx = slots[i + 1]?.segs[0]?.idea;
    if (opts.soloStory !== 'on' || opts.soloStoryHand !== 'on' || !nx) return undefined;
    const up = keyUp && finalAt >= 0 && i + 1 >= finalAt && i < finalAt ? keyUp : 0;
    return chordTones(nx.song.key, nx.chords.timeline[0].chord).map((t) => (t + up) % 12);
  };

  // instruments: one sound per part all song, sometimes one featured section (see orchestrate)
  const soundList = slots.map((s) => ({ kind: s.kind, energy: s.energy, final: s.final, intro: s.intro, hook: s.g2 === 'hook' }));
  const sounds = orchestrate(src.song.partGenres.strum, riff, soundList, {
      track: new Rng(`${S.structure}-sound`), verse: new Rng(`${S.verse}-sound`), pre: new Rng(`${S.pre}-sound`),
      bridge: new Rng(`${S.bridge}-sound`), hook: new Rng(`${S.hook}-sound`),
    }, opts.sounds);

  // the drummer's way with space, the same all track: quarter notes in the verses (some drummers)
  const space = new Rng(`${S.structure}-space`);
  space.chance(0.7); // (was: quarter notes in half-time sections too; kept so the verse pick stays the same)
  const verseQuarters = ['rock', 'pop', 'hardrock', 'altmetal'].includes(src.song.partGenres.drums) && space.chance(0.45);
  const sections = slots.map((s, si) => {
    const r = new Rng(`${S.structure}-${si}-${s.kind}`);
    const label = s.n ? `${KIND_LABEL[s.kind]} ${s.n}` : KIND_LABEL[s.kind];
    // a long solo: one stretch gets another band feel (docs/SOLO-VARY.md)
    const first = s.segs[0]?.idea;
    const soloBarsNow = s.segs.reduce((a, g) => a + g.n, 0);
    const vary = opts.soloVary === 'on' && s.kind === 'solo' && s.g2 === 'solo' && !s.intro && first
      ? planVary(`${S.structure}-${si}-solo-vary`, soloBarsNow, genre, arc.mood, !(first.song.forceHalf ?? first.drums.halfTime) && first.song.bars.every((b) => b.len === 16 && b.groups.length === 4), opts.soloBacking === 'held')
      : null;
    const idea = join(vary ? varySegs(s.segs, take(soloOverChorus ? verse : chorus, 8), vary) : s.segs, { kind: s.kind, label, energy: s.energy, sound: sounds[si] });
    if (vary) idea.section!.soloVary = vary;
    // (an outro that is a jam or a guitar solo is the guitar's: nobody sings)
    if (s.kind === 'outro' && (jam || s.g2 === 'solo')) idea.section!.lead = true;
    const notes: string[] = [];

    // Solo backing: held chords under a solo
    const held = opts.soloBacking === 'held' && s.g2 === 'solo' && !s.intro;
    if (held) notes.push(heldBacking(idea));

    // energy
    if (s.intro === 'alone') {
      pickup(idea, r);
      idea.bass.fill(0);
      if (idea.bassLen) idea.bassLen.fill(0);
      idea.section!.bandFrom = idea.song.total;
      notes.push(`${riff ? 'Riff' : 'Guitar'} alone, the drums come in with a fill`);
    } else {
      shapeDrums(idea, s.energy, r);
      if (!riff && !held) shapeBass(idea, s.energy);
      // room to breathe: half-time sections, and (for some drummers) every verse, on quarter notes
      const drumGenre = idea.song.partGenres.drums;
      const half = idea.song.forceHalf ?? idea.drums.halfTime;
      // (half-time sections keep their 8ths on the cymbal: with the snare halved as well, quarter notes
      // dropped the pulse two to four times over at once and the song seemed to fall over)
      if (drumGenre !== 'funk' && s.energy === 3 && s.kind === 'verse' && !half && verseQuarters) {
        if (quarterTime(idea)) notes.push('Drums: quarter notes on the cymbal, leaving the verse room');
      }
    }
    // (under a solo the rhythm guitar backs off a little)
    if (!riff && !held) shapeStrum(idea, s.g2 === 'solo' ? Math.min(3, s.energy) : s.energy);
    // (a long solo's stretch: the drums, and the chords held or the other section's)
    for (const v of vary ?? []) {
      const bars = idea.song.bars, at = bars[v.from].start, end = v.to >= bars.length ? idea.song.total : bars[v.to].start;
      const dn = varyDrums(idea, v, r);
      if (dn) notes.push(dn);
      if (v.chords === 'held') notes.push(`Solo bars ${v.from + 1}-${v.to}: ${heldBacking(idea, at, end)}`);
      else if (v.chords === 'other') notes.push(`Solo bars ${v.from + 1}-${v.to}: the ${soloOverChorus ? 'verse' : 'chorus'}'s chords and groove`);
    }

    // guitar 2
    const runs = runCount(idea);
    let g2 = 'Guitar 2: same as the idea';
    // (the lines after the first that a solo writer gives: one per gap between the cores, the story)
    let g2more: string[] = [];
    // A short melodic solo, quoting the hook, lower and sparer than a full one (a lead break, or a lead line in a bridge or breakdown)
    const writeBreakSolo = (tag: string) => {
      let sol = tuneFirst
        ? generateSoloTune(new Rng(`${soloSeed}-${tag}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, 0.3, { mood: arc.mood, tension: arc.sections[si].tension, drums: idea.drums }, { tries: opts.soloTuneTries, moody: opts.soloMood === 'on', scale: opts.soloMoodScale === 'on', story: storyFor(si), storyNotes: opts.soloStory === 'on' && opts.soloStoryNotes === 'on', hand: handFor(si), storyScore: opts.soloStory === 'on' && opts.soloStoryScore === 'on', tense: opts.soloStory === 'on' && opts.soloStoryTense === 'on' })
        : melody
        ? generateSoloMelody(new Rng(`${soloSeed}-${tag}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, hook.length ? hook : null, 0.3, { mood: arc.mood, tension: arc.sections[si].tension, drums: idea.drums, rhythmMotif: opts.soloMotif === 'on', ...(isCoreMode(opts.soloCores) ? { cores: opts.soloCores, ...(opts.soloClimax === 'on' ? { climax: 'played' as const } : {}) } : {}) }, melody.mode)
        : opts.soloPlan === 'on'
        ? generateSoloPlan(new Rng(`${soloSeed}-${tag}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, hook.length ? hook : null, 0.3, { mood: arc.mood, tension: arc.sections[si].tension, drums: idea.drums })
        : generateSolo2(new Rng(`${soloSeed}-${tag}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, hook.length ? hook : null, 0.3);
      if (tuneFirst && opts.soloExpress === 'on') sol = expressTune(sol, `${soloSeed}-${tag}-${si}`, idea, arc.mood, arc.sections[si].tension);
      else if (melody && (coreOn || tuneFirst ? melody.play && opts.soloPolish === 'on' : melody.play || opts.soloCheck === 'player')) sol = playSolo(sol, `${soloSeed}-${tag}-${si}`, idea, arc.mood, arc.sections[si].tension, melody.play);
      if (melody && melody.play && coreOn && opts.soloShape === 'on') sol = shapeStory(sol, arc.mood);
      if (opts.soloSounds === 'on') sol = withSounds(sol, `${soloSeed}-${tag}-${si}`, idea, lead.lick, 0.3, false, notes, si);
      idea.guitar2 = sol.hits;
      idea.soloCurve = sol.curve;
    };
    // the lead player's verse: mostly answering the singer, now and then another part for a change
    const answering = (k: number): Guitar2Style => (r.chance(lead.other) ? playingStyle(r, idea, k) : 'answerMore');
    // Room: a lead line over the band's intro, where the lead keeps out of the verses
    if (roomIntro && s.kind === 'intro' && s.intro === 'band') {
      const style: Guitar2Style = riff ? 'lead' : 'fills';
      g2 = writeGuitar2(idea, g2o, r, new Array<Guitar2Style>(runs).fill(style), lead.lick);
      notes.push('Guitar 2 plays a line over the intro');
    } else if (figureVerses && (s.kind === 'verse' || (s.g2 === 'pick' && r.chance(0.5))) && s.g2 !== 'keep') {
      // (a first verse that would have no Guitar 2 now and then lets the figure come in halfway)
      const late = s.g2 === 'drop' && runs > 1 && r.chance(0.5);
      g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => (late && k < runs / 2 ? 'rest' : 'figure')));
    } else if (s.g2 === 'drop') { idea.guitar2 = []; g2 = 'Guitar 2: sits out'; }
    else if (s.g2 === 'pick') {
      const w = writeGuitar2Styles(idea, g2o, r);
      g2 = w.note;
      // Lead in bridges and breakdowns (switch): a melodic line there is written like a short lead break
      if (opts.bridgeLead === 'on' && (s.kind === 'bridge' || s.kind === 'breakdown') && isLeadLine(w.styles)) {
        writeBreakSolo('bridge');
        idea.section!.lead = true;
        idea.section!.leadSolo = true;
        g2 = `Guitar 2: a lead line through the ${s.kind}, written like a short solo`;
      }
    } else if (s.g2 === 'build' && leadVerses) {
      g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => (k < runs / 2 ? 'answer' : answering(k))), lead.lick);
      notes.push('Plays twice through; Guitar 2 answers the singer more the second time');
    } else if (s.g2 === 'build') {
      g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => (k < runs / 2 ? 'rest' : playingStyle(r, idea, k))));
      notes.push('Plays twice through; Guitar 2 joins the second time');
    } else if (s.g2 === 'answer') g2 = writeGuitar2(idea, g2o, r, new Array<Guitar2Style>(runs).fill('answer'), lead.lick);
    else if (s.g2 === 'answerMore') g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => answering(k)), lead.lick);
    else if (s.g2 === 'climb') {
      // (a long pre-chorus answers first, then climbs in its last four bars)
      g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => (k === runs - 1 ? 'climb' : 'answer')), lead.lick);
    } else if (s.g2 === 'solo') {
      // (how far it goes: where it sits on the song's curve; the climax goes highest)
      const tt = vary ? varyTension(arc.sections[si].tension, vary) : arc.sections[si].tension;
      const intensity = si === arc.climax ? 1 : Math.max(0, Math.min(1, (tt.reduce((a, b) => a + b, 0) / tt.length - MP.base) / Math.max(0.1, MP.peak - MP.base)));
      const soloHook = s.kind === 'solo' && soloOverChorus && hook.length ? hook : null;
      let sol = tuneFirst
        ? generateSoloTune(new Rng(`${soloSeed}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, intensity, { mood: arc.mood, tension: tt, drums: idea.drums }, { tries: opts.soloTuneTries, moody: opts.soloMood === 'on', scale: opts.soloMoodScale === 'on', story: storyFor(si), storyNotes: opts.soloStory === 'on' && opts.soloStoryNotes === 'on', hand: handFor(si), storyScore: opts.soloStory === 'on' && opts.soloStoryScore === 'on', tense: opts.soloStory === 'on' && opts.soloStoryTense === 'on' })
        : melody
        ? generateSoloMelody(new Rng(`${soloSeed}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, soloHook, intensity, { mood: arc.mood, tension: tt, drums: idea.drums, rhythmMotif: opts.soloMotif === 'on', ...(isCoreMode(opts.soloCores) ? { cores: opts.soloCores, ...(opts.soloClimax === 'on' ? { climax: 'played' as const } : {}) } : {}) }, melody.mode)
        : opts.soloPlan === 'on'
        ? generateSoloPlan(new Rng(`${soloSeed}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, soloHook, intensity, { mood: arc.mood, tension: tt, drums: idea.drums })
        : generateSolo2(new Rng(`${soloSeed}-${si}`), idea.song, idea.chords, idea.guitar ?? null, lead.lick, soloHook, intensity);
      if (tuneFirst && opts.soloExpress === 'on') sol = expressTune(sol, `${soloSeed}-${si}`, idea, arc.mood, tt);
      else if (melody && (coreOn || tuneFirst ? melody.play && opts.soloPolish === 'on' : melody.play || opts.soloCheck === 'player')) sol = playSolo(sol, `${soloSeed}-${si}`, idea, arc.mood, tt, melody.play);
      if (melody && melody.play && coreOn && opts.soloShape === 'on') sol = shapeStory(sol, arc.mood);
      if (opts.soloSounds === 'on') sol = withSounds(sol, `${soloSeed}-${si}`, idea, lead.lick, intensity, true, notes, si);
      idea.guitar2 = sol.hits;
      idea.soloCurve = sol.curve;
      idea.section!.solo = true;
      g2 = sol.notes[0];
      if (melody && coreOn || tuneFirst && (opts.soloExpress === 'on' || opts.soloStory === 'on')) g2more = sol.notes.slice(1);
      if (s.kind === 'solo') notes.push(`Guitar solo, ${idea.song.bars.length} bars over the ${soloOverChorus ? 'chorus' : 'verse'} chords; the rhythm guitar backs off`);
      else notes.push('Guitar 2 solos over the outro');
    } else if (s.g2 === 'break') {
      // Breaks: a short melodic solo, quoting the hook, lower and sparer than a full one; the band as it is
      writeBreakSolo('break');
      idea.section!.lead = true;
      g2 = 'Guitar 2: a lead break, a short melodic solo over the chorus chords';
    } else if (s.g2 === 'play') g2 = writeGuitar2(idea, g2o, r, Array.from({ length: runs }, (_, k) => playingStyle(r, idea, k)));
    else if (s.g2 === 'swell') g2 = writeGuitar2(idea, g2o, r, new Array<Guitar2Style>(runs).fill('swell'));
    else if (s.g2 === 'hook') {
      placeHook(idea, s.intro === 'layered' ? 4 : s.intro === 'long' ? 12 : 0, s.kind === 'chorus' ? idea.song.bars.length : 4);
      g2 = hookNote;
    } else if (s.g2 === 'lead') {
      const rs = idea.song.sections?.[0];
      const twin = rs === 'single' || rs === 'gallop' || rs === 'pedal';
      const style = r.weighted<Guitar2Style>(idea.song.partGenres.strum === 'funk' ? [['funk', 2], ['lead', 1]]
        : rs === 'picked' ? [['rhythm', 2], ['octaves', 1]]
          : [['lead', 3], ['octaves', 2], ...(twin ? [['harmony', 3] as [Guitar2Style, number]] : [])]);
      g2 = writeGuitar2(idea, g2o, r, new Array<Guitar2Style>(runs).fill(style));
    } else if (s.g2 === 'keep' && !idea.guitar2.length) g2 = 'Guitar 2: sits out';
    // Breaks: no lead guitar in this song (its solo, if it has one, and swells stay)
    if (noLead && s.g2 !== 'solo' && s.g2 !== 'swell' && idea.guitar2.length) { idea.guitar2 = []; g2 = 'Guitar 2: sits out (no lead guitar in this song)'; }
    // Twin: a second lead guitar on the hook and a lead line (never the solo: one line, docs/SOLO-PLAN.md round 3)
    if (twinKind && idea.guitar2.length && (s.g2 === 'hook' || s.g2 === 'lead')) {
      addTwin(idea, twinKind, 0);
      notes.push(`A second lead guitar ${twinKind === 'harmony' ? 'harmonises a 3rd up' : twinKind === 'octave' ? 'plays it in octaves' : 'doubles it'}`);
    }
    if (s.kind === 'interlude' && leadBreak) notes.push('A lead break: eight bars of lead guitar over the chorus chords, no singing');
    else if (s.kind === 'interlude') notes.push(riff ? 'The hook riff comes back with the full band' : 'The hook comes back over the chorus chords');
    if (s.kind === 'verse' && riffVerse) notes.push('The idea\'s riff carries on under the verse');
    if (s.kind === 'chorus' && newChorus) notes.push('A new chorus: its own chords and big chords, so the riff stands out in the verses');

    if (s.intro === 'layered') notes.push(layerIntro(idea, r));
    if (s.intro === 'long') notes.push(longIntro(idea, r));
    if (s.kind === 'outro' && outroLong) notes.push('Long outro: the last line repeats as a tag before the end');
    if (s.kind === 'outro' && jam) {
      // (named in the key it ends up in: a last-chorus key change carries on into it)
      notes.push(jam.note((idea.song.key + (keyUp && finalAt >= 0 && si >= finalAt ? keyUp : 0)) % 12));
      jamBuild(idea, s.segs[0].n, r);
    }
    // the climax: Guitar 2's line an octave up (moods that peak high), so the song's top is also its highest
    if (si === arc.climax && MP.peak >= 0.8 && s.g2 !== 'solo' && idea.guitar2.length
      && idea.guitar2.every((h) => h.notes.length === 1 && !h.mute) && Math.max(...idea.guitar2.map((h) => h.notes[0])) + 12 <= 86) {
      const t = idea.song.tuning ?? TUNINGS.standard;
      idea.guitar2 = idea.guitar2.map((h) => ({ ...h, ...leadFret(h.notes[0] + 12, t, 12) }));
      notes.push('Guitar 2 an octave up for the climax');
    }
    if (keyUp && finalAt >= 0 && si >= finalAt) {
      transpose(idea, keyUp);
      if (si === finalAt) notes.push(`Key change: up a ${keyUp === 1 ? 'half' : 'whole'} step for the last chorus`);
    }

    const rhythm = idea.song.sections
      ? [...new Set(idea.song.sections)].map((x) => RIFF_STYLE_LABEL[x]).join(', then ')
      : STRUM_DESC(s.energy, idea.song.partGenres.strum);
    const ten = arc.sections[si];
    idea.section!.tension = ten.tension;
    idea.section!.db = ten.db;
    const pc = (x: number) => Math.round(x * 100);
    const t0 = ten.tension[0], t1 = ten.tension[ten.tension.length - 1];
    notes.unshift(`${label} · energy ${s.energy} of 5 · tension ${pc(t0)}%${Math.abs(t1 - t0) >= 0.04 ? ` → ${pc(t1)}%` : ''} (${ten.role}) · ${idea.song.bars.length} bars · ${rhythm}`, `Chords: ${describeChords(idea)}`);
    notes.push(g2, ...g2more);
    if (idea.drums.groove && s.intro !== 'alone' && s.energy >= 2) notes.push(`Drums: ${idea.drums.groove}`);
    if (!riff && idea.bassLine && s.intro !== 'alone') {
      notes.push(`Bass: ${s.energy <= 2 ? 'long held roots' : s.energy >= 5 && idea.bassLine !== 'flowing' && idea.song.partGenres.bass !== 'funk' ? 'driving 8th notes, held into each other' : BASS_LINE_DESC[idea.bassLine]}`);
    }
    if (s.energy >= 5) notes.push('Drums: crashes every 2 bars');
    if (s.energy === 2 && s.intro !== 'alone') notes.push('Drums: lighter, closed hi-hat');
    if (s.energy === 3 && s.intro !== 'alone') notes.push('Drums: closed hi-hat');
    if (idea.song.forceHalf) notes.push('Drums: half-time');
    idea.notes = notes;
    return idea;
  });

  // a crash into each section (quiet openings don't crash)
  sections.forEach((idea, i) => {
    const e = idea.section!.energy;
    if (i === 0 && e <= 2) idea.drums.crash[0] = 0;
    if (i > 0 && e >= 2) crashAt(idea.drums, 0);
  });
  // building into an arrival (a chorus, or the climax): the bass holds the 5th underneath, and (in the
  // rhythm player's pass, below) the last chord is suspended, resolving as the new section lands
  const builds = sections.map((idea, i) => {
    const nx = sections[i + 1];
    if (!nx || slots[i].intro || idea.section!.solo) return false;
    const t = arc.sections[i].tension;
    return (t[t.length - 1] > t[0] + 0.05 || idea.section!.kind === 'prechorus') && (nx.section!.kind === 'chorus' || i + 1 === arc.climax);
  });
  sections.forEach((idea, i) => {
    if (builds[i] && !riff && new Rng(`${S.structure}-pedal${i}`).chance(MP.pedal) && pedalBass(idea, MP.build >= 0.18 ? 2 : 1)) {
      idea.notes.push('Bass: holds the 5th underneath in 8ths, building into what comes next');
    }
  });
  // transitions: into a chorus a fill, a snare build, band hits, a stop or a push; into a section as loud
  // a fill or a push; into a quieter one a fill, a chord left ringing or a breath. Then the parts lead
  // across the bar line: a turnaround chord, the bass walking in, Guitar 2's pickup notes.
  sections.forEach((idea, i) => {
    const b = sections[i + 1];
    if (!b) return;
    const r = new Rng(`${S.structure}-t${i}`);
    const m = new Rng(`${S.structure}-seam${i}`);
    const e = idea.section!.energy;
    const kind = idea.section!.kind;
    const next = b.section!;
    const into = next.kind === 'chorus' ? 'the chorus' : 'the next section';
    const turn = turnaround(idea, b, m, b.song.key !== idea.song.key, !!kept[kind]);
    if (turn) idea.notes.push(turn);
    type Seam = 'none' | 'fill' | 'build' | 'hits' | 'stop' | 'push' | 'ring';
    let t: Seam = 'none';
    // a big lift (quiet into loud) needs setting up: the band builds or fills into it, a stop only
    // works when there's something loud to stop, and a cymbal swells up into the new section
    const lift = next.energy - e >= 2;
    // intros that start with the guitar alone bring the drums in themselves (layered intros have
    // the band by their last bars, so they hand over like any other section)
    if (slots[i].intro !== 'alone') {
      if (next.kind === 'chorus' && kind !== 'chorus') {
                // (into the climax a stop or the band hitting together is likelier: a breath, then the arrival)
        const big = i + 1 === arc.climax ? 1 + MP.stop * 0.6 : 1;
        t = r.weighted<Seam>([['fill', 3], ['build', kind === 'prechorus' || lift ? 4 : 2], ['hits', 2 * big], ['stop', e >= 3 ? 2 * MP.stop * big : 0], ['push', lift ? 1 : 2]]);
      } else if (lift) t = r.weighted<Seam>([['fill', 3], ['build', 2], ['push', 1]]);
      else if (next.energy >= e) t = r.weighted<Seam>([['fill', 3], ['push', 1]]);
      else t = r.weighted<Seam>([['fill', 3], ['ring', 2 / MP.stop], ['stop', MP.stop]]);
    }
    if (t === 'push' && !push(idea, b)) t = 'fill';
    if (t === 'build') { snareBuild(idea); idea.notes.push('Snare build into the chorus'); }
    else if (t === 'hits') { bandHits(idea, r); idea.notes.push('The band hits accents together into the chorus'); }
    else if (t === 'stop') { bandStop(idea, r.pick([1, 2])); idea.notes.push(next.energy < e ? 'Band stops for a breath before the next section' : 'Band stops right before the chorus'); }
    // (the drummer fills under a push: a push alone, with the drums just carrying on, came out of nowhere)
    else if (t === 'push') { ensureFill(idea, r); idea.notes.push(`The band pushes into ${into}: its first chord comes an 8th early, over a drum fill`); }
    else if (t === 'ring') { ringOut(idea); idea.notes.push('The last chord is left ringing into the next section'); }
    else if (t === 'fill') { ensureFill(idea, r); idea.notes.push(`Drum fill into ${into}`); }
    if (lift) { idea.section!.riser = true; idea.notes.push(`A cymbal swells up into ${into}`); }
    if ((t === 'fill' || t === 'none') && idea.section!.energy >= 2 && m.chance(lift ? 0.8 : 0.55) && walkUp(idea, b, m)) idea.notes.push(`Bass walks into ${into}`);
    if (t !== 'hits' && t !== 'push' && m.chance(0.6) && g2Pickup(idea, b, m)) idea.notes.push(`Guitar 2 leads into ${into} with pickup notes`);
  });
  // into a half-time section from a full-time one: the band lands and lets the first chord ring for a
  // bar, and the drummer picks up into the new feel
  sections.forEach((idea, i) => {
    const prev = sections[i - 1];
    const half = (x: Idea) => !!(x.song.forceHalf ?? x.drums.halfTime);
    if (!prev || !half(idea) || half(prev) || idea.song.bars.length < 4) return;
    settleIn(idea);
    // pushed in: what was pushed rings on through the bar
    const tail = prev.section!.tail;
    const at = tail && 'push' in tail ? tail.push : undefined;
    if (idea.section!.pushedIn && at !== undefined) {
      const over = prev.song.total - at + idea.song.bars[0].len;
      const hit = prev.guitar?.find((h) => h.step === at);
      if (hit) hit.len = over;
      if (prev.bassLen && prev.bass[at]) prev.bassLen[at] = over;
    }
    idea.notes.push('The band lands on the first chord and lets it ring for a bar, then the drummer picks up into the half-time feel');
  });
  // a planned solo's last note carries on into the next section, bending to its first chord
  sections.forEach((idea, i) => carrySolo(idea, sections[i + 1], opts.soloBends === 'dials' && opts.soloExpress === 'on'));
  // a long outro's tag repeats the chorus's last bars: its bars don't line up with the chorus's
  if (outroLong || jam) delete edit.outro;
  // (a jam ends in its own key)
  makeEnding(sections[sections.length - 1], jam && slots[slots.length - 1].kind === 'outro' ? jam.home : home);
  sections[sections.length - 1].notes.push('Ends on a held chord');
  // the rhythm guitarist (strummed genres, picked with the band) plays each section their way
  const rhythmPlayer = riff ? null : pickRhythm(bandSeed, src.song.partGenres.strum);
  const riffPlayer = riff ? pickRiffPlayer(bandSeed, src.song.genre) : null;
  // (a capo is for the whole song: decided on all its chords)
  const allChords = sections.flatMap((x) => x.chords.timeline.map((e) => e.chord));
  sections.forEach((idea, i) => {
    // reshaping and transitions can leave downstrokes between 8ths: strum them as a hand would
    naturalStrokes(idea.song, idea.strum);
    const info = idea.section!, g2 = slots[i].g2;
    const ctx = {
      kind: info.kind, energy: info.energy, solo: !!info.solo, tail: !!info.tail, allChords,
      suspend: builds[i] && new Rng(`${S.structure}-sus${i}`).chance(MP.sus),
      answering: g2 === 'answer' || g2 === 'answerMore' || g2 === 'climb' || (g2 === 'build' && leadVerses),
    };
    const rng = new Rng(`${idea.seeds.strum}-rhythm-${i}`);
    if (rhythmPlayer) idea.notes.push(...playRhythm(idea, rhythmPlayer, bandSeed, rng, ctx));
    if (riffPlayer) idea.notes.push(...playRiffPart(idea, riffPlayer, bandSeed, rng, ctx));
    const { chords, guitar2 } = idea.section!.sound!;
    idea.notes.splice(2, 0, `Sound: ${SOUND_NAME[chords]}${idea.guitar2.length ? `, Guitar 2 on ${SOUND_NAME[guitar2]}` : ''}`);
  });
  // when the guitar plays (docs/STUDY-RHYTHM.md): a role for the song, and each section they sit out, come in or drop out
  // (on unless a track says off: docs/STUDY-RHYTHM.md)
  if (opts.guitarPlan !== 'off') {
    const gp = planGuitar(bandSeed, src.song.partGenres.strum, riff, sections.map((x) => ({ kind: x.section!.kind, energy: x.section!.energy, bars: x.song.bars.length, hasG2: x.guitar2.length > 0 })));
    sections.forEach((x, i) => { const n = applyGuitarShape(x, gp.shapes[i], gp.cover); if (n) x.notes.push(n); });
    sections[0].notes.push(`Guitar plan: the rhythm guitarist ${GUITAR_ROLE_DESC[gp.role]}`);
  }
  sections[0].notes.push(`Band feel: ${describeSounds(soundList, sounds)}`);
  sections[0].notes.splice(2, 0, arcNote(arc, moodAuto, sections.map((x) => x.section!.label)));

  // the band plays it: each player reads the whole track and plays the written part their way
  if (opts.band !== 'off') {
    playBand(sections, bandSeed);
  }

  // the singer: a tune per kind of section, words that sound like English, the hook in every chorus
  const vocalSeed = src.seeds.vocal ?? `${src.seeds.chords}-vocal`;
  singTrack(sections, { seed: vocalSeed, mood, genre: src.song.partGenres.strum, lift: src.opts.vocalLift ?? 0, grid: src.opts.vocalRhythm === 'grid', words: src.opts.vocalRhythm === 'words', shaped: !!src.opts.vocalMelody, first: src.opts.vocalMelody === 'first', learned: src.opts.vocalMelody === 'learned', move: src.opts.vocalMove as MoveId | undefined, high: src.opts.vocalSinger, energy: src.opts.vocalEnergy as EnergyStyle | 'off' | undefined, real: src.opts.vocalReal, patterns: src.opts.vocalPatterns }, arc.climax);
  // the verse melody writer's lead vocal (the default): its notes, words and lines replace the classic tune
  const verseVocal = src.opts.vocalWriter !== 'classic';
  if (verseVocal) singSong(sections, vocalSeed, src.opts.vocalLift ?? 0, { mood, on: emoOn(src.opts.vocalMoodOff), maxSets: setsOf(src.opts.vocalMaxSets), tune: src.opts.vocalTune, skeleton: src.opts.vocalSkeleton, cells: src.opts.vocalCells, climax: sections[arc.climax] }, bassShareOf(src.opts.vocalWriter, src.opts.vocalBassShare));
  // Room (switch): the lead out from under the singer's lines, by genre
  if (src.opts.leadRoom) makeRoom(sections, src.song.partGenres.strum, `${S.band ?? `${src.seeds.song}-band`}-room`);
  const voice = autoVoice(vocalSeed, src.song.partGenres.strum);
  const high = pickHigh(vocalSeed, src.song.partGenres.strum);
  for (const x of sections) { x.vocalVoice = voice; x.vocalHigh = high; }
  // backing vocals: doubled choruses, harmonies (or oohs) by the mood, ad-libs over the climax
  const energy = sections.find((x) => x.vocalEnergy)?.vocalEnergy;
  const backing = pickBacking(vocalSeed, mood, src.song.partGenres.strum, energy);
  arrangeBacking(sections, { seed: vocalSeed, backing, mood, energy }, arc.climax);

  // the wah pedal (switch): which sections play through it
  // ('on' is the normal strength; any other value from an old link is off)
  const wahAmount = ({ on: 'normal', subtle: 'subtle', strong: 'strong' } as const)[opts.wah as 'on'];
  if (wahAmount) {
    const plan = planWah(`${src.seeds.song}-band`, src.song.partGenres.strum, sections.map((x) => x.section!), wahAmount);
    sections.forEach((x, i) => { if (plan[i]) x.section!.wah = plan[i]; });
  }

  // each section knows the shape of its track (added layers plan where they play from it)
  const all = sections.map((s) => ({ kind: s.section!.kind, energy: s.section!.energy }));
  sections.forEach((s, index) => { s.section!.pos = { index, all }; });

  const bars = sections.reduce((a, s) => a + s.song.bars.length, 0);
  const steps = sections.reduce((a, s) => a + s.song.total, 0);
  // the lead vocal as it's sung, worked out over the whole song
  if (!verseVocal) singLead(sections, mood);
  return { source: src, opts: given.moodAll === 'on' ? given : opts, order: slots.map((s) => s.kind), sections, bars, steps, edit, riffVerse, newChorus, mood, climax: arc.climax };
}

/** Which of the track's seeds a section's reroll changes (null: the section is the idea itself). */
export function rerollSeedFor(kind: SectionKind, riffGenre: boolean, t?: Pick<Track, 'riffVerse' | 'newChorus'>): keyof TrackOptions['seeds'] | null {
  if (kind === 'verse') return t?.riffVerse ? null : 'verse';
  if (kind === 'chorus' && t?.newChorus) return 'chorus';
  if (kind === 'prechorus') return 'pre';
  if (kind === 'bridge' || kind === 'breakdown') return 'bridge';
  if (kind === 'chorus') return null;
  if (kind === 'solo') return 'solo';
  // intro, interlude, outro: the hook (strummed genres) or the arrangement around the riff
  return riffGenre ? 'structure' : 'hook';
}
