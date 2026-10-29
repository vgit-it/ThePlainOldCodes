Status: built (2026-10-28), behind a switch. Round 2 after Paul's first listen: the first version merged the chords into long holds and the solo sat on one chord; now the progression stays.

# Solo backing: held chords under a solo

Paul: in hard rock, metal and grunge the band often plays chords, not a riff, under the solo, and the lead sings over them. Keep the song's own progression; the rhythm guitar plays chords (power chords or full chords) instead of the riff.

Switch: Track options → **Solo backing** → Held chords (`soloBacking: 'held'`). Default: as written. An old link plays as before. Check: `npm run solo-back-check`. Code: `src/sections/soloback.ts`.

## What it does (solo sections only, including a solo outro)
- The chord changes stay exactly as written.
- The rhythm guitar strikes each chord when it changes, and again at the top of every second bar it carries on for. Riff songs: a power chord rung until the next strike. Strummed songs: one down-stroke of the full chord.
- The bass holds the root (riff songs: the guitar's tonic), struck at the same places, legato.
- The drums are not touched.
- The solo writers (Tune first and the others) and the expression pass read the chords as they are.
- Hand-overs stay: the last bar into the next section (push, band hits, ring-out) and a stop before the solo are the seams' own.

## For the rhythm guitar later
- The plan is on the section: `section.soloBack = { strikes }` (the steps where a chord is struck).
- The band feel (`players/guitarists.ts` touches, `players/bassist.ts` embellishments) leaves these sections alone. A rhythm-guitar step can read `soloBack` to play its own way: full chords in riff songs, sus and add9 colour, slow arpeggios, swells, a different voicing on each strike.

## Tried and dropped
- Merging the chords into 2–4 bar holds (the first version): the solo ended up on one chord from start to end. Not what Paul wants.

## Used by
- Solo variation (`SOLO-VARY.md`) holds the chords for one stretch of a long solo only (`soloBack.from` / `to`); the players leave just those steps alone.

## Next
1. Paul listens (hard rock, metal, grunge first).
2. Riff songs: full chords as well as power chords, by the song or the section.
3. Rhythm guitar reads `soloBack`.
