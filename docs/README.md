Status: live — the index of all docs, one line each.

# Docs index

One line per doc. Start here, then open only what you need. `HISTORY.md` is the full decision record; `CLEANUP-PLAN.md` is the repo clean-up in phases.

**Every doc starts with a `Status:` line.** To skim them all: `head -qn1 docs/*.md`. The words:
- `live`: describes what the app does now.
- `always on`: a switch that is fixed on (or an old switch with no menu now); describes current behaviour.
- `experiment`: Paul is listening, or the app no longer chooses it (Phase 6 of the clean-up decides).
- `research`: a study or notes; the evidence behind the writers.
- `history`: the old record, kept as it was.
- `archived`: describes code that was removed; in `archive/`.

## App and spec
- `HISTORY.md`: every milestone and decision, word for word (long; read only for the why).
- `SPEC.md`: the v1 idea-generator spec (history).
- `TRACKS.md`: how an idea grows into a track of sections.
- `TENSION.md`: the Mood choice and the tension curve over the song.
- `PERFORMANCE.md`: smooth playback on phones.
- `BACKGROUND.md`: keep playing with the screen off (Android, behind a switch).
- `CLEANUP-PLAN.md`: the clean-up plan, phase by phase.

## Rhythm guitar and the band's playing
- `RHYTHM.md`: rhythm guitar by character: research and how it's built.
- `STUDY-RHYTHM.md`: 5,346 real guitar parts measured against the app.

## Lead guitar and solos
- `LEAD.md`: lead guitar and solos, scope and licks.
- `LEAD-LINES.md`, `LEAD-FIGURES.md`, `LEAD-ROOM.md`, `LEAD-BREAKS.md`, `LEAD-LICKS.md`: lead features (always on now).
- `SOLO-THEORY.md`: how good solos are built (research).
- `STUDY-LEAD.md`, `STUDY-SOLO.md`: real lead parts and real solos vs the app.
- `SOLO-NEW.md`: the "As before" solo writer (`solo2.ts`).
- `SOLO-PLAN.md`: the planned writer, landings first.
- `SOLO-MELODY.md`: the melody step of the planned writer.
- `SOLO-PLAYER.md`: the melody handed to a guitarist ("Melody + player").
- `SOLO-CORE.md`: core notes in only some bars, chosen by the chords, mood and key (a switch, step 1), and the moves between them (step 2).
- `SOLO-CLIMAX.md`: the climax core played (bend and vibrato, bent again, pedal lick), behind a switch; also the held moves back to 4-8 16ths.
- `SOLO-STORY.md`: how a solo gets a story: study the gaps, give each a part (statement, answer, build, ramp, release, return), then phrases. Stage 1 built (the plan on the card, no licks yet).
- `SOLO-RECIPES.md`: stage 2 of the story: a recipe for each part (sung phrase with bend + pull-offs / unison bend / quick run, ramp from the bottom, build, fall), a Story row on the melody view. Behind a switch.
- `SOLO-LIBRARY.md`: step 2d of the story: the recipe lab's licks join the recipes (jobs from the lab's marks or guesses), and recipes are strung together so no rest is over a beat. Behind a switch.
- `SOLO-POLISH.md`: step 2e, the player dresses the story (vibrato, bends, figures on long holds, touches on short notes). Switch: Solo polish.
- `SOLO-SHAPE.md`: step 2f, the story's dynamics (loudness follows the arc, a laid-back start in soft moods, the last note rings). Switch: Solo shape.
- `SOLO-TUNE.md`: "Tune first", a melody-first solo writer (phrases of 2 to 4 bars, a strong note per phrase, answers, best of 12 by a tune score). Switch: Solo writer. Checks: `npm run solo-tune-check`, `solo-tunefirst-check`.
- `SOLO-HARMONY.md`: the solo tells the chords' story (home, away, tense, arrival). Step 1: a reader of the progression and a baseline of Tune first against it. Check: `npm run solo-harmony-check`.
- `SOLO-MOOD.md`: Solo mood (each mood's own jumps, pace, height, colour notes in Tune first) and Mood scale (over power chords the mood picks the 3rd and 6th). Switches: Solo mood, Mood scale. Checks: `npm run solo-mood-check`, `solo-scale-check`.
- `MOOD-SONG.md`: Mood song, the mood chooses the song's mode, tempo and drum feel (a sad mood: minor, slower, half-time). Switch: Mood song. Check: `npm run mood-song-check`.
- `MOOD-RIFF.md`: Mood riff, the mood picks the riff styles (sad: arpeggios, single notes, pedal; bold: gallops, big chords) and a major key's riff takes the major 3rd. Switch: Mood riff. Check: `npm run mood-riff-check`.
- `MOOD-ALL.md`: Mood: all the way, one switch for Tune first solos, Solo mood, Mood scale, Mood song and Mood riff (works on Auto mood too). Check: `npm run mood-all-check`.
- `SOLO-EXPRESSION.md`: Solo expression, the Tune first melody played like a guitarist (held bent notes, quick runs, flurries and breaths in windows of any length, tempo-honest speed, a temper per solo). Switch: Solo expression. Checks: `npm run solo-express-check`, `solo-feel-check` (32nd pairs, the muted burst, ghost notes, pre-bends).
- `SOLO-BENDS.md`: Solo bends, the bend dials (each bent note gets its own speed, shape and timing; the engine reads them). Switch: Solo bends. Check: `npm run solo-bend-check`.
- `SOLO-RECAST.md`: Solo recast (some runs become a library lick, a legato roll, a pedal figure or a trill climb; held notes slide in or trill). Switch: Solo recast. Check: `npm run solo-recast-check`.
- `SOLO-ECHO.md`: Solo echo (an answer plays its call's figure again on its own notes; one signature figure comes back near the climax and the end). Switch: Solo echo. Check: `npm run solo-echo-check`.
- `SOLO-AMOUNT.md`: Solo amount (Light / Normal / Full: how much Solo expression changes the tune). Switch: Solo amount. Check: `npm run solo-amount-check`.
- `SOLO-BACKING.md`: Solo backing, held chords under a solo (chords merged into 2–4 bar holds, the rhythm guitar rings them, the bass holds the root). Switch: Solo backing. Check: `npm run solo-back-check`.
- `SOLO-VARY.md`: Solo variation, a 4 or 8 bar stretch of a long solo (16+ bars) gets another band feel: lighter, half-time or lifted drums; the other section's chords or held chords; the solo's energy follows. Switch: Solo variation. Check: `npm run solo-vary-check`.
- `BRIDGE-LEAD.md`: Lead in bridges and breakdowns, a melodic Guitar 2 line there is written like a short lead break (solo writer, Solo expression, sparse) and the drummer fills under it. Switch: Lead in bridges and breakdowns. Check: `npm run bridge-lead-check`.
- `NECK-VIEW.md`: solo on the fretboard.
- `LICK-LAB.md`: the lick lab page.
- `RIFF-LAB.md`: the riff lab page and the new riff writer (single-note, chug, big chords, gallop, pedal, stabs + lick, picked hook, clean arpeggio, written in layers: rhythm, a few pitches, answer, form, best of many). In songs behind a switch: `RIFF-WIRE.md`.
- `RIFF-WIRE.md`: Track options → Riff writer (Classic / New): the riff writer plays the riffs of a track in the four riff genres (4/4; all eight styles, picked and arp too); best of 24.
- `GUITAR-SOUNDS.md`: the lead's new sounds (pinch and natural harmonics, whammy dive, feedback, pick scrape), made in code.
- `SOLO-SOUNDS.md`: solos and lead breaks use those sounds, by genre and player. Behind a switch (Lead guitar sounds).
- `RECIPE-LAB.md`: the lick library as data (`src/recipes/licks.json`) and the recipe lab (PC only, `npm run recipe-lab`): write licks as tab, mark them, hear them, save.

## Vocal
- `VOCAL.md`: the demo singer and the main vocal.
- `VERSE-SECTIONS.md`: the verse melody writer (the main one): rules, forms, meters.
- `VOCAL-TUNE.md`: the solo's Tune-first ideas for the vocal. Tune pick: a verse and a chorus written in 4, 8 or 12 versions, the best by a tune score is sung. Strong notes planned first: each phrase's note planned as a path (verse falls, chorus peaks early). Switches: Vocal melody card. Mood-aware. Checks: `npm run vocal-tune-check`, `vocal-skeleton-check`, `vocal-mood-check`. Phrases built from cells: a motif in scale steps, a run-up to held endings, answers replay the call's cells (replaces rule 39's copies).
- `VOCAL-EMOTION.md`: mood in the notes (study and the mood-note switches).
- `INTERVALS.md`: the mood in how the line moves.
- `VOCAL-BASS.md`: the bass-led vocal.
- `ARC.md`, `PATTERNS.md`, `REALISM.md`, `WORDS-REAL.md`: real-song numbers the vocal leans on.
- `VOCAL-WORDS.md`, `VOCAL-LEARNED.md`, `VOICE-WORDS.md`: words and the learned melody.
- `VOCAL-DEADCODE.md`: which vocal code the page can no longer reach (a list for Paul; nothing removed).
- Older vocal writers (not in the page now): `VOCAL-RHYTHM.md`, `VOCAL-MELODY.md`, `VOCAL-FIRST.md`, `VOCAL-MOVES.md`, `VOCAL-ENERGY.md`.
- Guide line leftovers (the card is gone; the singer still uses its tune and feel code): `GUIDE-TUNE.md` (`src/guide/tune.ts`), `GUIDE-FEEL.md` (`src/guide/feel.ts`). The Guide and Anchor line writers' docs are in `archive/GUIDE.md` and `archive/GUIDE-ANCHOR.md`.

## Voice and sound
- `VOICES.md`: voices and registers, a study.

## Band view
- `BAND-VIEW.md`: the pixel band playing the song.
- `BAND-VIDEO.md`: render the band view as a video.

## Research studies
- `STUDY-LAKH.md`, `STUDY-POP909.md`: vocal melodies in real collections.
- Also `STUDY-RHYTHM`, `STUDY-LEAD`, `STUDY-SOLO` above.

## Archive
- `ARCHIVE.md`: what was removed and how to get it back.
- `archive/GUIDE.md`, `archive/GUIDE-ANCHOR.md`: the removed Guide and Anchor line writers.
