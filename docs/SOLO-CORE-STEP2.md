Status: build brief, not built (2026-10-26). Once built: fold a short "Step 2" section into `SOLO-CORE.md`, delete this file, drop its line from `docs/README.md`. The weight tables move into code only, not copied into docs.

# Solo core notes, step 2: moves between the cores

Read `CLAUDE.md`, then `docs/SOLO-CORE.md` (step 1). Step 1 picks a strong core note in about half the bars (`src/parts/solocore.ts`, `pickCores`). Step 2 fills the gaps between the cores with **moves**: a lick, a shape, a run, a rest. Every move can show up in every genre. Genre, mood and place in the solo only change how likely each one is. Paul decided all of this; build it as written and ask him before changing anything in it.

## Paul's rules
- Behind the existing switch, as a new option. Off by default. A link from before plays exactly as before.
- Every move is possible in every genre. Weights lean it (table below). A **rare** move (weight 1) appears at most once per solo, so it sounds like a surprise, not the wrong style.
- Never the same move twice in a row.
- A **signature lick** is on: a short idea stated early that comes back 2 to 3 times, changed each time.
- Every move except space and stab ends leading into the next core.
- The cores stay exactly as step 1 picks them.
- No player on top yet (as in step 1), so Paul hears the plan cleanly.
- Paul is not a dev: short, plain notes on the card and in the PR.

## Switch
- `TrackOptions.soloCores`: add `'travel'` (now `'only' | 'travel' | 'off'`). `PlanOpts.cores`: add `'travel'`.
- `index.html`, `#t-solocores`: add `<option value="travel">Chosen bars, with moves between (step 2)</option>`.
- `src/main.ts`: the sync line and the change handler accept `'travel'` (anything unknown is `'off'`).
- `src/track.ts`: pass `cores` for `'travel'` the same way as for `'only'`, and skip `playSolo` for `'travel'` too.

## Where the code goes
- New `src/parts/solomoves.ts`: the move table, the leans, the gap planner and the note writers for each move. Export `planMoves(...)` (which move goes in each gap) and `writeMove(...)` (the notes for one move), plus `moveLine(...)` for the card.
- `src/parts/solomelody.ts`, in the `o.cores` branch: for `'travel'`, after `pickCores`, make a separate rng (`new Rng('moves-' + rng.next())`) so the cores match `'only'` exactly. Then plan and write the moves and add their hits next to the cores' hits. Card note: as step 1's, plus one line per gap, e.g. `bars 3-4: wave (down and back up) into the 3rd of Bb`.
- Reuse; don't copy:
  - `scaleOf` (`solofigure.ts`) for the key's notes.
  - `chordTones` (`guitar2.ts`).
  - `intervalCost` / the mood's `Profile` (`verse/intervals.ts`) for picking each next note.
  - `placedHit` (`licks.ts`): a `PlacedNote` already carries `dyad` (double-stop), `trill`, `tremolo`, `vib`, `bend`/`unbend`, `art: 'slide' | 'legato'`.
  - The shape ideas in `solofigure.ts` `CONTOURS` / `CLIMBS` (scale-step targets).
  - The playable range from `CoreCtx.window` / `centerAt`.

## The gaps
- A gap runs from the end of one core to the start of the next. The stretch before the first core is a gap too. Nothing is written after the last core.
- A gap shorter than a beat: nothing, or a single grace note into the core.
- A gap longer than 1.5 bars gets two moves (they must differ), or one move and a rest.
- Notes sit on the 8th grid, except the fast moves (run, trill or tremolo, sweep), which may use 16ths.
- Notes stay in the key's scale. Chromatic passing notes are allowed only in enclosure and approach notes (at most 10% of the notes).
- Strong beats lean to chord notes. Notes stay inside the playable window, and none overlaps a core.
- A move's last note is within 2 scale steps of the next core, or bends or slides into it. Space and stab are exempt.

## The moves
Each move has a shortest gap it fits (in 16ths) and, where it matters, a note for the player later.

| Move | What it does | Shortest gap |
|---|---|---|
| repeat | a short pentatonic or in-key cell, 2 to 4 times | 8 |
| repeat-over-change | the same cell while the chord changes under it (the gap must cross a chord change) | 8 |
| answer | a short phrase, then the same rhythm with new notes | 8 |
| sequence | one shape moved step by step up or down the scale | 8 |
| wave | drop, then come back up | 6 |
| dive-climb | fall low, then a long climb into the core | 8 |
| stairs | a steady climb or fall | 4 |
| arch | up and over | 6 |
| zigzag | wide back and forth | 6 |
| leap-fill | a big jump, then step back (mark a wide leap `tap?` in the move's record: step 3 decides) | 4 |
| run | a fast scale burst into the core | 4 |
| trill | two notes, very fast (`trill` or `tremolo`) | 4 |
| arpeggio | the chord's notes in a row; fast = a sweep | 4 |
| pedal | keep returning to one note between moving ones | 6 |
| neighbour | circle around a note (neighbour or turn) | 2 |
| enclosure | just above, just below, then onto the core | 2 |
| double-stop | two strings together (`dyad`) | 4 |
| bend-release | one note bent up and let down (`bend`, `unbend`) | 4 |
| slide-in | a long slide, then hold (`art: 'slide'`) | 2 |
| stab | short notes on the groove, staccato | 2 |
| space | rest (a whole gap, or the rest of one) | 0 |

## The weights (start here, tune by ear)
Numbers: 3 = leans in, 2 = normal, 1 = rare (once per solo at most). In code: 3 → 2.5, 2 → 1, 1 → 0.3.

| Move | rock | pop | funk | hardrock | metal | grunge | altmetal |
|---|---|---|---|---|---|---|---|
| repeat | 3 | 2 | 3 | 3 | 2 | 3 | 2 |
| repeat-over-change | 3 | 2 | 2 | 3 | 1 | 2 | 2 |
| answer | 2 | 3 | 2 | 2 | 2 | 2 | 2 |
| sequence | 2 | 2 | 1 | 2 | 3 | 1 | 2 |
| wave | 3 | 2 | 2 | 2 | 2 | 2 | 2 |
| dive-climb | 2 | 2 | 1 | 2 | 3 | 2 | 2 |
| stairs | 2 | 3 | 1 | 2 | 2 | 2 | 2 |
| arch | 2 | 3 | 1 | 2 | 2 | 2 | 2 |
| zigzag | 1 | 1 | 2 | 2 | 3 | 1 | 3 |
| leap-fill | 2 | 2 | 1 | 2 | 2 | 2 | 2 |
| run | 2 | 1 | 1 | 3 | 3 | 1 | 2 |
| trill | 1 | 1 | 1 | 2 | 3 | 1 | 3 |
| arpeggio | 1 | 2 | 1 | 2 | 3 | 1 | 2 |
| pedal | 2 | 1 | 1 | 3 | 3 | 1 | 2 |
| neighbour | 2 | 3 | 2 | 2 | 1 | 2 | 2 |
| enclosure | 2 | 2 | 3 | 2 | 2 | 1 | 2 |
| double-stop | 3 | 1 | 2 | 3 | 1 | 2 | 2 |
| bend-release | 3 | 2 | 1 | 3 | 2 | 3 | 2 |
| slide-in | 2 | 3 | 2 | 2 | 1 | 3 | 2 |
| stab | 1 | 1 | 3 | 1 | 1 | 1 | 2 |
| space | 3 | 3 | 3 | 2 | 1 | 3 | 2 |

The genre is `song.partGenres.strum`, as `solomelody.ts` reads it.

**The mood leans** (×1.6 on these, the rest ×1):
- happy: stairs (up), arch, answer, neighbour, slide-in
- triumphant: sequence (up), dive-climb, run, double-stop
- nostalgic: bend-release, slide-in, answer, space
- melancholic: wave (falling), bend-release, stairs (down), space
- dreamy: slide-in, space, arpeggio, neighbour
- tense: trill, zigzag, enclosure, pedal
- angry: stab, run, double-stop, pedal, zigzag
- dark: dive-climb, pedal, trill, bend-release

**Place in the solo** (×1.5):
- Before the climax core, the first half: space, repeat, the signature, answer, bend-release, slide-in.
- The gap into the climax core: run, sequence (up), dive-climb, stairs (up), trill.
- After the climax: wave (down), stairs (down), bend-release, space.

**Energy:** where the energy is high, the busy moves are ×1.3 (run, trill, arpeggio, zigzag, sequence, pedal). Where it is low, the sparse ones are ×1.3 (space, bend-release, slide-in, neighbour).

**Fit:** a move whose shortest gap is longer than the gap gets weight 0.

## The signature lick
- In the first gap of 8 or more 16ths (not the climax gap), write a cell of 2 to 4 notes: its rhythm and its scale-step shape. That gap's move is `repeat` or `answer`, labelled "signature".
- It comes back 2 or 3 times in later gaps, for solos of 6 bars or more (1 or 2 times in shorter ones).
- Each return keeps the rhythm and the shape, moved to fit the chord. The last note changes to lead into the next core, and one more thing changes each time (an extra note, higher, or a bend on the top note).
- A return counts as its gap's move for the "not twice in a row" rule.

## Check: `scripts/solo-moves-check.ts` (`npm run solo-moves-check`)
Base it on `scripts/solo-core-check.ts`: perform mode, N=140 songs, every genre and mood. Assert:
- The cores in `'travel'` are the same as in `'only'` (step, note, length).
- No same move twice in a row. A rare move (weight 1 in that genre) appears at most once per solo.
- The signature comes back 2 or 3 times in solos of 6 bars or more.
- Each non-space, non-stab move's last note is within 2 scale steps of the next core, or bends or slides into it.
- Off-scale notes are at most 10%. No note is outside the window. No note overlaps a core.
- The genre leans show:
  - Metal's share of run, trill, arpeggio and pedal is above rock's.
  - Funk's share of stab is the highest.
  - Pop's share of stairs, arch and answer is above metal's.
- Every move appears in at least 4 genres across the run (everything is possible everywhere).
- Space is between 10% and 40% of all gaps.
- The same seed gives the same notes. Nothing set equals `'off'`. `'only'` is unchanged from step 1.
- Print a table: moves × genres share, and the notes per solo.

## Before pushing
`npm run typecheck`, `npm run build`, `npm run song-check` (must say "all 40 songs match"; never refresh `scripts/song-reference.json`), `solo-core-check`, `solo-moves-check`, `solo-melody-check`, `solo-player-check`, `solo-breath-check`. One PR, ready for review. Then tell Paul in a few bullets how to hear it.

## Not in step 2 (decided, for later)
- **Step 3, the player:** techniques, every one possible in every genre, weighted the same way. Tune the move weights by ear.

| Technique | rock | pop | funk | hardrock | metal | grunge | altmetal |
|---|---|---|---|---|---|---|---|
| wide vibrato | 3 | 2 | 1 | 3 | 3 | 3 | 2 |
| hammer-on / pull-off | 2 | 2 | 2 | 3 | 3 | 1 | 2 |
| pinch harmonic (best on the climax core) | 2 | 1 | 1 | 3 | 3 | 2 | 3 |
| natural harmonic | 1 | 2 | 1 | 1 | 2 | 2 | 2 |
| tapping (on `tap?` leaps) | 1 | 1 | 1 | 2 | 3 | 1 | 2 |
| palm mute (a chug between cores) | 1 | 1 | 2 | 2 | 3 | 2 | 3 |
| whammy / dive bomb | 1 | 1 | 1 | 2 | 3 | 2 | 2 |
| pick scrape (into the solo: arrangement) | 1 | 1 | 1 | 2 | 3 | 2 | 2 |

- **Sounds (a separate job):** the lead has no sound yet for harmonics, tapping, whammy or pick scrape. Palm mute exists only on the rhythm guitar. Until those sounds exist, these play as plain notes.
