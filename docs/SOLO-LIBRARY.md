Status: built (2026-10-26), behind a switch — Track options → Solo core notes → "story told in licks + the lick library, no rest over a beat (step 2d)". Not heard yet.

# Solo: the lick library, and no rest over a beat

Paul: use the licks from the recipe lab (`src/recipes/licks.json`) in the recipe list, jobs guessed from the notes for now (option B); and never more than a beat of silence — string the recipes together when filling.

## 1. The library joins the recipes (`src/parts/sololibrary.ts`, `libOf` in `solorecipes.ts`)
- The 67 live licks. Each lick's jobs are the ones Paul marked in the lab; where nothing is marked (all of them today) the lab's own guess from the notes stands in (`guessOf`, `src/recipes/facts.ts`). Mark them in the lab and the writer uses the marks; no code change.
- A part asks for licks that do its job: statement / answer / return = phrase, lead-in, tag; build = build, fill, lead-in; ramp = ramp, build; release = release, ending.
- Pick: the genre's licks and the mood's licks count more; a marked lick counts more than a guess.
- Placed like any lick (`placeLibLick`): ends where the part ends, in the part's range, key, no rubbing hold, last note a chord note near the core; cut down from its start if too long. Tried alongside the other recipes (about 4 tries in 10), the mood's liking of the way in and out decides.
- Repeats of the opening still play the opening's rhythm again (no lick there).

## 2. No rest over a beat (`stringRest` in `solorecipes.ts`)
- A beat = 4 16ths. From the solo's start to the last core, no rest between two notes (cores included) is longer than that.
- Where one is left (a link gap, a part left as space, a late first note), pieces are laid end to end: a sung phrase, a climb, a library lick or a short walk, each starting by the note before and the last leading into what follows (a core or the next note). On the way each piece aims at a waypoint between the two.
- A rest of up to 3 16ths may open the string (a breath), so the first piece starts on the beat if that is close, else on the next 8th. Nothing strung starts between the 8ths. Anything still open after that is crossed with a walk. A walk is 8ths with some quarters, always in the key, always ends within a step of its target, so it always fits.
- The card names each: "bar 1: 14 16ths left open, strung: a sung phrase + a lick (…)". On the melody view they show as grey "strung" parts (or in the colour of the part they fill).

## 3. Variety and slow releases
- A lick already played in this solo counts for about a seventh the next time, so a solo carries a spread of licks (about 2.6 per solo, nearly all different). Library licks are tried in 8 of 10 sung/build/ramp/fall attempts and weigh more in strung pieces.
- Releases: half the falls are a slow fall (2-3 held notes stepping down, the last left ringing), 4 in 10 attempts are a slow named lick (not fast, notes held), and a rest strung inside a release is crossed with long notes only (no climbs). About 70% of a release is on long notes (was under half).

## Checks (`npm run solo-library-check`)
Cores and story equal "story plan only"; no rest over a beat; strung parts start on the 8th grid; notes in the key, no overlaps; named licks and strung rests both turn up; same seed, same notes. `song-check` still all 40, `solo-recipes-check` unchanged.

## Not yet / numbers
- 6/8 and other meters use a beat of 4 16ths too.
- Busier than the step before: about every second part is now played or strung. A dial if too much.
- Next: mark jobs in the lab; more licks (drafts live later); stacking rules.
