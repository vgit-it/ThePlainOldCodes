Status: step 1 (reader, baseline), step 2 (the plot, wired into Tune first behind a switch) and step 2b (seven energy shapes, a menu to force one) built 2026-10-31. Paul has not heard it. Notes are not yet picked by chord role (step 3).

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

## Step 2: the plot (built, `src/parts/soloplot.ts`)
Switch: Track options, **Solo story** (`soloStory: 'on'`). Needs Solo writer: Tune first. Off: Tune first note for note as before (song-check, tunefirst-check).
What changes when it is on: the random energy shape (`pickEnergy`) is not used. In its place a plot (`planPlot`):
- **Phrase cuts follow the chords.** Phrases of 2 to 4 bars, picked by a small search so each phrase ends where the chords make an ending (a waiting chord, or home). The loop's turn is a natural end. The mix comes out 40% of 2 bars, 27% of 3, 33% of 4.
- **Parts come from the chords.** A phrase ending on a waiting chord (pull .4+) is a call (it asks); one ending on home is an answer. Then the climax phrase and the end. Calls and answers alternate when the chords allow.
- **One peak**, the last bar of the climax phrase. The mood says what it sits on and how late: *arrive* moods (triumphant, happy, nostalgic, dreamy) on an arrival (home reached from a pull), *tense* moods (angry, tense, dark, melancholic) on the strongest pull. No arrival in the chords: the strongest pull. Where: triumphant 75% of the way, happy 65, angry 70, tense 70, dark 65, nostalgic 60, melancholic 50, dreamy 40. Now and then (15-40% by mood) the peak is said early (30%) and the line comes back up near the end, as real solos do.
- **Energy by bar** rises to the peak and lets go after it (how high it starts and where it ends are the mood's); the section's tension (smoothed over 4 bars, so the card's 4-bar saw does not show) and the chords' pull ride on top. The swing of height and pace follows the section's average tension (a quiet melancholic solo swings less than a triumphant one).
- The card shows the plot: `plot (arrive and soar): 8 phrases ...; the peak on I at the end of bar 12 (an arrival); energy ...` and one line a phrase (bars, part, the chord it ends on).
- Not changed yet: the notes inside a phrase (step 3).

### Numbers (111 solos; story off -> on)
| | off | on |
|---|---|---|
| calls end on a waiting chord | 40% | 100% |
| answers and the end on home | 37% | 59% |
| climax on an arrival chord | 23% | 37% |
| climax in the first 40% of the solo | 32% | 14% |
| energy against the section's tension (r) | 0.36 | 0.80 |
| energy against the chords' pull (r) | 0.15 | 0.24 |
| climax on the plot's peak bar | | 100% |
| sounds like a tune (0.65+) | 93% | 93% |
The climax comes much less often in the first 40% than the baseline (32%) because the old random shape often peaked early; real solos are around 55% in the first 30% (STUDY-SOLO), so the early chance may need to go up after listening.

## Step 2b: seven shapes (built, `src/parts/soloplot.ts`)
Why: the first plot always rose to one peak and fell (0% of solos had two crests, 0% held near the top). The old random shapes had waves, saw, steps, rising and falling; dropping them took the variety away.
Switch: Track options, **Solo story shape** (`soloStoryShape`: Auto or one shape; an unknown value from an old link is Auto). Works with Solo story on.
- **The shapes:** *arch* (up to one peak, then down), *rounds* (one wave a time through the chord loop, each crest higher, the last the main peak), *climb* (up, then stay up to the hand-over), *fall* (an early peak, then low), *valley* (high, drops, low, back up to the main peak), *level* (steady with one small lift), *steps* (hold, lift, hold; each lift ends a phrase).
- **Auto picks by what the song says** (weights; the card says why): the base mix follows real solos (level, falling, rising, arch, dip, plus rounds and steps); the mood (triumphant climbs, dreamy and melancholic stay level or low, happy goes in rounds, angry and tense hold or step); the genre (metal and hard rock climb and step, grunge stays level or low, pop goes in rounds, funk level); the chord loop (2+ loops of 2+ bars: rounds twice as likely); the length (16+ bars: rounds, steps, valley more likely); the sections either side (after a quiet section: climb; into a bigger one: climb; into a quieter one: fall); the song's climax (climb, arch).
- **Start and end levels** follow the neighbours: a solo after a quiet bridge starts lower, one going into a big chorus ends higher.
- **Needs bars:** arch 4, climb 5, fall 6, level 6, rounds 6, valley 8, steps 8. A shorter solo falls back to arch (the card says so).
- **Crests and cuts:** every crest is a bar a phrase ends on (the cut search is told them all). The main peak's phrase is the climax; the others are calls and answers whose energy is high.
- **How far under the main peak the other phrases stay** (the writer's cap, was always 3 semitones): arch, fall, valley, rounds 3; steps 2; climb and level 1. And how much the main peak stands out: 1, except level 0.35 (its climax target goes up 2 semitones, not 5).
- The card: `plot (arrive and soar; shape: rounds — triumphant, 3 loops of 4 bars): ... crests at the end of bars 4, 8, 12; energy ...`.

### Numbers (111 solos, Auto)
| shape | share | shows in the played energy | played height follows the plan (r) |
|---|---|---|---|
| fall | 21% | 100% | 0.67 |
| rounds | 19% | 90% | 0.65 |
| arch | 18% | 100% | 0.64 |
| level | 17% | 100% | 0.28 (flat on purpose) |
| valley | 10% | 100% | 0.49 |
| climb | 10% | 100% | 0.68 |
| steps | 5% | 100% | 0.76 |
- Every shape forced by hand shows in 95-100% of the played energy, the climax sits on the main peak bar in 100%, and 84-95% still sound like a tune (level and steps 84%).
- Level is 17% here against 38% of real solos (their measure is the pitch by quarter, ours the energy plan, so not the same ruler). It may need to go up after listening.
- Climax in the first 40% of the solo: 32% (story off) -> 20% (story on); energy against the section's tension r 0.36 -> 0.45 (it was 0.80 with the one arch; the shapes now go their own way).

## Expression follows the story (2026-10-31)
Solo expression now has a switch to play the story's energy: `SOLO-EXPRESSION-FOLLOW.md`.

## Plan (each step behind a switch, Paul listens after step 3)
1. Reader and baseline. **Done.**
2. **Plot** (**done**, 2b shapes **done**): from the chord map (micro), the section tension across loops (macro: first loop states, then develops, peaks, releases) and the mood (what plot: arrive-and-soar, keep-asking, resolve-late, float). The peak goes on the place of strongest pull or arrival, not on the random wave. Each phrase gets an intent: ask, answer, push, peak, rest. Shown on the card.
3. **Writer**: a flag on Tune first ("Story from chords"). Phrase cuts follow the chord turns; strong notes by role (tense chord: tension note, arrival: root or 3rd); the motif moves with the chords; the last phrase leads into the next section. The random energy curve is not used on this path.
4. **Story score** next to the tune score (peak on a high-pull place, ends resolve where the chords resolve, the build follows the tension curve); best of 12 uses both.
5. Later: quote the vocal hook at the start.

Caution: the score is a proxy; Paul's ear decides.
