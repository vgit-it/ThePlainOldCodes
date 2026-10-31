Status: built (2026-10-31). Two fixes are always on; the lift is a switch (Vocal melody card → Last chorus lifts, off by default). Paul has not heard it.

# The singer in the last chorus, and in later verses

Found in a review of the vocal chain (2026-10-31, 80 default songs). Three things were wrong or missing in the verse melody writer's song:

| What | Before | Now |
|---|---|---|
| Song with a key change: the last chorus | Sung in the **old key** while the band played in the new one: 27% of its notes out of the key, 20% on a chord note (the first chorus: 3% and 85%) | The same tune moved up by the step the band moved: 0% off the key and chords, 87% on a chord note, 1.5 semitones higher on average |
| Verse 2 sung to verse 1's tune | The **same words** as verse 1 in 20 of 20 songs (the words were seeded by the chords only) | New words on the same notes; verse 1 is unchanged |
| The last chorus, key staying | Same as the first (−0.05 semitones) | Switch: about a third higher, each chord note moved up to a chord note |

## Key change (always on)
- `src/verse/sing.ts` shares one build between the choruses with the same chords (`hooks`). That cache did not know the key, so the last chorus (key up) took the first chorus's notes, written in the old key.
- Now the cache keeps the key each build was written in; a section in another key takes the same notes moved by the shortest step (`keyStep`, `moveKey` in `src/verse/final.ts`). The chords moved by the same step, so every note is on the same chord note as before. The rhythm and the words are the first chorus's.
- If the moved notes would pass the voice's far limits (`fits`) the section is written again in its own key, as before.
- Songs with a key change are about 5% of default songs (the switch Key change forces it).

## Later verses (always on)
- `wordsSeed` (`sing.ts`): the first verse's words are seeded as they were; a later verse adds its place among the verses. A verse sung to the same notes gets new words; its syllables still sit on the same notes (the words writer fits syllables to the notes it is given).
- The tune is not changed: verse 2 sings verse 1's tune, as before (55% of songs). Verse 2 answering verse 1 with its own variation is still on the list (`VERSE-SECTIONS.md`, Next).

## Last chorus lifts (switch)
- `vocalLastLift` (Vocal melody card checkbox, link option, off by default; `liftBuilt` in `final.ts`). Only the song's last chorus, only when there are two or more choruses and the key stays (a key change has lifted it already, never twice).
- Each note moves up to the nearest note about 3 semitones higher (a window of 1 to 8 above): a chord note to a chord note of the chord under it (the root to the 3rd, the 3rd to the 5th, the 5th to the root; over a power chord the key's own 3rd counts, as it does in the writer), a passing note to a scale note that is not a chord note, nearly always. A bend inside a note keeps its size. A note that would pass the voice's far top stays.
- The rhythm, the phrases and the words are the other choruses' (same notes' steps and lengths). Other sections are untouched.
- Numbers (`npm run vocal-final-check`, 80 songs): higher by 3.85 semitones on average (2.9 to 4.9); chord notes 87% (before 87%); off the key and the chords 0% (before 1%); the moves go the same way (up, down, same) 96% of the time; the highest note 79.
- The size is an average because the chord notes are 3 to 5 apart. If a third is too much or too little, `LAST_LIFT` and the window are the knobs.

## Checks
- `npm run vocal-final-check` (N=80): key change (in key, on the chords, the same rhythm and words, higher by the band's step); later verses (new words in every repeated verse, words on the notes); the lift (off is the default, same seed same notes, the size, in key, chord notes, rhythm, words, shape, other sections unchanged, no double lift).
- `song-check`: 18 of 40 songs differed on main (the vocal). Now 35: 2 from the key-change fix, 15 from the later verses' words. Deliberate; the reference is not refreshed.

## Not done
- Verse 2 answering verse 1 with its own variation of the tune (verses still repeat the tune).
- A lift that is more than pitch: the last line an octave up, ad-libs on the lift (the backing already adds ad-libs over the climax).
- The outro after a key change is its own section (written in its key); it is not moved from the chorus.
