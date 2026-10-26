Status: experiment — step 1 built (2026-10-26), Paul is to listen.

# Solo core notes: not every bar gets one

Paul: today every phrase ends on a core note (a long chord note), so most bars have one. Try a way where only some bars get a core note, and those notes and bars are hard hitting: chosen from the chords, the mood, the key and the rest. Bars without one: Paul decides later.

Switch: Track options, **Solo core notes (Melody + player)**: "Every phrase (as before)" or "Chosen bars, cores only". Code: `src/parts/solocore.ts` (`pickCores`), called from `generateSoloMelody` (`PlanOpts.cores`). Check: `npm run solo-core-check`. In "cores only" the solo is just the cores, plain, with no player on top, so the skeleton can be heard alone. A link from before has no option: as before.

## A. Which bars
Each bar scores (weights in `bar scores`):
- A chord arrives (new chord on the bar line 1; a change inside 0.5; the first bar 0.6).
- The mood likes the chord: the chord's root (`MOOD_CHORD`) and whether it holds the mood's colour note (`MOOD_COLOUR`, the vocal's own table).
- The section's turning points: the start 0.6, the halfway bar 0.4.
- Tension of the bar, the energy there, and drum accents (a kick or snare on the beats).
- The mood does **not** change how many bars get a core. It only says which chords show the mood.

Chosen: the climax bar (nearest the energy's crest) and the last bar always; then the best of the rest, with a little chance, until half the bars (`CORE_SHARE`). Never 3 bars in a row, never 4 without one.

## B. Which note, and how it is held
- Placed on the bar line; when the bar opens on the chord before, on the chord change that lands on a beat. Held to the next chord change or the end of the bar. A note that stands out less is held half the bar. The last bar's note is held to the end (carried on as before).
- A chord note (over a power chord, the key's 3rd as well), under the riff's clashes.
- What stands out (`stand`): the chord's 3rd (1.0) or 7th (0.9) over the 5th (0.4) and root (0.3; 1.2 at the end, 0.7 on the key's root in bar 1); the mood's colour note (0.5 a point of its weight); a note new to the chord (0.6); a note that says the key or mode (0.4).
- The pick also follows the energy's height and the mood's liking of the move from the core before (the vocal's interval theory). The climax's is the highest, the others stay 2 under it. Louder with the score.

## Numbers (52 solos, 80 songs)
- 50% of bars have a core note. On bars where a chord arrives, 67% do; 80% of cores sit on such a bar.
- The 3rd or 7th: 34% of cores against 26% of phrase endings with every phrase. Many chords are power chords with no 3rd or 7th, which holds this down.
- The mood's colour note: 12% against 4%.
- Checked: last bar and climax have one, none 3 in a row, no 4 bars without, every core a chord note, the climax core is the highest, the same seed the same notes, an old link plays as before.
- The last bar's core can be dropped by the song's ending (`makeEnding`) or a band stop, as the last note of every solo can; the check allows for it.

## Not done yet
- Step 2: the melody written between the cores (bars without a core). Open question: a lead-in toward the next core, space, or the earlier motif.
- Step 3: tune by ear (the 3rd or 7th share, how long a core is held, how far the cores jump).
- The player is not run on the cores.
