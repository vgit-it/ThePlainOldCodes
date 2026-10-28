# Mood riff

The mood picks the riff styles, and a major key's riff takes the major 3rd. For the riff genres (hard rock, heavy metal, grunge, alt metal). Switch: Track options → **Mood riff** (off by default; needs a Mood, not Auto). Check: `npm run mood-riff-check`.

## Why
- Mood song (`MOOD-SONG.md`) and Solo mood changed the mode, tempo and the solo. The riff stayed the genre's.
- Metal's riffs are almost all gallops (heroic), whatever the mood. Hard rock's are picked hooks and licks (bright).
- A sad mood still had a bold riff under it.

## What it does
- **Styles**: each mood has a liking for each riff style (`RIFF_LIKES` in `src/moodsong.ts`), times the genre's own weight.
  - melancholic: arpeggios, single notes, pedal notes; few gallops, few picked hooks and licks.
  - dark: pedal notes, single notes, chugs.
  - dreamy: arpeggios, single notes, big chords.
  - nostalgic: picked hooks, arpeggios.
  - tense: pedal notes, chugs.
  - angry: chugs, gallops, big chords.
  - happy: picked hooks, licks, big chords.
  - triumphant: gallops, big chords, picked hooks.
- **Where**: the 8-bar riff arrangement (`planSong`), and the verse and bridge riffs (`track.ts`).
- **Notes**: in a major, mixolydian or lydian key, the single-note and lick riffs take the major 3rd (`riffPent`) instead of the minor pentatonic. Minor modes are as they were.
- Needs the mood chosen. Old links, a wrong value or Auto: off.

## Numbers (`mood-riff-check`, 60 songs a genre)
- Share of the arrangement that is gallops, big chords, picked hooks or licks, sad moods / bold moods (off in brackets):
  - metal 0.33 / 0.74 (0.68)
  - grunge 0.27 / 0.46 (0.36)
  - alt metal 0.32 / 0.44 (0.31)
  - hard rock 0.84 / 0.94 (0.93): it has few soft styles to start with.
- Single notes, arpeggios and pedal notes, sad / bold: metal 0.66 / 0.22, grunge 0.68 / 0.39, hard rock 0.16 / 0.06.
- Whole tracks (hard rock and metal): gallop sections 142 in sad moods, 321 in bold ones.
- Hard rock in a major key: minor 3rd notes 636 → 358, major 3rd notes 150 → 575.
- Switch off is the song as it was. 0 FAIL.

## Not done
- A chord on the flat 3rd (bIII) still has it as its root; only the riff's own notes follow the mode.
- The rhythm player's and the bass's hands are as they were.
- Whether sad riffs now sound sad is for Paul's ears.
