# Solo climax, played

Option **"Solo climax played (core notes)"** (`soloClimax: 'on'`, Track options). Off by default; a link from before plays as before. Works with "cores only" and "with moves between". Code: `playClimax` in `src/parts/solomoves.ts`, called from `generateSoloMelody`. Check: `npm run solo-moves-check` (the "climax played" part).

## Why
- The climax core was one plain held note: no bend, no vibrato. Moves never play over a core, and the techniques belong to step 3 (the player, not built).
- Paul asked why the climax could not be held with a lick (pedal notes, bends).

## What it does
- Only the climax core changes. Its first note is still the core's (same step, same note). It stays under the top note and ends held on it.
- Three ways, picked by the genre's liking (same weights as `bend-release` and `pedal`):
  - **Bend and vibrato:** bent up into the top note, held with wide vibrato.
  - **Bent again:** 2 to 4 bends of the top note, each let down, the last one held with vibrato. Needs a core of 8 16ths or more.
  - **Pedal lick:** 16ths between the top note and a note 1 to 3 scale steps under, then the top note held for the last third (4 16ths at least). Needs 8 16ths or more.
- A core shorter than 8 16ths is bent and held.
- The moves and the other cores are the same with it on or off (the climax uses its own dice, drawn after the moves).
- The card says it in a line: `climax (bar 5): quick notes that keep coming back to the top note, which ends held`.

## Also changed (step 2 moves)
- Held moves (bend and release, slide in, trill) are back to 4, 6 or 8 16ths (they were cut to 2-4 when the licks went to 16ths, which made a bend a blip). The fast shapes stay 16ths.

## Not done
- Other cores (not the climax) are still plain. Vibrato, bends and harmonics on them are step 3 (the player).
- Tune by ear: how often each way shows up, the vibrato width, the pedal pattern.
