Status: live behind a switch (2026-10-28): the tune score (step 1) and the writer (steps 2 to 4) are built; step 5 (dressing) works through the existing Solo polish, Solo shape is not wired yet. Paul has not heard it.

# Solo tune: a melody-first solo writer

Paul: the solos (and the vocals) have no melody to hold them. Now and then a line comes out like a tune, by luck. He wants one almost every time. The solo starts again from strong notes, as a **new** solo writer; the three existing ones stay.

## Why the old ones feel random
- Each note is a weighted roll from the note before. Nothing remembers a tune.
- No cell that comes back, no phrase that answers an earlier phrase.
- The skeleton is chord notes only (3rds and 4ths apart), never steps.

## The idea: "Tune first" (a 4th entry in the Solo writer menu)
Old links and the other three writers play exactly as before.
1. **Skeleton**: one strong note per bar (or per 2 bars): a smooth path through the chords' notes (voice-leading, not dice), shaped by the energy curve (arch, ramp, wave). The climax bar gets the top note. Shown on the melody view.
2. **Melody in phrases of 2, 3 or 4 bars** (not a fixed 1-bar hook). A phrase is a *motif* of 3 to 8 notes (rhythm + contour, kept as scale steps so it fits any key) **spun out** over the phrase: stated, moved to a new start (a sequence), flipped or its end changed, then closed on the phrase's strong note. The phrase length is picked per phrase (2, 3 or 4 bars; 3 bars is 2 + 1 or 1 + 2). A song form is then built from phrases: call and answer (A A'), then B, then A back; or one long 4-bar line and its answer.
3. **Steps between strong notes**: scale steps mostly, chord notes on the bar's first beat, a leap steps back, a held note ends each phrase, no rest over a beat.
4. **Best of many**: write about 12 versions of each solo, score each (below), keep the best. This is what makes it work *almost every time*.
5. **Dress it**: the existing Solo polish and Solo shape run on top.

## The tune score (step 1, built: `src/parts/solotune.ts`, `npm run solo-tune-check`)
Reads finished notes only, so any writer can be scored the same way. 0 to 1; 0.65 and up counts as a tune. Parts and weights:
- **repeat (3)**: a cell of 4 moves (shape + length) that comes back, not a plain run or a repeated note. Plus phrases that start like an earlier one.
- **phrase (2)**: phrases (cut by a gap of 2+ steps or a held note) of 1.5 to 4.5 bars.
- **steps (2)**: 40 to 75% of the moves are steps (1-2 semitones).
- **ends (2)**: phrases end on a chord note, held.
- **leapBack (1)**: a leap of 5+ is followed by a step the other way.
- **smooth (1)**: few turns of direction (arcs, not wiggles).
- **range (1)**: a phrase spans 14 semitones or less.
- **beats (1)**: chord notes on the bar's first beat.
- **same (1)**: not the same note over and over.
- **top (1)**: one top note (2 times at most).
It is my proxy for a tune, not the truth: your ears decide, and the numbers get tuned to what you like.

### Baseline and the new writer (83 solos a writer, 4/4)
| writer | score | counts as a tune |
|---|---|---|
| As before | 0.53 | 14% |
| Planned | 0.63 | 36% |
| Melody + player | 0.66 | 59% |
| Library story | 0.67 | 54% |
| Tune first, 1 try | 0.67 | 54% |
| **Tune first** (best of 12) | **0.81** | **100%** |
Caution: the new writer is built to score well on this score (the best of 12 is picked by it), so its high number is partly the ruler measuring its own tool. The ear decides.

## What is built (`src/parts/solotunefirst.ts`, `npm run solo-tunefirst-check`)
Switch: Track options, Solo writer, **Tune first**. Stored as `soloPlan: 'tune'` in the link. The other writers play note for note as before (song-check).
- **Phrases of 2, 3 or 4 bars** (mix about 38% of 2, 20% of 3, 42% of 4; the last one takes the final bar as its held note). A short solo is one phrase.
- **Cells inside a phrase**, of half a bar, one bar or two: `a` (new), `seq` (the last cell moved up or down 1-2 scale steps), `var` (same rhythm, the last move changed), `b` (a contrast: new rhythm, flipped contour), then the **cadence**: a run-up in `a`'s rhythm that steps into the phrase's strong note, which is held (2, 3 beats or a bar, then maybe a breath of an 8th or a beat, never more).
- **Skeleton**: the strong note of every phrase is one path through the chords' notes (the vocal's interval theory, the energy's height, a call ends open and rises, an answer comes down and home, the last is the chord's root, one climax on the energy's crest with the others 3 semitones under).
- **Answers**: a phrase as long as the one before often plays its cells again (same rhythm and shape), started somewhere else and closed on its own strong note; a later phrase can come back to the first.
- **Chord notes where it counts**: the bar's first beat, its middle and every held note are chord notes; notes between are scale steps. A cell moved onto a new chord is nudged to the nearest chord note where it must be one.
- **Best of 12**: twelve versions, the best score is played (`soloTuneTries` in the options, never set by the page).
- **Dressing**: with Solo polish on, the player dresses it lightly (the same light pass as the core-notes writers); the strong notes stay (100%), notes grow by about 15%. Solo shape (loudness by role) is not wired for this writer yet.

### Numbers (96 songs, all meters: 4/4, 3/4, 6/8, 7/8, 5/4, mixed)
- 98% of solos at 0.65+ (mean 0.80); one try only 52%. 4/4 100%, 6/8 85%.
- Chord notes: 93% of bar starts, 94% of strong places. Never more than a beat of silence, no overlaps, all notes between 50 and 86.

## Steps (each behind its switch, with its check; Paul listens after step 3)
1. The tune score and the baseline. **Done.**
2. Skeleton (a strong note per phrase, and the first note of every cell as a smaller one: both are `landings`, so the melody view marks them). **Done.**
3. Cells and phrases of 2, 3, 4 bars. **Done.**
4. Best-of-12 pick by the score. **Done.**
5. Dress with Solo polish (done, light) and Solo shape (to do: loudness by phrase role; a laid-back start in soft moods).

## The vocal (later)
The vocal needs a different shape (words, syllables, breath, a verse and chorus that rhyme in melody), so it gets its own phrase plan. It can reuse the score and the motif tools once the solo is heard.
