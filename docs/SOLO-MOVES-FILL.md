# Solo moves: the silence before the lick (brief)

Status: **not built.** Paul wants this looked at. Ask him before changing anything it says. Read `docs/SOLO-CORE.md` first (step 2), then `src/parts/solomoves.ts`.

## What Paul hears
- The moves between the cores (Track options → Solo core notes → "Chosen bars, with moves between") **leave long silences before the lick starts.**
- He asked for the licks to be 16ths, not 8ths. That is done (PR 243). It made the silence worse.
- He does not want the silence. He asked: why isn't the room used for another lick, or a repeat of the same lick, maybe with a beat's gap between?

## Why it happens (not a bug, a design gap)
- Each gap (end of one core to the start of the next) gets **one move**. A gap over 1.5 bars gets two (`planMoves`, "the gaps, cut into slots").
- A move has a fixed size: it writes as many notes as its shape allows (`lay()` caps the count: stairs 2-6, wave 3-7, run 4-8, and so on).
- It is lined up to **end where the next core starts**. Whatever is left in front of it stays empty.
- Nothing asks "is there room for another move?". Even `repeat` stops at 4 plays of its cell.
- Numbers (60 songs, `cores: 'travel'`):

| | Before halving | Now (16ths) |
|---|---|---|
| Gap, avg (16ths) | 19.7 | 19.7 |
| Move, avg | 10.7 | 6.2 |
| Silence before the move | 9.0 | 13.4 |
| Silence after the move | 0 | 0 |

- The silence is in the gap before the move, after the last core ends. There is none after the move because it ends on the next core.
- The lick data files (`src/realism/licks.json`, `solo-licks.json`) are **not** involved. They are real-song counts used by the older writers. Do not edit them (`song-check` would fail, and the reference must never be refreshed).

## What Paul wants (his words, tidied)
- No dead air before a lick.
- Use the room for another lick, or a repeat of the same lick.
- Maybe a short gap (a beat or less) between licks.
- He wants to hear it on his phone, so keep it behind the existing switch.

## Options

**A. Fill the gap with more moves (recommended).**
- After the move that leads into the core, if 4 or more 16ths are left in front of it, plan another move before it.
- Between them, leave 0 to 1 beat of rest (often 0).
- Keep going until the room is used.
- The same rules apply: never the same move twice in a row, rare moves once per solo, the signature lick and its returns, genre/mood weights, MIN_GAP.
- Cost: bigger change in the planner (several moves per gap, working back from the core). Solos get busier.

**B. One longer move.**
- Keep one move per gap. Make it start right after the last core and add notes so it lands on the next core.
- Cost: stairs, runs and waves become long (up to a bar). Shapes lose their short, tidy feel. Repeats and answers are easy to extend, others are not.

**C. Slide the lick to the start of the gap.**
- Silence moves to just before the next core.
- Cost: that is the "space after" Paul did not like, and the move no longer leads into the core. Not recommended.

**D. Repeat the lick more (a part of A, or alone).**
- Raise the 4-play cap for `repeat`, `repeat-over-change` and the signature's returns when room is left.
- Cost: only helps the cell moves (about 20% of moves). The rest stay short.

**E. Leave it and use more notes in the short moves.**
- Raise the note caps in `lay()`.
- Cost: moves get long and samey, and still do not fill odd-sized rooms.

## Suggested approach for A
- Plan the move that leads into the core first (as now). Write it, so its start is known.
- Then the room in front of it is `[gap start, move start - rest]`. Plan a move there. Write it. Repeat.
- A move that is not the last in a gap has no core to lead into. Its last note must end near the **first note of the move after it** (within 2 scale steps), not near the core. `valid()` and `make()` use `core` for this today; they need a target note.
- The window stays the core's (`moveWindow`), as now.
- `writeMoves` walks the moves in order for the "previous note" (`prev`). Keep that order.
- Rests: a rest between moves is silence on purpose, at most a beat. The `space` move stays as a rest slot.
- The signature lick should be allowed to return in these extra slots, but keep 2-3 returns in solos of 6+ bars.

## Keep these true
- The cores equal step 1's ("cores only").
- Switch off = old songs unchanged. `npm run song-check` says "all 40 songs match". Never refresh `scripts/song-reference.json`.
- Deterministic (seeded). No `Math.random` or `Date`.
- Notes: in the key, inside the playable range, never over a core. Short: mostly 16ths, some 8ths, holds 2 to 4 16ths.
- Old links must not crash.

## What the check (`scripts/solo-moves-check.ts`) assumes today
- One record per gap or half gap. The card prints one line per record (`moveLine`). With several moves in a gap there are more records and lines.
- "No move twice in a row", "MIN_GAP", "rare once per solo", "signature returns 2-3", "every move in 4+ genres", "rests 10-40% of the gaps", "lead-in within 2 scale steps" (all moves, except stabs, today; the new rule is: the last move into the core, and each earlier move into the next move).
- "A move wrote notes" looks for hits in `[from, to)`.
- Add: no silence longer than a beat between a core and the notes after it, or between two moves, except a planned rest. Add: no silence before the core except a planned rest.
- Check also: genre leans, determinism, off-scale at most 10%, 16ths over half.

## Before pushing
- `npm run typecheck`, `npm run build`, `npm run song-check`
- `solo-core-check`, `solo-moves-check`, `solo-melody-check`, `solo-player-check`, `solo-breath-check`
- Update `docs/SOLO-CORE.md` (step 2 rules), fold this brief into it, and delete this brief.
- One PR, ready for review. Tell Paul in a few bullets how to hear it. Keep it short and plain, no tech.

## Questions for Paul (ask before building)
- Is "fill the whole gap with several licks" right, or should some gaps keep a real pause?
- How long may a pause between two licks be? (suggested: 0 to 1 beat)
