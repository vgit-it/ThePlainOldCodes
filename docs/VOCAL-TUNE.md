Status: live behind a switch (2026-10-29): step A of bringing the Tune-first solo's ideas to the vocal. Paul has not heard it.

# Vocal tune: best of N versions, by a tune score

Paul: bring the approach of the Tune-first solo (`SOLO-TUNE.md`) into the vocal melody, where it makes sense.
Study of what carries over: the tune score and best-of-N (step A, this doc), a song-level skeleton of strong notes (B), cell-based motifs with a cadence run-up and answers (C).

## Step A: what it does
- Switch: Vocal melody card → **Tune pick** (Off, Best of 4, 8, 12). Stored as `vocalTune` in the options. Off is the default: the vocal is note for note what it was (`npm run song-check`).
- A **verse** and a **chorus** are each written in several versions. The phrasing (rhythm, breaks, holds) stays; only the pitch dice (`tones`, `neighbours`, `walk`, `endings`, `PITCH_RULES` in `form.ts`) are rolled again (`variant` in `build.ts`).
- Each version is scored as a tune (`src/verse/tune.ts`); the best is sung. Version 0 is the original, so it wins a tie.
- A song's choruses still share one melody: the master chorus is scored, the others take its version. An interlude or outro echoes the chorus's version (`echoedFrom`).
- The pre-chorus, bridge, interlude and outro are written once (not scored).

## The vocal tune score (0 to 1; 0.65 and up counts as a tune)
The solo's score turned to a singer. It reads the finished notes and the writer's own phrases.
- **repeat (3)**: a cell of 3 moves (shape + length) that comes back, not a plain run or a repeated note. Plus phrases that start like an earlier one.
- **steps (2)**: 40 to 80% of the moves are steps (1-2 semitones).
- **ends (2)**: phrases end on a chord note, held a beat or more.
- **leapBack (1)**: a leap of 5+ is followed by a step the other way.
- **smooth (1)**: few turns of direction (arcs, not wiggles).
- **range (1)**: a phrase spans an octave or less.
- **beats (1)**: chord notes on the bar's first beat.
- **same (1)**: not the same note over and over (a singer may repeat more than a guitarist: up to about a third of the moves).
- **top (1)**: the top note is not in every phrase.
Different from the solo's: phrases are the writer's (not found by gaps), cells are 3 moves (vocal phrases are short), the range is an octave.

It is a proxy for a tune, not the truth. The best of N is picked by this score, so its high number is partly the ruler measuring its own tool. The ear decides.

## Numbers (`npm run vocal-tune-check`, 30 songs, 7 genres, first verse and first chorus of each)
| | verse score | verse is a tune | chorus score | chorus is a tune |
|---|---|---|---|---|
| Off | 0.69 | 67% | 0.61 | 23% |
| Best of 4 | 0.78 | 100% | 0.71 | 83% |
| Best of 8 | 0.81 | 100% | 0.78 | 97% |
| Best of 12 | 0.83 | 100% | 0.79 | 97% |
- The whole vocal takes about 28 ms a song at Off, 93 ms at Best of 12.
- The phrasing of a section stays the baseline's in 80% (verse) and 93% (chorus) of songs at Best of 12: the other rules (stretch, silence fit, lone short units) read pitches, so they sometimes move a note.
- Still weak: smooth (verse 0.40), leapBack (0.55).
- Checks that hold with the pick on: no overlaps, no empty section, notes in the voice's limits, no lone short unit, choruses over the same chords are the same notes.

## What is next
- **B. Skeleton**: one strong note per phrase picked as a path through the chords' notes, planned for the whole song (verse low, pre-chorus climbs, chorus peak is the song's peak, bridge dwells), fed to `randomTones` through its `bias` hook.
- **C. Cells**: build the melody from a motif in scale steps (stated, moved, changed, contrast), a cadence run-up into each held note, and answers that play the call's cells again. Replaces the after-the-fact copies of rule 39.
- Vocal-only score terms: stressed syllables on strong beats (words are written after the notes today), chorus above verse.
