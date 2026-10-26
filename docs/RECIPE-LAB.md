Status: live — v1 built (2026-10-26): the 67 named licks as data, and the recipe lab page to write, mark, hear and save them. PC only.

# Recipe lab

A tool on Paul's PC to grow the lick library to about 200 licks and recipes, his own inventions too, each marked with what it is, so the solo writer can later stack and adapt them (other keys, chords, lengths). Not on the public site.

Start it: `npm run recipe-lab` (the dev server, opens `/recipe-lab.html`). Save with the Save button or Ctrl S: it writes `src/recipes/licks.json` in the repo; then commit as usual.

## The library: `src/recipes/licks.json`
- One entry per lick, one field a line (a change is a one-line change in git). Order matters: the app plays the live licks in file order.
- Fields: `id`, `name`, `status`, `who` (the player: sung / blues / run / simple / muted), `speed`, `q` (over minor, major or either chord), `notes`, and the marks: `role` (job in a solo), `genres`, `moods`, `energy` (1-5), `credit`, `source`, `about`.
- Notes as text, as before (`pos:semi:len:techniques`, the note over the chord's root): `b2` bent up, `r2` let down, `pb2` pre-bend, `h` hammer/pull, `s` slide, `d-N` double-stop N under (`d-0` unison bend), `trN` trill, `trem`, `rk` rake, `x` ghost, `c` outside the key (meant), `v` vibrato. New: `@N`, the string it's fingered on in the tab (1 high E to 6 low E); only for the tab, the app picks its own fingering.
- **Live** licks are the 67 the app already played (Guitar 2 and the lick lab). **Draft** licks are only heard in the recipe lab. A draft goes live later behind a switch (it changes the songs).
- Code: `src/recipes/library.ts` (read, write, check the file), `src/recipes/facts.ts` (facts, guesses, tab fingering). `src/parts/licks.ts` builds `LIBRARY` from the live licks.

## The page (`recipe-lab.html`, `src/lab/recipeLab.ts`)
- **List**: search (name, credit, notes), filter by player, job (or "not marked yet") and live/draft. Changed licks are badged until saved.
- **Lick**: name, player (and a second one), speed, chord. Live licks are locked here (notes, name, player, speed, chord), so the songs can't change by accident: "Copy as a draft" to change one. Drafts can be deleted.
- **Tab**: the lick drawn over the root of the chosen key (from E3 up). Click a string to add a note; click a note to pick it; type the fret; arrows move it in time (Shift a beat) or a half step; Alt + up/down the same note on another string; `[` `]` shorter/longer; Del removes; Space plays. The note panel sets string, fret, length, bend (½ to 2 steps), let down, pre-bend, double-stop, trill, hammer/pull, slide, vibrato, ghost, rake, tremolo, outside the key. A bend keeps the fret and changes the note. The notes text can be typed too (checked as you type). "Re-finger" forgets the strings and fingers it with the least hand movement.
- **Hear it**: the lick over a jam (as the lick lab: key, mode, one chord or a progression, feel, tempo, lead tone, real sound), four times, placed as the app places it. If the app would skip it (a note not in the key, a held note rubbing, not ending on a chord note, a minor lick on a major chord), it plays as written and says why.
- **What it is**: job in a solo (phrase, lead-in, tag, fill, build, ramp, peak, release, ending), genres, moods, energy, credit, source, notes. Dashed chips are guesses from the notes (not saved until kept or clicked): the job from speed, direction, bends and length; the genres from where the player is at home (`BY_GENRE`, `src/players/lead.ts`); the moods from the vocal's interval taste (`moodFit`, `src/parts/solotags.ts`); the energy from speed and big bends.
- **Worked out**: length, notes a beat, range, shape, biggest jump, first and last note over the root, techniques, notes outside the key.

## Saving
The dev server (`vite.config.ts`, `recipeSave`) answers `/__recipes/licks`: GET reads the file, POST checks it (`problems`) and writes it (`formatFile`). Only the lab can post (it sends a header other sites can't). The page keeps its own copy, so a save doesn't reload it. The built site has no save: the page would be read only (it isn't built anyway).

## Check (`npm run recipe-lab-check`)
The file is valid and written as the lab writes it; notes read back the same; the app's `LIBRARY` is exactly the live licks in order; every lick fingers in all 12 keys and the tab gives back the same notes; facts and guesses are sound. `npm run song-check` stays "all 40 songs match" (the port changed nothing).

## Next (from the scope)
- Marks used by the writers: drafts behind a switch for Guitar 2, then the solo recipes picking by job, genre, mood and energy.
- Recipes with stretchy parts (repeat a cell a step higher until the target; a hold that grows), so a ramp or build fits any gap: today's recipe families (`src/parts/solorecipes.ts`, `solomoves.ts`) moved into the library as templates, one family at a time, note for note.
- Stacking rules (which job follows which, joins within a step or two), MIDI import of a few bars, a "what's missing" report (no fall for funk...).
