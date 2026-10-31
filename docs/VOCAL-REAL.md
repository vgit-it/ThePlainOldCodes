Status: built (2026-10-31), two switches on the Vocal melody card, both off by default. Paul has not heard them.

# The verse writer closer to real songs

The realism lab (`docs/REALISM.md`) put the default verse writer at 76, behind the learned writer (83). It repeats a note too often and sits on chord notes too much, because it picks one chord note per bar and sings the bar around it, and it never used the real-song data. Plan (from the review): 1 walk between chord notes, 2 real-song odds, 3 step back after a leap, 4 peak earlier, 5 narrower verse range, 6 the Tune pick also judges realism, 7 words. **Steps 1 and 6 are built.** The rest are not.

## Step 1: Walk between chord notes (`vocalWalk`, `src/verse/walk.ts`)
- Vocal melody card → **Walk between chord notes**. Off: note for note as before.
- Runs after the mood notes and before the repeated shapes copy the line (so a repeated shape is still a faithful repeat). Only pitches change; the dice are by position, so answers and choruses that repeat a stretch walk the same way.
- A note that repeats the one before it steps to the scale note beside it (45% of the time), toward the note that follows, so the line goes somewhere.
- A short chord note on a strong beat (50%; a bar's first beat only 20%: that is the chord's place) steps in from the note before and the note after takes it home, when the note after is a chord note: a passing note on the beat, resolved.
- Left alone: the first and last note of a phrase, held notes, notes with a bend, scoop or fade, neighbour and walk notes, mood notes, ends.
- The rhythm stays in most songs (52 of 60). Rule 39 (repeated shapes) reads pitches, so it sometimes finds other stretches; the phrases never change.

## Step 6: Tune pick judges real songs too (`vocalRealPick`, `src/verse/tune.ts`)
- Vocal melody card → **Tune pick judges real songs too**. Needs Tune pick (best of 4, 8, 12); on its own it does nothing.
- Three more parts in the tune score, only when on (`VOCAL_REAL_WEIGHTS`): the share of repeated notes near 29%, the share of chord notes on strong beats near 69%, the share of phrases peaking in their first half near 59% (`REAL`, from `src/realism/targets.json`).

## Numbers
My own check (`npm run vocal-real-check`, 60 songs, verse and chorus of each; repeats counted per move inside a phrase, so about 10 points above the lab's, which joins tied notes):

| | same note | chord notes on strong beats | phrase peaks early | tune score, % passing | distance to real |
|---|---|---|---|---|---|
| As before | 54% | 88% | 45% | 0.65, 51% | 0.59 |
| Walk | 36% | 81% | 46% | 0.68, 61% | 0.32 |
| Tune pick (12) | 44% | 87% | 42% | 0.76, 83% | 0.50 |
| Pick + real songs | 38% | 82% | 42% | 0.75, 79% | 0.39 |
| Pick + real + Walk | 30% | 76% | 46% | 0.76, 82% | 0.22 |
| Real songs | 29% | 69% | 59% | | |

The realism lab (`MODE=verse+walk`, six songs a genre; its ruler joins tied notes and counts strong beats its own way):

| | realism | same note | strong on chord | turn back after a leap | peak early |
|---|---|---|---|---|---|
| verse (as before) | 76 | 41% | 92% | 26% | 44% |
| verse + Walk | 77 | 28% | 88% | 31% | 43% |
| verse + Walk + Tune pick 12 + real pick | 78 | 24% | 86% | 38% | 40% |
| learned writer | 83 | 29% | 77% | 59% | 42% |
| real songs | | 29% | 69% | 61% | 59% |

- Repeats are fixed (28% against 29%). Walk also makes the line a better tune by the ordinary score (0.65 to 0.68).
- Strong beats are only partly loosened (the bar's first beat is protected, and the lab counts more of them than my check). The lab's total moved by 1 to 2 points because the biggest gaps are elsewhere: the range (15 against 12), the turn back after a leap, the phrase top and the early peak. Those are steps 3, 4 and 5.
- Walk with the Real-song pick overshoots the repeats a little (24%).

## Checks
- `npm run vocal-real-check`: off is the default; same seed, same notes; phrases never change, first and last notes of every phrase kept (100%); the rhythm kept in 75% or more of songs; same note again at least 6 points rarer and not under 20%; chord notes on strong beats rarer and not under 60%; not more notes off the key and chords, not more leaps; the tune score and the pass share hold; the real-song pick nearer to real songs than the plain pick with the tune score holding; the choruses of a song one melody.
- The realism lab has rows `verse+walk` and `verse+walk+pick`.
