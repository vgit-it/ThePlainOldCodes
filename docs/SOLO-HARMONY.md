Status: step 1 built (2026-10-31): the chord-story reader and a baseline. No sound change. Paul has nothing to listen to yet.

# Solo harmony: the chords tell the story (brief, step 1 built)

Paul: in real songs the chord progression tells a story and the solo tells the same one. Does our solo do that? (Tune first: no, it follows each chord but never reads the plot.)

## How music does it (short)
- **Chords are the plot.** Home (I) → away (IV, ii) → tense (V, bII, a 7th or sus chord) → home. V to I is the full stop; stopping on V is a question; V to vi is a twist.
- **The melody mirrors the plot.** A tense chord gets a tension note (7th, 9th, 4th, a bend that wants to resolve); the arrival gets the root or 3rd and rests. Open endings ask, closed endings answer.
- **Vocals do the same.** Verse tells (low, narrow), pre-chorus asks (rising), chorus claims (high, held), bridge shifts the view, last chorus is bigger. One hook comes back, changed.
- **Good solos work one idea.** Say it, repeat it, move it to the next chord, push it, resolve it. The peak lands on a chord that matters. The end hands over to the next section.
- Real solos (`STUDY-SOLO.md`) do not climb to one late peak: 38% stay level, 55% hit their top in the first 30%. So the story is the chords plus a developing idea, not one rising arc.

## What the system has (signals)
- **Chords of the solo section.** Strongest. Today only chord notes are read, never the chord's part.
- **Section tension, per bar** (`planTension`, `tension.ts`). Reaches the solo, but only nudges the height. Better as the big arc across loops.
- **Section kind and neighbours**: what comes before (a bridge's release) and after (the last chorus).
- **Mood**: how much to resolve (triumphant arrives and soars, melancholic keeps asking, dark resolves late, dreamy floats).
- **Drums**: fills and crashes are natural landings (already locked).
- **Vocal hook**: the solo could quote it (later).
- **Not a good signal: the solo energy curve** (`pickEnergy` in `solo2.ts`). A random wave / rising / saw / steps from genre and a dice roll. It sets pace and height and has no link to the chords or the card. The new path should not use it.

## Step 1: the reader (built, `src/parts/soloharmony.ts`)
`readHarmony(events, total, mode)` gives each chord:
- **role**: home, rest (vi, bIII in minor...), away (IV, ii, iv), tense (V, vii, bII), lift (a borrowed bright chord in a major key: bIII, bVI, bVII).
- **pull** (0-1): how much it wants to move on. By degree and mode, plus the quality (a dominant 7th, a sus chord or a diminished one pull more; the major V in a minor key pulls hardest).
- **arrival**: home reached from a chord with a pull. **twist**: a tense chord that does not go home.
- The map also says if the chords **loop** (and how long), and if the solo **ends open** (on a waiting chord). `harmonyLine` writes it for the card: `I home → vi rest → IV away → V tense (loops 2x)`.
Pure and deterministic. Check: `npm run solo-harmony-check`.

## Baseline: Tune first against the story (111 solos, all genres and moods)
The chords have no say today. The numbers match chance:
| | Tune first | by chance |
|---|---|---|
| climax lands on a home chord | 36% | home is 41% of the time |
| climax chord's pull | 0.32 | 0.31 |
| climax in the first bar of an arrival | 18% | |
| calls end on a waiting chord (pull .4+) | 40% | |
| answers and the end land on home | 37% | 41% |
| a phrase lands within half a bar of an arrival | 26% of 185 | |
| energy curve against the chords' pull (r) | 0.15 | |
| energy curve against the section's tension (r) | 0.36 | |
Also: 59% of solos sit on a repeating chord loop, 47% end open (the chords wait for the next section), 1.7 arrivals and 0.4 twists a solo, 41% of the time on home.
So both halves of the idea are open: the climax and the phrase ends ignore the chords, and half of the solos are on a loop, where the chords alone tell the same story every time round.

## Plan (each step behind a switch, Paul listens after step 3)
1. Reader and baseline. **Done.**
2. **Plot**: from the chord map (micro), the section tension across loops (macro: first loop states, then develops, peaks, releases) and the mood (what plot: arrive-and-soar, keep-asking, resolve-late, float). The peak goes on the place of strongest pull or arrival, not on the random wave. Each phrase gets an intent: ask, answer, push, peak, rest. Shown on the card.
3. **Writer**: a flag on Tune first ("Story from chords"). Phrase cuts follow the chord turns; strong notes by role (tense chord: tension note, arrival: root or 3rd); the motif moves with the chords; the last phrase leads into the next section. The random energy curve is not used on this path.
4. **Story score** next to the tune score (peak on a high-pull place, ends resolve where the chords resolve, the build follows the tension curve); best of 12 uses both.
5. Later: quote the vocal hook at the start.

Caution: the score is a proxy; Paul's ear decides.
