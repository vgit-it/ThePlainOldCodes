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
- `SOLO-CORE.md`: core notes in only some bars, chosen by the chords, mood and key (a switch, step 1).
- `SOLO-CORE-STEP2.md`: build brief for step 2, the moves between the cores (delete once built).
- `NECK-VIEW.md`: solo on the fretboard.
- `LICK-LAB.md`: the lick lab page.

## Vocal
- `VOCAL.md`: the demo singer and the main vocal.
- `VERSE-SECTIONS.md`: the verse melody writer (the main one): rules, forms, meters.
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
