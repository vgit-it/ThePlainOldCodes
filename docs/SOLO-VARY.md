Status: built (2026-10-29), behind a switch. Paul has not heard it.

# Solo variation: a long solo does not sit on one band feel

Paul: a solo of 16 bars or more is the same eight bars of band played again (24 bars: three times), with one groove for the whole solo. It gets monotonous. For a 16-bar solo, a 4 or 8 bar stretch could have a different drum and chord feel.

Switch: Track options → **Solo variation** → On (`soloVary: 'on'`). Off by default; an old link plays as before. Works with any Solo writer (it changes the band under the solo, and the solo's energy). Check: `npm run solo-vary-check`. Code: `src/sections/solovary.ts`.

## What it does (solos of 16 bars or more; 8-bar solos are left alone)
- **A stretch**: every solo of 16 bars or more gets one (was 8 in 10). A solo of 24 bars gets two about 7 times in 10 (four bars or more apart, the second a different drum change; at most one of them held chords). 4 or 8 bars, on a four-bar phrase, never the first four bars (the solo enters as it always did). It may run to the end of the solo.
- **Drums** (always changed, and a different groove, not a tweak; one of, by genre and mood; a calm mood eases off, an angry one pushes, a dark one goes half-time):
  - breakdown (`light`): no snare, no crashes, no ride; quiet closed hats on the beats only; the kick on the 1 (every other bar also on beat 3). Metal, hard rock and alt metal keep their own kick pattern (kick-led), a little softer.
  - heavy half-time (`half`, 4/4 bars with a backbeat): one snare, on beat 3; one kick on the 1 (and the "and" of 2 if the groove had it); hats slowed to the beats; a crash on the 1 every other bar, an open hat on the 1 in between.
  - push (`lift`): ride on every 8th (louder on the beats), the kick on every beat, the snare on the off-beats (d-beat feel; pop and funk keep the 2 and 4 backbeat), a crash on every bar.
  - With the other section's chords the drums now change on top of its groove every time (it was half the time).
- **Chords** (one of, or none):
  - the other section's chords and groove (a verse solo gets the chorus's four or eight bars, and the reverse), same bar of the eight;
  - the song's chords held for the stretch (as Solo backing, only those bars: the rhythm guitar rings power or full chords, the bass holds the roots). Not offered when Solo backing already holds the whole solo.
  - With the other section's chords the drums change on top of its groove only half the time.
- **The solo follows**: the tension over the stretch dips (lighter, half-time) or lifts, so the tune plays sparser and bendier, or busier. Solo expression's heat reads it.
- **Kept**: the last bar (the hand-over to the next section) and bars with a fill keep their drums. The drummer's own phrase-end fills still come at bars 4, 8, 12... so the edges of a stretch are marked. The first bar of a lighter stretch keeps its crash.
- The section card says it: "Solo bars 5-8: the drums ease off (closed hats, no crashes)".

## For later
- A key lift or a relative-minor swap for the stretch (the tune is written over the chords, so it would follow).
- The mix level over the stretch (the dB per bar follows the arc, not this).
- Outro solos and lead breaks (short; left alone).

## Next
1. Paul listens (metal and hard rock 16-bar solos first, then calm moods).
