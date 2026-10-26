Status: experiment — steps 1 and 2 built (2026-10-26), Paul is to listen.

# Solo core notes: not every bar gets one

Paul: today every phrase ends on a core note (a long chord note), so most bars have one. Try a way where only some bars get a core note, and those notes and bars are hard hitting: chosen from the chords, the mood, the key and the rest. Bars without one: Paul decides later.

Switch: Track options, **Solo core notes (Melody + player)**: "Every phrase (as before)", "Chosen bars, cores only" or (step 2) "Chosen bars, with moves between". Code: `src/parts/solocore.ts` (`pickCores`), called from `generateSoloMelody` (`PlanOpts.cores`). Check: `npm run solo-core-check`. In "cores only" the solo is just the cores, plain, with no player on top, so the skeleton can be heard alone. A link from before has no option: as before.

## A. Which bars
Each bar scores (weights in `bar scores`):
- A chord arrives (new chord on the bar line 1; a change inside 0.5; the first bar 0.6).
- The mood likes the chord: the chord's root (`MOOD_CHORD`) and whether it holds the mood's colour note (`MOOD_COLOUR`, the vocal's own table).
- The section's turning points: the start 0.6, the halfway bar 0.4.
- Tension of the bar, the energy there, and drum accents (a kick or snare on the beats).
- The mood does **not** change how many bars get a core. It only says which chords show the mood.

Chosen: the climax bar (nearest the energy's crest) and the last bar always; then the best of the rest, with a little chance, until half the bars (`CORE_SHARE`). Never 3 bars in a row, never 4 without one.

## B. Which note, and how it is held
- Placed on the bar line; when the bar opens on the chord before, on the chord change that lands on a beat. Held to the next chord change or the end of the bar. A note that stands out less is held half the bar. The last bar's note is held to the end (carried on as before).
- A chord note (over a power chord, the key's 3rd as well), under the riff's clashes.
- What stands out (`stand`): the chord's 3rd (1.0) or 7th (0.9) over the 5th (0.4) and root (0.3; 1.2 at the end, 0.7 on the key's root in bar 1); the mood's colour note (0.5 a point of its weight); a note new to the chord (0.6); a note that says the key or mode (0.4).
- The pick also follows the energy's height and the mood's liking of the move from the core before (the vocal's interval theory). The climax's is the highest, the others stay 2 under it. Louder with the score.

## Numbers (52 solos, 80 songs)
- 50% of bars have a core note. On bars where a chord arrives, 67% do; 80% of cores sit on such a bar.
- The 3rd or 7th: 34% of cores against 26% of phrase endings with every phrase. Many chords are power chords with no 3rd or 7th, which holds this down.
- The mood's colour note: 12% against 4%.
- Checked: last bar and climax have one, none 3 in a row, no 4 bars without, every core a chord note, the climax core is the highest, the same seed the same notes, an old link plays as before.
- The last bar's core can be dropped by the song's ending (`makeEnding`) or a band stop, as the last note of every solo can; the check allows for it.

## Step 2: moves between the cores
Option **"Chosen bars, with moves between (step 2)"** (`soloCores: 'travel'`). Off by default; a link from before plays as before. The cores are exactly step 1's. The gaps between them (and the stretch before the first core) are filled with **moves**. Still no player on top, so the plan can be heard cleanly. Code: `src/parts/solomoves.ts` (`planMoves`, `writeMove`, `moveLine`), called from `generateSoloMelody`. The weights are in code only (`MOVE_LEAN`). Check: `npm run solo-moves-check`.

What a move is: repeat, repeat over a chord change, answer, sequence, wave, dive and climb, stairs, arch, zigzag, leap and fill, run, trill, arpeggio, pedal, neighbour notes, enclosure, double-stops, bend and release, slide in, stabs, or a rest.
- Every move can show up in every genre. Genre, mood, the place in the solo and the energy only change how likely each one is. A rare one (weight 1 in that genre) shows up once per solo at most.
- Never the same move twice in a row.
- Every move except rest and stabs ends within 2 scale steps of the next core (or bends or slides into it), so it leads in.
- Notes stay in the key (a chromatic note only in an enclosure), inside the playable range, on the 8th grid (fast moves may use 16ths), never over a core. Strong beats lean to chord notes.
- A gap shorter than a beat gets nothing, or one grace note. A gap longer than a bar and a half gets two moves, or a rest and a move.
- The card says it in one line per gap, e.g. `bars 3-4: wave (down and back up) into the 3rd of Bb`.
- A wide leap in leap-and-fill is marked `tap` in the record, for step 3.

**The signature lick:** a cell of 2 to 4 notes, stated in the first gap of 8 or more 16ths (not the climax's) as a repeat or an answer. It comes back 2 or 3 times (1 or 2 in solos under 6 bars), with the same rhythm and shape, moved to the chord, and one thing changed each time: an extra note, higher, or a bend on the top note.

Calls I made where the brief left room:
- A move plays in the range of the core it leads into (the range at that core, a little wider if the core sits at its edge), not the range at its own time. Where the energy climbs, the lead-in then sits in the core's register.
- Both moves of a long gap lead toward the core (the first one too).
- A return counts as a repeat or an answer, whichever the move beside it is not. If the signature lands late and the gaps after it are too short, it comes back fewer times than asked (the check allows for it).
- The song's ending can make the last core over, and trim the notes just before it. The check leaves that bit out.
- The check plays 140 songs twice over (more, if some rare move has not shown up in 4 genres yet).

## Not done yet
- Step 3, the player: techniques, every one possible in every genre, weighted the same way (3 leans in, 2 normal, 1 rare). Tune the move weights by ear first. Decided weights (rock, pop, funk, hardrock, metal, grunge, altmetal):
  - wide vibrato 3 2 1 3 3 3 2; hammer-on / pull-off 2 2 2 3 3 1 2
  - pinch harmonic (best on the climax core) 2 1 1 3 3 2 3; natural harmonic 1 2 1 1 2 2 2
  - tapping (on `tap` leaps) 1 1 1 2 3 1 2; palm mute (a chug between cores) 1 1 2 2 3 2 3
  - whammy / dive bomb 1 1 1 2 3 2 2; pick scrape (into the solo: arrangement) 1 1 1 2 3 2 2
- Sounds (a separate job): the lead has no sound yet for harmonics, tapping, whammy or pick scrape. Palm mute exists only on the rhythm guitar. Until those sounds exist, these play as plain notes.
- Tune by ear: the 3rd or 7th share, how long a core is held, how far the cores jump.
- The player is not run on the cores or the moves.
