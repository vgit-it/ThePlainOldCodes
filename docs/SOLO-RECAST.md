Status: built (2026-10-28), behind a switch. Paul has not heard it.

# Solo recast: runs with a name, slides into held notes

Paul: the runs in the expressed solo are good but anonymous. Step 3 of the plan in `SOLO-EXPRESSION.md`.

Switch: Track options → **Solo recast** → On (`soloRecast: 'on'`). Needs Solo writer: Tune first and Solo expression: On. Off by default; an old link plays as before. Works with Solo bends: Dials. Check: `npm run solo-recast-check`. Code: `recast` in `src/parts/soloexpress.ts`.

## How it works
- A post-pass, like the bend dials: it runs after the plan is chosen, with its own seed per window. The tune, the windows and their kinds are as they were; only what plays inside some runs and held notes changes. So On vs Off is a fair A/B on the same solo.
- The checker and the hands have the last word. A recast window they send back gets its plain run back first; only if it still fails does it go back to the tune's notes.
- The card says: "recast: 3 licks, 2 legato rolls, 4 pedal figures, 1 trill climbs, 6 slide-ins, 3 held-note trills" (counted after the checker).

## Runs
Each run part picks one: stay as it was (about a third), or:
- **A library lick** (`src/recipes/licks.json`, the live fast and mid licks for the run, sung, simple and blues players). One that fits the run's length (cut down from its start where longer), over the chord there, in the key, a chord note at the end. Not the ones with double-stops, ghost notes, rakes, harmonics, dives, feedback, scrapes or tremolo. Its bends, let-downs, hammer-ons, slides, trills and vibrato play as written. Genre and mood lean the pick; a lick already used in this solo counts less. It must start within 7 semitones of where the line was and end 1 to 5 semitones from the next note.
- **A legato roll**: the scale in groups of 2, 3 or 4, one pick per group and the rest hammered or pulled, each group one step on. Needs a gap the hand can play legato and picks that are far enough apart.
- **A pedal figure**: climbing (or falling) notes with a high note struck between them again and again, the last note a step or a third from the next note. Fond players (Temper: pedal) choose it more.
- **A trill climb**: two neighbouring notes traded hammered and pulled, then two quick steps onto the next note.
- The run keeps its timing (every slot) and its first note; the tune's notes inside a run may be replaced.
- Joins stay smooth: the other three keep the run's first pitch; a lick is placed from where the line actually was, and checked against the note that follows.

## Held notes
- **Slide-in**: from 2 to 5 semitones below (7 in 10) or 2 to 3 above, on a held note of 3+ steps that has no bend. The player's slide habit (hands) sets how often. The last note of a section is skipped by the carried bend (a bend wins over a slide).
- **Trill**: a held note of 4+ steps, not the climax or the end, trills a step or a whole step above, hammered and pulled for the whole note. The player's legato habit sets how often.

## Numbers (60 songs, 74 solos)
- 64 solos recast. Licks 15, legato rolls 15, pedal figures 20, trill climbs 10, slide-ins 85, held-note trills 41.
- 92% of the notes are as the plan had them. The checker sent back almost nothing (tried 16 licks, kept 15).
- Goal notes (landings) and the end time unchanged. No overlaps. Plain/Off identical to before.

## Not yet
- Slides inside runs (a slide between two run notes that are not licks).
- Bends inside runs (also not dialed).
- Licks are rare (15 in 74 solos): few library licks fit the short runs. A dial if it is too sparse.
- Next: expression as a motif (echo, one signature gesture per solo), then folding it all into Mood.
