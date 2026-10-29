Status: live behind two switches (2026-10-29): step A (Tune pick) and step B (Strong notes planned first) of bringing the Tune-first solo's ideas to the vocal. Paul has not heard either.

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

## Step B: strong notes planned first (`src/verse/skeleton.ts`, `npm run vocal-skeleton-check`)
Switch: Vocal melody card → **Strong notes planned first** (checkbox; `vocalSkeleton`; off by default; off = note for note as before). For a verse and a chorus.
- **Plan**: before a leaf is written, the strong note of every phrase is picked as one best path through the chords' notes (the chord under the phrase's end), as in the solo's skeleton.
  - A height from the section's spine: a verse falls slowly; a chorus peaks early (the hook, about a third in) and comes home.
  - A call (first phrase of a pair) ends a little higher, an answer a little lower and on the root, the section's last phrase low and on the root.
  - One phrase is the peak; the others stay 2 semitones under it.
  - The path avoids the same note again and leaps over a 5th.
- **Leans, not rules**: the register the line is pulled toward rises or falls to each phrase's note (`target`, into `voiceLead`), and the chord note a bar sits on at the end of a phrase leans to the planned one (`bias`, into `randomTones`). The mood contour's lean stands down while this is on.
- **Phrase ends sing the plan** (`withGoals`): each phrase's last note takes the planned note where the chord has it. Bends, colour notes and the silence fit run after, as before.
- **Answers repeat**: a leaf that answers another keeps its plan (so the hook repeats); only the section's last phrase is planned fresh.
- Prechorus and bridge keep their own climb and dwell (rules 22, 24); interlude and outro are not planned.
- With the Tune pick on, each version rolls the plan's dice too (the plan is part of the version).

### Numbers (60 songs, first verse and first chorus, 7 genres)
| | chorus top above verse's | verse falls | chorus peaks early | answers end on root | verse score | chorus score |
|---|---|---|---|---|---|---|
| Off | 60% | 43% | 62% | 27% | 0.70 | 0.61 |
| Tune pick: best of 12 | 72% | 42% | 62% | 29% | 0.83 | 0.79 |
| Strong notes | 93% | 63% | 97% | 53% | 0.73 | 0.63 |
| Strong notes + best of 12 | 95% | 72% | 83% | 54% | 0.85 | 0.77 |
- Phrase ends land within 2 semitones of the plan in 94% of phrases, on its note in 90%.
- The speed is as before (the plan is cheap).
- A cost: the chorus's tune score is a little under the best-of-12 alone (0.77 against 0.79). The planned heights make a few more leaps in a chorus. The score does not measure the song's shape (the peak, the fall, the root ends), which is what this step is for.
- Checks that hold: no overlaps, no empty section, no lone short unit, choruses over the same chords are the same notes.
- Tried and left: a weaker pull (leap 0.7, w 1.0 is kept; 0.8 / 0.6 changed little) and a smaller spine swing (0.4 / 0.5 left the chorus under the verse in 1 song in 5).

## What is next
- **C. Cells**: build the melody from a motif in scale steps (stated, moved, changed, contrast), a cadence run-up into each held note, and answers that play the call's cells again. Replaces the after-the-fact copies of rule 39.
- Vocal-only score terms: stressed syllables on strong beats (words are written after the notes today), chorus above verse.
- The skeleton could cover the pre-chorus climb and the bridge too, and plan the whole song at once (so the chorus peak is the song's peak by construction, not by the lifts).
