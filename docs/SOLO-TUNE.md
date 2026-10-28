Status: design + step 1 built (2026-10-28). The score exists; the writer is not built yet.

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

### Baseline (83 solos a writer; step 1)
| writer | score | counts as a tune |
|---|---|---|
| As before | 0.52 | 11% |
| Planned | 0.63 | 34% |
| Melody + player | 0.66 | 58% |
| Library story | 0.65 | 45% |
The weak parts everywhere: a cell that comes back (about 0.3 of 1), few turns of direction (0.15 to 0.4), a leap that steps back (0.35 to 0.58), phrases of the right length (Melody + player 0.62 is the best).
Target for the new writer: 95% of solos at 0.65 or more.

## Steps (each behind its switch, with its check; Paul listens after step 3)
1. The tune score and the baseline. **Done.**
2. Skeleton line (strong note per bar), marked on the melody view.
3. Motifs and phrases of 2, 3, 4 bars.
4. Best-of-12 pick by the score.
5. Dress with Solo polish and Solo shape.

## The vocal (later)
The vocal needs a different shape (words, syllables, breath, a verse and chorus that rhyme in melody), so it gets its own phrase plan. It can reuse the score and the motif tools once the solo is heard.
