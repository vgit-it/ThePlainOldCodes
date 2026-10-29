# Solo mood (and Mood scale)

For the "Tune first" solo writer (`SOLO-TUNE.md`). Two switches in Track options, both off by default:
- **Solo mood**: each mood gets its own character in the melody.
- **Mood scale**: over power chords, the mood picks the 3rd and 6th.

Checks: `npm run solo-mood-check`, `npm run solo-scale-check`.

## Why
- Tune first sounded like a tune, but the same tune in every mood.
- The only mood in it was the vocal's interval table (how much a mood likes each step and leap).

## Solo mood: what it does
One table per mood (`src/parts/solomood.ts`, `SOLO_MOOD`), read by `solotunefirst.ts`:
- **Jumps**: how often a cell starts or ends on a leap, and how often the leap goes up.
- **Pace**: quick or slow notes, and a change inside a cell or between cells (quick then slow, slow then quick).
- **Height**: the whole solo sits higher or lower.
- **Holds**: how long the note that ends a phrase is held.
- **Repeats**: how willing the line is to repeat a note; how often an answer replays its call.
- **Colour notes**: the 9th, 6th, flat 2nd and so on, liked on held or weak notes; an open ending may land on one.
- **Rough**: how much the line may rub the chord.
- **Contour**: the shapes (rise, fall, arch, dip, level) a call or an answer takes.
- A note off the key that is not the chord's is moved to the nearest note that is. Strong places stay chord notes. A passing note moves on by a step.

The tune score gets mood parts (`solotune.ts`, `TuneAim`): jumps, pace, and how the intervals fit the mood's table. Bands per mood are in `AIMS`.

## Moods in a line
- happy: bright, some jumps up, 6th and 9th.
- melancholic: slow, low, steps, flat 7th and 9th, falls.
- nostalgic: slow-ish, arches, 6th.
- tense: quick, many jumps, repeated notes, rough.
- angry: quickest, jumps, repeats, rough.
- dreamy: slow, held, 9th and major 7th.
- triumphant: highest, jumps up, rising calls.
- dark: lowest, falls, flat 2nd, rough.

## Mood scale
### Why
- The mood only changed the melody; the band, key and mode stayed the genre's.
- Hard rock is mostly major or mixolydian. Heavy metal is always minor, but 92% of its chords are power chords, at about 146 bpm. Grunge is always minor, slow, and dark by default.
- Result: a "melancholic" solo in hard rock still played a major scale; in metal it still sounded heroic.

### What it does
- Over a song whose chords are at least half power chords (no third), the solo's scale is turned by the mood (`SCALE_LEAN`, `moodScale`):
  - happy, triumphant: major 3rd and 6th (a flat 2nd becomes natural).
  - melancholic, dark, tense, angry: minor 3rd and 6th (and the flat 7th).
  - nostalgic, dreamy: the song's own scale.
- A note is turned only when its twin is not already in the scale.
- A song of full chords keeps its own scale. Its chord's third decides there, and a clash with it would be worse.
- Needs Tune first and Solo mood on. Off: Solo mood as it was.

### Numbers (`solo-scale-check`)
Share of the non-chord 3rd and 6th notes that are minor, over power chords:

| genre | bright, off | bright, on | dark, off | dark, on |
|---|---|---|---|---|
| metal | 0.91 | 0.02 | 0.94 | 1.00 |
| grunge | 0.97 | 0.04 | 0.96 | 1.00 |
| altmetal | 1.00 | 0.00 | 1.00 | 1.00 |
| rock (two thirds power chords) | 0.22 | 0.01 | 0.24 | 0.99 |

- Dark minus bright: 0.01 off, 0.98 on.
- No note outside the mood's scale and the chord's notes.
- Hard rock: only about 8% to 36% of its solos are on power chords, so it changes little. Its fix is the song's mode (next).

## Not done
- Hard rock's major key and tempo by mood: done in `MOOD-SONG.md` (switch: Mood song).
- Solo shape (loudness) for Tune first.
- 6/8 and 7/8: the mood score's pass rate is lower there (small samples).
- The numbers are my own measures; Paul's ears decide.
