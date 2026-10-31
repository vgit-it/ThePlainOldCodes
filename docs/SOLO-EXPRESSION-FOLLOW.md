Status: built (2026-10-31), behind a switch. Paul has not heard it.

# Expression follows story: the expression pass plays the story's energy

Why: with Solo story on, the story plans the energy (quiet bars, crests, a trough). Solo expression read that energy only weakly, so it played about as many quick notes in the quiet bars as in the loud ones (41% vs 40%; 7.2 notes a bar in the quiet quarter against 6.3 in the loud one), and the held notes at the crests were dressed less than the quiet ones (33% vs 54%).

Switch: Track options → **Expression follows story** → On (`soloStoryFollow: 'on'`). Needs Solo story and Solo expression on. Off by default; an old link plays as before. Check: `npm run solo-follow-check`. Code: `follow` in `src/parts/soloexpress.ts` (`FOLLOW_PULL`, `FOLLOW_SCORE`).

## What it changes (only with the switch on)
- **Heat follows the energy.** The heat is pulled toward the solo's energy (0 = its quietest bar, 1 = its crest) harder than before, the dice are quieter, and a jump goes the way the energy goes.
- **The plan's score asks for it.** Best of 8 now also scores "the quick notes of each bar rise and fall with the bar's energy" (weight 0.3), and counts a long stretch of bars in one pace harder (0.4 instead of 0.2) so plateaus do not turn mechanical.
- **Held goal notes at the high points are dressed.** A held goal note (the end of a call, an answer, the climax) was often left bare at high heat. Now its chance of vibrato and a bend (where the note sits a step or two over a scale note) rises with the energy.
- A run-up into a crest needs no rule of its own: the energy rises into it, so the heat does.

## What it does not change
- The goal notes, the last note, range, hands and speeds: the checker has the last word as before. Goal notes lost: 0.
- Real solos are busy all through (6-7 notes a bar in every quarter, `STUDY-SOLO.md`), so the pull is mild: the quiet bars still play about 6 notes, the loud ones about 7.5. It changes the speed and kind of notes more than how many.
- Not done here: notes picked by the chord's role (step 3 of `SOLO-HARMONY.md`).

## Numbers (108 solos, Solo story on and Solo expression on, off → on)
- Quick-note share against the bar's energy: r -0.04 → 0.20.
- Quick share in the quietest / loudest quarter of bars: 0.41 / 0.41 → 0.31 / 0.49.
- Notes a bar in the quietest / loudest quarter: 7.1 / 6.6 → 6.1 / 7.6.
- Held notes dressed in the quietest / loudest quarter: 0.47 / 0.39 → 0.54 / 0.48.
- Solos with 5+ bars in one pace: 6% → 7% (a valley's flat trough is that by design; 8 solos).
- Goal notes lost 0; default unchanged; same seed, same notes.

## Tried and dropped
- A stronger pull (quiet bars down to 5.9 notes a bar: sparser than real solos).
- Letting the "itch" (the urge to flurry after holding) fade in quiet bars: no difference (r 0.14 → 0.15).

## Next
1. Paul listens: Solo story on, Solo expression on, flip this switch on one song.
2. Step 3: runs and bends lean to the chord's tension note.
