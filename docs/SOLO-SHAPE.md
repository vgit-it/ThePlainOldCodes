# Solo shape: the story's dynamics (step 2f)

Switch: Track options → **Solo shape (core notes)** → On. Works on any "Chosen bars" choice of Solo core notes; made for "story told in licks + the lick library", with or without Solo polish. Off: the story as written, note for note.

## What it does (`src/parts/solodynamics.ts`)
Changes loudness, a little timing and vibrato only. Never a pitch, a step or a length.
- **Loudness follows the arc**, part by part (from the melody view's parts):
  - statement a little under the level, answer and return near it, links soft.
  - build and ramp swell from the start to the end of the part.
  - the climax core is the loudest.
  - a release dies away to the end; the last note is softest.
- **A laid-back start**: in dreamy, melancholic, nostalgic and dark moods, the first note of a phrase (statement, answer, return; never a core) comes in a third of a step late. The other moods stay on the beat.
- **An answer that repeats the opening** is softer at its start and rises, and its last held note sings with vibrato where the opening's tag did not.
- **The last note rings**: vibrato on the final note when it is held (two beats or more).

## Numbers (139 solos)
- Builds louder at the end in 89% of parts, ramps 99%, releases softer at the end 81%.
- Laid-back starts in the four soft moods only. Held last notes all ring.

## Not yet
- A push (a hair early) on driving moods: hits can only be late today.
- Not heard yet.

## Check
`npm run solo-shape-check`.
