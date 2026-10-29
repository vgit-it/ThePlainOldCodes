Status: step 1 built (2026-10-28), feel added (2026-10-29), behind a switch. Paul has not heard it.

# Solo expression: the Tune first melody played like a guitarist

Paul: the Tune first melody works, but it is plain and mechanical. He wants the tune kept and played with expression: slow and fast bends, pedal-note runs, licks, faster notes (16ths, 32nds even in metal), and the way great solos mix quick regions with slow bendy punctuation. Not fixed by mood or genre (every solo would sound alike), and nothing mechanical like 4 bars fast then 4 bars slow. One bar can be a bent note for three quarters and a quick run for the last quarter.

Switch: Track options → **Solo expression** → On (`soloExpress: 'on'`). Needs Solo writer: Tune first. Off by default; an old link plays as before. On, it replaces Solo polish for Tune first. Check: `npm run solo-express-check`. Code: `src/parts/soloexpress.ts`.

## What the melody step gives (measured, 24 solos)
- About 51% quarters, 25% 8ths, no 16ths at all; about 5 notes a bar even at 167 bpm.
- Whole bars repeat note for note.
- A good singable skeleton, but slow and block-like. So the pass plays the time between the tune's notes again, it does not just dress them.

## The idea
- The melody lives in its **goal notes** (the end of every call, answer, climax and end phrase, and the last note) and in the beats. Those keep their start, pitch and end.
- Everything else is played in **windows**: from a note's start to the end of that note, or of the next one or two (never over a goal). Windows do not follow cells or bars; they start and end where the melody's notes do, and a run can cross a bar line.
- A window is a few **parts**, each a held note or a run, cut at random places in random proportions (the cut likes a melody note's start). Patterns: plain, decor (a held note with a bend and vibrato), hold+run, run+hold, run, hold (thin: the window's notes become one bent hold), hold+run+hold, run+hold+run. So a bar can be 3/4 bent hold and 1/4 run, or a flurry into a hold, or a hold between two flurries.

## What picks (no table by mood)
- **Heat** drifts toward the solo's energy and the player's fire, with noise and now and then a jump. **Breath** builds while it plays fast and asks for a held note. **Itch** builds while it holds and asks for a flurry. Fast stretches come out 3 notes, a bar or three bars long; nothing is clockwork.
- **Temper** (per solo, drawn from the seed): fire, bendy, free (how far it plays loose with the tune), contrast, pedal. Mood and genre only move the middle of each draw (metal fires hotter, melancholic bends more) and the draw is wide, so a metal solo can sing and a calm one can flare. The card says it: "restless, bendy, loves contrast".
- **Eight plans are written; the best is kept.** Its score: pace contrast between neighbouring windows, bars that mix a held note with quick notes, no long stretch of bars in one pace, variety of window kinds, relief (a held note soon after a flurry). A plan that keeps under 60% of the tune's notes is thrown out.

## Runs
- **Speed is in time, not in note values**: the heat asks for a gap between notes (about 260 ms down to 58 ms), and the nearest grid (8ths, 16ths, 32nds) is taken. 16ths at 65 bpm are not a flurry; at 170 bpm they are. Some runs speed up (16ths, then 32nds).
- The hand limits stay the checker's: a picked note needs 60 ms, a hammered or pulled one 40 ms. So fast 32nds are one pick and then legato.
- Shapes: **stair** (straight at the target), **arch** (up or down to a peak, then to the target), **seq** (a 3 or 4 note cell moved up or down a step each time, the shred sequence), **pedal** (the held note's pitch again and again between moving notes).
- The tune's own notes that fall on the run's grid are played at their place, louder, with the fast notes filling between: the tune shows through the run. The run ends a step or a third from the next note.

## Held notes
- Vibrato, and by the player's bendiness and the note's place (the climax and the end more): a bend into the note, a late bend (picked a step or two under, pushed up later), a bend let down. A thin window ending a step or two higher is played as one note bent up to it.
- Slow versus fast bends: done as an extra switch, Solo bends (`SOLO-BENDS.md`).

## Feel: 32nds, the muted burst, ghost notes, pre-bends (2026-10-29, same switch, Paul has not heard it)
Paul: 4 or 5 32nds in a row came too often, and he wanted muted notes, more pre-bends, and a rare all-out burst.
- **32nds above 100 bpm** (`FREE_32_BPM`): no run is all 32nds and no run speeds up into 32nds. They come as a **pair** (two 32nds where one 16th would be) at the start or at the end of a run of 16ths. The second of the pair is hammered or pulled when the hand cannot pick it (above about 120 bpm). A pair never follows a pair (no four in a row), and a copy from the echo that would make three in a row goes back to the tune's notes. At 100 bpm and under, 32nd runs are as before.
- **The burst**: a bar or two (8 to 40 steps) of **palm-muted** notes on one pitch, in 32nds (16ths when the tempo is above about 144 bpm: 32nds are quicker than a hand picks, 50 ms is the limit), the tune's own notes ringing out on top, the chug moving to a chord note when the chord changes, a neighbour now and then, the last two notes leaning into the next note. Once per solo at most, at a hot, high-energy spot, never over a goal note. Whether a solo is up for it is drawn from genre and mood and the player's fire: metal about half the time, angry and tense moods most, alt metal a little, hard rock very rarely, rock and grunge almost never, pop and funk never. A burst is not recast or echoed. Muted notes are `chug` hits: the hands still finger them and the checks still count them.
- **Ghost notes**: inside a run, now and then one slot is a muted scratch (a dead note at the pitch before it), never on the tune's own notes. By genre (funk most, metal least) times the player's own liking (`dress.ghost` in `soloperson.ts`).
- **Pre-bends**: a true pre-bend (picked already bent, then let down) joins the bend kinds, on long enough notes that are not the climax, the end or the last note. A minor-third (3 semitone) bend is possible for a bendy player on a long note when the scale has a note that far down. The last note never lets down in the expression (the hand-over bends it its own way).
- **Slides from note to note**: now and then a note is slid into from the one before it (same string, no new pick, `art: 'slide'`). Needs: both notes plain (no bend, trill, mute), a fret to five apart (a fret or two most), the note before long enough to hear the move (70 ms + 20 ms a fret), the two following on. Goal notes can be slid into (they keep start, pitch and end). Never into the last note. How often follows the player's own liking (`dress.slide`) and hands (`hands.slide`), about 4 a solo. The hands have the last word: a slide they cannot play on one string goes back to a pick (`slidesKept` in `soloverify.ts`).
- **Bends into the next note**: now and then one held note (3+ steps, not a goal) is bent or let down into the next note of the tune on that note's beat: a step or two up, pushed up to it; a step or two down, picked already bent and let down to it. The next note is then part of the bend (not a note of its own). Chance follows the player's bendiness. Done in the plan (`bendNext`), with the bend timed to the second note's beat (`bendAt`).
- Fixed on the way: a recast or an echo copy never loses one of the tune's middle landings now; the hand-over note (`carrySolo`) counts a note's `shift`, so a solo that ends on a run of 32nds ends on time.
- Check: `npm run solo-feel-check`.

## Kept safe
- Goal notes, the last note, the key, the range, no overlaps, no silence over a beat, speeds the hands can play, a fingering for every note: the checker (`soloverify.ts`, `loose` on: melody notes may be dissolved, everything else is judged) and the hands have the last word; a window that fails goes back to the tune's own notes.
- Same seed, same notes.

## Numbers (60 songs, 68 solos, all meters)
- Goal notes lost: 0. Tune notes still at their own start and pitch: 96%.
- Windows played another way: 60%. Bars that mix a held note with 3+ quick notes: 32%. Solos with a stretch of 5+ bars in one pace: 12%.
- Three or more kinds of window in every solo. Quick-note share differs by solo (sd 0.18) and by tempo (a slow grunge solo is slower).

## Fixed on the way
- `capAt` (sections/energy.ts) lengthened any note shorter than a step to a step when a section was capped. Notes shorter than a step stay as short now (it also helps the solo player's 32nds).

## Next
1. Paul listens.
2. Bend dials: built, behind the Solo bends switch (`SOLO-BENDS.md`). Paul listens.
3. Recast: built, behind the Solo recast switch (`SOLO-RECAST.md`): library licks, legato rolls, pedal figures and trill climbs as run parts; slide-ins and trills on held notes. Paul listens.
4. Echo: built, behind the Solo echo switch (`SOLO-ECHO.md`): an answer plays its call's figure again on its own notes, changed now and then; one signature figure comes back near the climax and the end. Paul listens.
5. Fold into Mood: all the way.
6. Maybe the melody step: some 16ths, dotted and syncopated rhythm, repeated bars that differ, long notes followed by a step (good for bends), and a reward for "room to play" in its best-of-12. Only if listening says the skeleton is in the way.

Amount dial (built, behind the Solo amount switch): Light / Normal / Full for how much of the tune the expression changes. See `SOLO-AMOUNT.md`.
