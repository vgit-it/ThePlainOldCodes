Status: live behind two switches (2026-10-29): step A (Tune pick) and step B (Strong notes planned first) of bringing the Tune-first solo's ideas to the vocal, both mood-aware. Paul has not heard either.

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

### Numbers (60 songs, first verse and first chorus, 7 genres; after the mood step below)
| | chorus top above verse's | verse falls | chorus peaks early | answers end on root | verse score | chorus score |
|---|---|---|---|---|---|---|
| Off | 60% | 43% | 62% | 27% | 0.70 | 0.61 |
| Tune pick: best of 12 | 67% | 45% | 58% | 33% | 0.78 | 0.73 |
| Strong notes | 92% | 67% | 90% | 45% | 0.72 | 0.62 |
| Strong notes + best of 12 | 90% | 63% | 85% | 46% | 0.80 | 0.72 |
- Scores here are the plain tune score. Since the mood step the pick is made by the mood-aware score, so the plain score of the pick is lower than the 0.83 / 0.79 of step A.
- Phrase ends land within 2 semitones of the plan in 80% of phrases, on its note in 67%. The rest are a mood's own ending (a hanging 7th, 2nd or 4th, or a colour note), which the plan leaves alone.
- The speed is as before (the plan is cheap).
- Checks that hold: no overlaps, no empty section, no lone short unit, choruses over the same chords are the same notes.

## Mood: the tune keeps the song's mood (`npm run vocal-mood-check`)
Both steps first ignored the mood (the Intervals rule, `INTERVALS.md`, and the other mood notes ran as before, but the tune score wanted one kind of line for every mood and the plan's spine was one shape). Fixed:
- **Tune score with a mood aim** (`aimFor` in `tune.ts`, from the mood's interval profile): the share of steps and of leaps it wants (small-move moods want many steps and few leaps, big-move moods the other way), the share of rising moves, how often a leap is answered by a step back, and how well the moves fit the mood's table of intervals. The pick keeps the version that is a tune *in the mood's way*.
- **Strong notes with a mood**: a rising mood (happy, triumphant) falls less across a section, a falling one (melancholic, dark) more; a calm mood swings less and leaps less, a big-move mood more. A mood's hanging ending or colour note is left alone by the plan. The tension curve still leans the register (it did before the plan too).
- A weaker pull toward the plan (leap 0.8, w 0.5): a strong pull overrode the Intervals rule's liking of rising or falling.

### Numbers (40 songs, four moods, verse and first chorus; moves inside phrases)
| way | melancholic | tense | angry | triumphant |
|---|---|---|---|---|
| Off: size / leaps / rising | 3.3 / 22% / 48% | 3.6 / 24% / 67% | 3.9 / 28% / 59% | 4.1 / 34% / 74% |
| Tune pick | 2.4 / 10% / 42% | 2.7 / 12% / 64% | 3.6 / 22% / 56% | 3.7 / 27% / 70% |
| Strong notes | 2.9 / 19% / 43% | 3.3 / 26% / 51% | 3.6 / 29% / 46% | 3.7 / 31% / 52% |
| Both | 2.5 / 11% / 43% | 2.5 / 11% / 57% | 3.3 / 22% / 52% | 3.5 / 26% / 61% |
- The order of the moods holds in every way: sad is small, triumphant wide, in size and in leaps.
- Tune pick makes every mood a little calmer (smaller moves, fewer leaps) than Off: the tune score likes steps. The moods stay apart.
- **Still weaker with Strong notes: the lean to rise or fall.** Off: melancholic 48% rising moves against triumphant 74%. Strong notes alone: 43% against 52%. With the Tune pick on top: 43% against 61%. The pull toward the plan evens out the up and down moves. Best used with the Tune pick; or to fix later by giving the plan the mood's direction inside each phrase.
- `npm run interval-check` fails its leap-ratio target on the unchanged code too (it did before these steps).

## Step C: cell motifs (`npm run vocal-cells-check`)
Switch: **Phrases built from cells** (Vocal melody card). Off = rule 39's copies as before. `src/verse/cells.ts`, in `build.ts` at the place rule 39 had (last, on the line as it will sound). Verse and chorus only.
- It rewrites pitches only. Rhythm, breaths, long notes, bends and every mood note stay as the rules before made them (checked: the rhythm is the same note for note).
- **Motif**: a phrase's first 3-4 notes are the motif, as written (stated). A later stretch with the same rhythm is sung to its shape in scale steps: moved up or down the scale, the same, changed at its last note, or turned upside down (a contrast; only for the third). Rough rhythm = short or long note; the exact rhythm is looked for first.
- **Run-up**: the 2 (sometimes 3) short notes before a held ending step up or down to it by scale steps. Less often for a big-move mood, so its leaps stay.
- **Answers replay the call's cells**: an answering leaf plays its call's cells again, wherever its rhythm has them, then runs up to its own ending.
- A cell is only placed where long notes on strong beats stay on the chord's notes and the range holds; else the notes stay.
- Rule 39's big shapes (bar-long, across call and response) stand down in verse and chorus when this is on.

### Numbers (60 songs, first verse and first chorus; plain tune score)
| way | verse score / tune | chorus score / tune | verse ends by a step | chorus ends by a step |
|---|---|---|---|---|
| Off (rule 39) | 0.697 / 73% | 0.617 / 28% | 62% | 67% |
| Cells | 0.725 / 80% | 0.648 / 45% | 74% | 74% |
| Cells + Strong notes + best of 12 | 0.822 / 98% | 0.742 / 85% | 68% | 58% |
- A motif lands in 23% of verse phrases and 4% of chorus phrases. Chorus phrases have few notes (4-5) and long ones, so there is no room for two cells of the same rhythm. In the chorus the gain is the run-up and the answers.
- Run-ups into the ending: 34% of verse phrases, 25% of chorus phrases. 181 cells replayed in answers (verses).
- **Not better: the "cell that comes back" part of the score** (verse 0.75 → 0.72, chorus 0.26 → 0.22). A pitch-only pass finds few places with the same rhythm, and a run-up turns a distinct ending into a plain run. Rule 39 copied the rhythm as well; this one can't.
- The mood holds (`npm run vocal-mood-check`, six ways): Cells alone sits close to Off in size of move, leaps and rising moves; the order of moods holds in every way.
- Checks that hold: no overlaps, no lone short unit, range, choruses over the same chords are one melody, `song-check` unchanged with the switch off.

## What is next
- **Cells that set the rhythm too**: a motif with its own rhythm written first (the solo does this), so every phrase can carry two cells. Needs the rhythm rules (phrases, runs, holds, silence fit, short-note share) to work around cells; a bigger change.
- Vocal-only score terms: stressed syllables on strong beats (words are written after the notes today), chorus above verse.
- The skeleton could cover the pre-chorus climb and the bridge too, and plan the whole song at once (so the chorus peak is the song's peak by construction, not by the lifts).
