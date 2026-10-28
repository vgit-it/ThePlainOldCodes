# Mood song

The mood chooses the song's mode, tempo and drum feel. Before, the mood only shaped how the song builds and (with Solo mood) the solo's notes. Switch: Track options → **Mood song** (off by default). Check: `npm run mood-song-check`.

## Why
- Hard rock and metal sounded happy or triumphant in every mood, grunge was dark in every mood (`SOLO-MOOD.md`).
- The genre alone set the key's mode and the tempo, and the mood could not move them.
- Solo mood and Mood scale change the solo's notes. The band under it stayed the same.

## What it does
- **Mode**: from the genre's own modes, the one nearest what the mood wants.
  - happy, triumphant: the brightest the genre has (major, else mixolydian, else dorian).
  - melancholic, angry: minor.
  - dark, tense: phrygian or minor.
  - nostalgic, dreamy: in the middle.
  - A genre never leaves its own modes: metal has no major, so happy gets dorian.
  - Chords follow: hard rock's tonic is a major chord in major, a minor chord in minor.
- **Tempo**: times the genre's own.
  - dreamy 0.80, melancholic 0.82, dark 0.88, nostalgic 0.90, tense 1.00, happy 1.04, triumphant 1.05, angry 1.08.
- **Drum feel**: melancholic, dark and dreamy play half-time when the tempo is still 100 or more (fast songs like metal), so the feel slows it, not only the number.
- A tempo or a mode set by hand wins.
- Needs a mood chosen, not Auto (Auto picks its mood from the song's own mode and tempo).
- Three choices: mode, tempo and feel, or each alone.

## How
- `src/moodsong.ts`: the tables, pure.
- `planSong` (`generator.ts`) reads `GenOptions.moodSong`. It draws the same random numbers either way, so the key, bars and everything else stay as they were.
- `buildTrack` writes the song again from the same seeds when the switch is on, and back when it is off. The page's own idea is not changed.
- Old links: no value or a wrong value is off.

## Numbers (`mood-song-check`, 30 songs a genre)
- Mode brightness (1 dark, 6 bright), bright moods over melancholic, dark and tense: 2.1 higher on average.
  - rock: happy 5.0, melancholic 2.0, dark 2.0.
  - hard rock: happy 5.0, melancholic 2.0.
  - metal: happy 3.0 (dorian), melancholic 2.0, tense 1.0.
- Tempo: the factors above, in every genre.
- Half-time: metal melancholic 73%, dark 97%; rock and hard rock about half.
- A tempo or mode set by hand wins in every case. Switch off is the song as it was. 0 FAIL.

## Not done
- The riff keeps its own notes (it picks them by key position, not the mode), so a metal riff can still play the flat 3rd in a "happy" song.
- Mood scale (SOLO-MOOD.md) only changes the solo; with Mood song on it often has nothing left to turn.
- Auto mood still comes from the song's mode and tempo.
- Whether the moods now sound right is for Paul's ears.
