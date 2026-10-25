Status: live — what in the vocal code the page can no longer reach, measured; nothing removed. Paul decides.

# Vocal code the page doesn't reach (clean-up Phase 6, 2026-10-25)

**Nothing was removed.** This is a list for Paul. The answer may be "later": he is experimenting with vocals now.

## The short version
- The page fixes its vocal settings (`MAIN_VOCAL` in `src/generator.ts`, applied to every idea by `src/main.ts`): rhythm **Words first**, melody **Learned**, **Real songs** on, **Patterns** on, Moves and Energy **auto**.
- The old choices (rhythm Classic and Grid; melody Classic, Shaped and Melody first; manual Moves and Energy) have no menu and a shared link can't switch them back on. Only research scripts can.
- About **1,000 lines** in four files never run in a normal song. Most of it is in `src/parts/melody.ts`.
- By default the lead vocal is written by the **verse writer** (`src/verse/`), which replaces the notes and words of the older pass. The old pass still runs first and is thrown away (see "A bigger question" below).

## How this was measured
- A run of the 40-song snapshot (`npm run song-check`): 40 songs, all genres and meters, all three Writer choices (Verse, Bass-led, Classic), with `MAIN_METHOD` applied as the page does.
- Node's built-in code coverage on that run: which functions and lines never ran. Numbers below are shares of the code lines that never ran, times the source file's length, so they are good to about ±10%.
- Then a search for who else sets the old options (`scripts/`, `src/lab/`, `src/band/`).

## Option by option

| Option | On the page | Who else reaches it |
|---|---|---|
| Rhythm: **Words first** | fixed on | everyone |
| Rhythm: Classic (`phraseRhythm`) | unreachable | `realism-lab`, `melody-stats`, `patterns-app` |
| Rhythm: Grid (`gridRhythm`) | unreachable | `realism-lab`, `melody-stats`, `patterns-app` |
| Melody: **Learned** | fixed on | everyone |
| Melody: Classic (the motif tune) | unreachable | `realism-lab`, `melody-stats` |
| Melody: Shaped (`shapedLine`) | unreachable | `realism-lab`, `melody-stats` |
| Melody: Melody first (`firstLine`, `first.ts`) | unreachable | `realism-lab` |
| Real songs, Patterns | fixed on (their "off" paths unreachable) | `realism-lab` (REAL / PAT switches) |
| Moves: manual choice (20 named moves) | unreachable; **auto** still runs | no script sets it |
| Energy: manual choice | unreachable; **auto** still runs | `energy-lab` |
| Writer: Classic (Vocal melody card) | **reachable** (uses Words + Learned) | — |

"Unreachable" means: not from the page, not from a link. The code is still there for the scripts above.

## How big

| File | Lines | Never run | About |
|---|---|---|---|
| `src/parts/melody.ts` | 2,177 | 34% | **~740 lines**: `firstLine` (~200), `shapedLine` (~140), `gridRhythm` (~95), `phraseRhythm` (~110), `planClashes`, `spoken`, `patternRhythm`, the pieces they use |
| `src/parts/vocal.ts` | 807 | 19% | **~150 lines**: `realSixteenths`, `realSixteenthsOf`, `onEighths`, `speak`, `fitHigh` |
| `src/parts/motif.ts` | 127 | 19% | ~25 lines |
| `src/parts/first.ts` | 146 | 15% | ~20 lines (`firstStyle`, `spineAt`, `firstDesc`); the rest of the file runs |
| `energy.ts`, `moves.ts`, `learned.ts`, `singers.ts`, `backing.ts`, `lyrics.ts` | | 0-3% | nothing worth removing: they run (auto Moves and Energy are code that runs; only the manual choices are unreachable, and those are a few lines of table) |

Total: roughly **950 lines of 3,400** in the vocal files, plus whatever those functions pull in alone (small helpers: finding them needs a second pass).

The docs for these writers are already marked `experiment` (`VOCAL-RHYTHM`, `VOCAL-MELODY`, `VOCAL-FIRST`, `VOCAL-MOVES`, `VOCAL-ENERGY`).

## What removing would and wouldn't change
- **Would not change**: any song the page makes. The 40-song snapshot (`npm run song-check`) would stay identical, because none of it runs for those songs.
- **Would break**: `realism-lab` (its Classic, Grid, Shaped and First rows), `melody-stats`, parts of `patterns-app`. Each would need cutting back to Words + Learned, as was done for the Guide parts in Phase 3.
- **Would lose**: the ability to flip back to the older writers while experimenting. They stay retrievable from git (`docs/ARCHIVE.md`).
- **Risk**: the older writers share helper code with the live path (`melody.ts` is one long file). Removing by function is safe only with the coverage run repeated afterwards; the snapshot catches most mistakes, not all.

## A bigger question (not dead code, but wasted work)
With Writer = Verse (the default) the page first runs the whole older vocal pass (`singTrack`), then the verse writer replaces its notes and words (`singSong`, `src/track.ts`). The older pass is still needed for the **Classic** Writer choice, and its leftovers feed a few things (energy style for the backing vocals, for one). If Paul ever drops the Classic Writer choice, the older pass could go almost entirely (several thousand lines across `melody.ts`, `vocal.ts`, `lyrics.ts` and friends) and songs would build faster. That is a design decision for Paul, not a clean-up; nothing here depends on it.

## Suggested answers for Paul
1. **Later** (recommended while he is still listening to vocals). Nothing to do; this file stays as the map.
2. **Remove the ~950 lines** that never run for any page song, keeping the scripts working on Words + Learned. One PR, snapshot must stay identical, old code stays in git.
3. **Also drop the Classic Writer choice** and the older pass behind it. Bigger win, changes the card, needs his yes on losing that choice.
