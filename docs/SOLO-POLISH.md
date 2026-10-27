# Solo polish: the player dresses the story (step 2e)

Switch: Track options → **Solo polish (core notes)** → On. Works with any "Chosen bars" choice of Solo core notes; made for "story told in licks + the lick library". Off: the story as written, note for note.

## What it does
- After the story is written, the same player pass as Melody + player (`performSolo`, `docs/SOLO-PLAYER.md`) runs over the notes. The player's own five lead players (taste, pet moves) stay.
- The cores are kept (same step, same pitch), and the solo ends on the same note at the same time. The player only dresses what lies between.
- Dressed lightly (`PlayerCtx.light`), because the recipes are already full of notes:
  - A held note gets vibrato, a scoop, a bend in or a late bend as before.
  - A figure (a short lick that comes back to the held note, or a bridge to the next) only on a hold of two beats or more, and then half the time.
  - A short note gets a touch (grace, mordent, quick bend, slide, push, drag) half as often as in Melody + player.
  - A pickup in a small rest (up to a beat, as the strung rests are) a little over a third as often.
- On: the breath switch (a note after a busy stretch stays plain) and the 8th grid (figures start and land on the 8th) are on too.
- The roll shows each choice in the tap detail (as for Melody + player).

## Numbers (139 solos)
- About 19% more hits than without it; about 1 in 6 notes dressed.
- No core lost, no rest over a beat (a late hit may add a third of a step).

## Not yet
- Step B, the story's dynamics, is built: `docs/SOLO-SHAPE.md` (switch: Solo shape).
- Not heard yet.

## Check
`npm run solo-polish-check`.
