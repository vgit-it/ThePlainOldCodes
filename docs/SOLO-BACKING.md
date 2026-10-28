Status: built (2026-10-28), behind a switch. Paul has not heard it.

# Solo backing: held chords under a solo

Paul: in hard rock, metal and grunge the band often holds long chords (or chord shapes) under the solo, and the lead sings over them. Would that break the solo system? No: the solo writers read the chords from the song's chord timeline by position, not as "one chord a bar".

Switch: Track options → **Solo backing** → Held chords (`soloBacking: 'held'`). Default: as written. An old link plays as before. Check: `npm run solo-back-check`. Code: `src/sections/soloback.ts`.

## What it does (solo sections only, including a solo outro)
- The section's chords are merged into spans of 4 bars (or 2; a 4-bar span needs 8+ bars). A span keeps the chord that sounds longest in it; the first span keeps the section's own first chord (the bar before was written to lead into it). The same chord twice in a row is one longer hold.
- The rhythm guitar strikes the chord on each change and again every second bar it carries on. Riff songs: a power chord rung until the next strike. Strummed songs: one down-stroke.
- The bass holds the root (riff songs: the guitar's tonic), struck at the same places, legato.
- The drums are not touched (their crashes follow the chord changes, so there are fewer).
- The solo writers (Tune first, and the others) and the expression pass read the new chords as they are. Fewer chord changes means fewer chord-note targets and more room for held bent notes.
- Hand-overs stay: the last bar into the next section (push, band hits, ring-out) and a stop before the solo are the seams' own.

## For the rhythm guitar later
- The plan is on the section: `section.soloBack = { span, strikes }` (the steps where the chord is struck).
- The band feel (`players/guitarists.ts` touches, `players/bassist.ts` embellishments) leaves these sections alone. A rhythm-guitar step can read `soloBack` to play its own way (sus and add9 colour, slow arpeggios, swells, a different voicing on each strike) without changing the chords again.

## Numbers (60 songs, 73 solos)
- Chords per solo: 8.1 → 2.8.
- Only solo sections change (and the bars next to them for the hand-over); "As written" is identical to before.

## Next
1. Paul listens (hard rock, metal, grunge first).
2. Rhythm guitar reads `soloBack`: its own colour and voicing on each strike.
3. Maybe: the Tune first melody gets a longer-phrase option over held chords.
