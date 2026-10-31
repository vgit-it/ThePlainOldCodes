Status: step 1 (reader, baseline), step 2 (the plot, wired into Tune first behind a switch), step 2b (seven energy shapes, a menu to force one), the expression add-on step 3 (notes follow the chords) and step 3b (the last note leads into the next section) and step 4 (the story score), each behind its own switch, built 2026-10-31. Paul has not heard it.

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

## Step 3: notes follow the chords (built, `roleNotes` in `src/parts/solotunefirst.ts`)
Switch: Track options → **Notes follow the chords** → On (`soloStoryNotes: 'on'`). Needs Solo story on. Off by default; an old link plays as before. Check: `npm run solo-notes-check`.

What it does (only the strong notes and the figure; the plot is unchanged):
- **The strong note of each phrase is picked for the chord it lands on** (the chord at the end of its hold):
  - a place to rest (home, an arrival): the root, or the 3rd; the last note of the solo still rests on the root;
  - a chord that wants to move (V, a 7th chord, a suspended chord): the note that leans (the 3rd, the leading note of V, the 7th), not the root; the last note too, if its chord wants to move on;
  - a deceptive turn (V to vi): the 3rd;
  - a calm or away chord: a call asks (3rd or 5th), an answer rests (root or 3rd);
  - the peak, when it sits on an arrival, takes the 3rd or root (the 5th costs a little).
- **The run-up leans the way the chord goes:** into a chord that wants to move the line comes up to the note from below; into a place to rest it comes down.
- **Each round says it again:** when the chords loop, a phrase one loop after another of the same length plays that phrase's figure again (same rhythm, same cells, moved to where its strong note goes) and ends the same way (same hold and rest). Before, an answer could only copy the phrase just before it.
- The motif already moves with the chords: a repeated cell is put on a chord note of the chord it starts on. Not changed.
- The last phrase reading the next section's first chord: step 3b below.

Numbers (120 solos, Solo story on, notes off → on):
- Calls on a chord that wants to move land on a note that leans: 44% → 68% (34 calls).
- Arrivals and answers on home land on the root or 3rd: 69% → 78%; on the root alone 61% → 52% (the 3rd now takes a share, so the root is not always the same).
- Calls on a calm or away chord land on the 3rd: 16% → 28%.
- Phrases one loop apart with the same figure (the first half's rhythm): 42% → 75%.
- Sounds like a tune: 0.76 → 0.76, 90% → 92% pass.
- The plot (phrases, peak bar, shape) is the same in every solo; default unchanged; same seed, same notes.

Not tried: tension notes inside phrases (only the strong notes are picked by role).

## Step 3b: the last note leads into the next section (built, `hand` in `src/parts/solotunefirst.ts`, `handFor` in `src/track.ts`)
Switch: Track options → **Last note leads into the next section** → On (`soloStoryHand: 'on'`). Needs Solo story on. Off by default; an old link plays as before. Works alone or with Notes follow the chords. Check: `npm run solo-hand-check`.

The last note rings on into the next section's first bar and bends to a note of that chord at the bar line (`carrySolo`, `src/sections/energy.ts`). Before, it was picked for its own chord only, so the bend was often a whole step, or none and a clash.
- **The last note is picked with the next section's first chord in mind.** The tune writer is given that chord's notes (in this solo's key, a key change in the last chorus counted). A note of that chord costs nothing, a semitone from one a little, a whole step more, three semitones more still.
- **It stays a note of its own chord.** The choice is made among the notes the solo's last chord allows (root, 3rd, 5th; the root-only shortcut for the last note is lifted when the hand-over is on). A little cost still prefers the root on home.
- Only the last phrase's strong note changes. The plot, the other phrases and the expression are not touched.
- The last section (nothing after it) has no hand-over: nothing changes.

Numbers (120 solos, 96 with a section after; Solo story on):
- The last note on a note of the next chord, or a semitone from one: 52% → 71% (alone); 53% → 79% (with Notes follow the chords on).
- A whole step away: 38% → 25% (alone); 40% → 21% (with notes).
- Three semitones or more: 10% → 4% (alone); 7% → 0% (with notes).
- Still a note of its own chord: 95% → 95%. Sounds like a tune: 0.76 → 0.76, 90% → 91% pass.
- The plot is the same in every solo; default unchanged 96/96; same seed, same notes.

Not tried: the last note's length (real solos end short, half a beat, and lead on; here the note still rings through the next section's first bar), a run-up into the next chord's note.

## Step 4: the story score (built, `storyFit` in `src/parts/solotunefirst.ts`)
Switch: Track options → **Story score** → On (`soloStoryScore: 'on'`). Needs Solo story on. Off by default; an old link plays as before. Works alone or with the other two switches. Check: `npm run solo-story-score-check`.

Tune first writes twelve versions and played the one that sounds most like a tune. The plot is the same for all twelve (it is made once), so the versions differ only in their notes. With this switch the pick also asks which version tells the plot best:
- **Which versions can win:** the ones within 0.05 of the best tune score (`STORY_WINDOW`), and, if the best passes as a tune, only ones that pass. So the tune never gets worse than 0.05 and a solo that passed still passes.
- **The story score (0 to 1):**
  - 40% the build: the bars' mean height follows the plot's energy (a level plot is neutral);
  - 30% the peak: the solo's highest note is in the peak phrase, and the peak's strong note stands above the other phrases' by the plot's gap;
  - 30% the ends: each phrase's strong note is what its chord asks for (the same cost as Notes follow the chords, whether that switch is on or not).
- Nothing else changes: the plot, the cells, the rhythm. The card says "the best of 12 as a tune and a story (0.78, story 0.71)".

Numbers (120 solos, Solo story on, off → on; the effect is small, it only chooses among twelve versions):
- Height follows the plot (r): 0.65 → 0.68 (with Notes follow the chords: 0.65 → 0.68).
- The highest note is in the peak phrase: 83% → 91% (86% → 92% with notes).
- Calls on a chord that wants to move lean: 53% → 59% (74% → 76% with notes). Answers on home on the root or 3rd: 81% → 80% (82% with notes).
- Peak above the others: 7.8 → 7.8 semitones (the plot sets that gap).
- Sounds like a tune: 0.83 → 0.82, 98% → 98% pass.
- With Solo mood on the writer ranks by a mood-aware tune score the check does not know, so the unaided figure drifts more (0.76 → 0.74, 90% → 86% pass); the writer's own score stays within 0.05 of its best.
- The plot is the same in every solo; default unchanged 96/96; same seed, same notes.

Not tried: more than twelve versions when the story score is on (more choice, more time), a story score for the expression pass, the hook quote (step 5).

## Plan (each step behind a switch, Paul listens after step 3)
1. Reader and baseline. **Done.**
2. **Plot** (**done**, 2b shapes **done**): from the chord map (micro), the section tension across loops (macro: first loop states, then develops, peaks, releases) and the mood (what plot: arrive-and-soar, keep-asking, resolve-late, float). The peak goes on the place of strongest pull or arrival, not on the random wave. Each phrase gets an intent: ask, answer, push, peak, rest. Shown on the card.
3. **Writer** (**done**: the switch Notes follow the chords, and the switch Last note leads into the next section): a flag on Tune first ("Story from chords"). Phrase cuts follow the chord turns; strong notes by role (tense chord: tension note, arrival: root or 3rd); the motif moves with the chords; the last phrase leads into the next section. The random energy curve is not used on this path.
4. **Story score** (**done**, as the switch Story score) next to the tune score (the build follows the plot's energy, the peak stands out, ends fit their chords); the best of 12 uses both.
5. Later: quote the vocal hook at the start.

Caution: the score is a proxy; Paul's ear decides.
