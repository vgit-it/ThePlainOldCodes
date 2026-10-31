# Band view: the lead's new sounds, acted out

Status: built (2026-10-31). Band view only (`band.html`, and `band.html?art` too: same code). Video export uses the same stage.

## What it does
The lead guitarist now plays the sounds from `GUITAR-SOUNDS.md` with his hands. Before, the band score dropped these marks, so he played them like plain notes.

| Sound | What you see |
|---|---|
| Whammy dive | A steel bar stands up at the bridge and swings down over the last 0.8 s of the note (slow, then fast). The pick hand dips with it, the strings go slack, guitar face. |
| Pick scrape | Before the note the pick hand sweeps across the strings (blurred), bits of light fly off the pick. |
| Pinch harmonic | A white sparkle (yellow dot) flashes by the pick hand as the note is picked; guitar face for a moment. |
| Natural harmonic | The fingertip only touches the string over the fret, then lifts. A pale blue chime twinkles over the fret and dies away. |
| Feedback | The strings keep shaking, brighter, as the tone swells; guitar face. |
| Late bend | The fingertip stays put, then pushes the string up later in the note. |
| Bend dials | `bendAt`, `bendRise` and `bendEase` from the solo writer set when, how fast and how curved the fingertip's push is. |

## Where it is
- `src/band/score.ts`: the lead's notes carry the marks (`harm`, `dive`, `feedback`, `scrape`, `lateBend`, `bendAt`, `bendRise`, `bendEase`).
- `src/band/actors.ts`: `fingersOnNotes` (late bends, bend dials, natural harmonic touch), `soundsOf` (what is happening now), `soundFx` (the bar, sparkles and rasp, drawn as pixel effects, no new sprites), `shaking` (feedback, slack strings).
- Effects are drawn in code, so the drawn art (`?art`) gets them too. The stage's line tool only steps along x, so steep lines are drawn as single pixels (`dots`).

## Songs that change
- Songs without the Lead guitar sounds switch look the same as before, except late bends (the old licks have some): their fingertip now pushes up late. Checked by hashing every frame of 48 songs.

## Check
`npm run band-sounds-check`: over 200 songs with the sounds on, each sound turns up and is drawn (the bar moves, rasp before the note and gone after, squeal, chime, a late bend moves).

## Not yet
- Wah pedal (a foot rocking a pedal), Twin lead (second lead player), volume swell, ghost notes drawn muted.
- The dive bar is small and low contrast against the pick guard; a drawn frame in `art/` would read better (Paul's call).
- Hands are drawn from the existing frames; a dedicated thumb-brush or whammy-grip frame would need new art.
