# Mood: all the way

One switch for the whole mood work. Track options → **Mood: all the way** (off by default). Check: `npm run mood-all-check`.

## What it turns on
- **Solo writer: Tune first** (`SOLO-TUNE.md`)
- **Solo mood** (`SOLO-MOOD.md`): each mood's jumps, pace, height and colour notes in the solo.
- **Mood scale** (`SOLO-MOOD.md`): over power chords the mood picks the 3rd and 6th.
- **Mood song** (`MOOD-SONG.md`): the mood chooses the mode, tempo and drum feel.
- **Mood riff** (`MOOD-RIFF.md`): the mood picks the riff styles.

## How it behaves
- On, it sets those five itself, whatever they were set to. The five menus grey out ("Set by Mood: all the way").
- Off, the five menus work on their own again, as they were.
- **Auto mood**: the four mood switches need a chosen mood. With this switch on and Mood on Auto, the song uses the mood Auto picks for the song as the genre wrote it, and the song is then written for that mood. (The Mood menu still says Auto, with the mood in brackets.)
- Not on: Solo polish, Solo shape and the sounds. They stay as you set them.
- Old links, a missing or a wrong value: off.

## How
- `moodAllOpts` in `track.ts` swaps the five options in at the top of `buildTrack`; the track keeps the options it was given, so the page still shows your own choices.
- Nothing else is new: the same code paths as the five switches.

## Checks (`mood-all-check`)
- On is the same track as the five switches set by hand, in every genre and mood (4/4, 3/4, 6/8).
- The five switches set to off do not change what on does.
- Auto uses the mood `autoMood` picks, and gives the track of that mood.
- Off, missing or a wrong value is the track as it was; the same seeds give the same track.

## Not done
- Whether the whole thing sounds right is for Paul's ears.
