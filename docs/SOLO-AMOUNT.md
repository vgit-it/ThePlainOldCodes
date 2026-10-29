Status: built (2026-10-28), behind a switch. Paul has not heard it.

# Solo amount: how much the expression changes the tune

Paul: Solo expression changes the melody a bit too much. Option 1 of his pick: a dial.

Switch: Track options → **Solo amount** → Light / Normal / Full (`soloAmount`). Needs Tune first and Solo expression: On. Normal is the default and plays exactly as before; an old link is Normal. Check: `npm run solo-amount-check`. Code: `AMOUNTS` and `amt` in `src/parts/soloexpress.ts`.

## What each setting does
- **Normal**: as before (about half of the tune's notes untouched).
- **Light**:
  - a window is left plain far more often (the "plain" weight is about 8 times higher);
  - a window reaches over fewer neighbouring notes (reach is 35%);
  - the picker asks for 85% of the tune to survive (was 60%) and no longer pushes for change;
  - Solo echo's signature figure only lands on windows already played another way, never over a plain one.
- **Full**: the opposite, softer: plain weight about 2 times lower, reach 150%, floor of 50% kept.

## Numbers (60 songs, 74 solos)
- Tune notes left exactly as written: Light 79%, Normal 51%, Full 42%.
- Goal notes kept in every setting; playable with echo, recast and dials on too.
- The card says "Solo expression (restless, light): …".

## Notes
- Held-note dress (vibrato, bends on long notes) still comes with the plain windows; Light changes what is played, not how long notes are shaded.
- The last note of a solo may be bent to the next section's chord by the hand-over (`carrySolo`), at any amount.
