Status: step 1 built (2026-10-28), behind a switch. Paul has not heard it.

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
4. Expression as a motif: an answer plays its call's gesture again, changed; one signature gesture per solo. This wants the melody step to hand over its structure (which cell, which echo).
5. Fold into Mood: all the way.
6. Maybe the melody step: some 16ths, dotted and syncopated rhythm, repeated bars that differ, long notes followed by a step (good for bends), and a reward for "room to play" in its best-of-12. Only if listening says the skeleton is in the way.
