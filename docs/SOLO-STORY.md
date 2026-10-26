# Solo story: every gap has a part (brief, stages 1 and 2 built)

Replaces `SOLO-MOVES-FILL.md` (the "fill the gaps" brief). Read `docs/SOLO-CORE.md` first (the cores), `docs/SOLO-THEORY.md` (the arc, phrasing) and `docs/STUDY-SOLO.md` (the real licks).

## What Paul hears
- The moves between the cores feel random. No story: each gap is a weighted dice roll, with nothing linking one gap to the next but "not the same move twice" and the signature lick.
- Slow 8th-note stepwise runs (stale, even, every note the same length) and fast runs full of 5ths, whatever the mood. Measured (160 solos): wave, arch, stairs and leap-fill are 58-93% 8ths; zigzag is always a 4th to a 7th; pedal and arpeggio lean on 5ths. Mood only picks which move and the jump into and out of it, never the jumps inside.
- What he wants: the strong notes (cores) are the landings. Build feel up to each landing. Study the gaps first. Where gaps match, a phrase repeats. Real phrases: a held note with a small bend, then a quick tag (a quick bend then a few pulled-off notes, a unison bend), not a pedal each time. A run climbing from the bottom (heavy in metal). Not every gap filled: held notes and planned silence.

## The system: study, story, phrases
1. **Study the gaps** (stage 1, built): length in beats, the jump from the core before (scale steps), the energy, where it sits against the climax. Gaps of about the same size are marked (a phrase can come back in them).
2. **Give each gap a part** (stage 1, built), in `src/parts/solostory.ts` (`planStory`):
   - `statement`: the first gap of 8 16ths or more before the climax. Sparse, singing, with space. Named A.
   - `answer`: the first later gap (6+ 16ths, before 60% of the way to the climax). The statement again, changed (A′ if it is the statement's size, else B).
   - `build`: the other gaps before the climax. Shorter, busier phrases.
   - `ramp`: the gap into the climax core, when it has 6+ 16ths. Fast notes climbing from the bottom. (Shorter: a build.)
   - `release`: the gaps after the climax. Falling, long notes, space. Named release, then fall, then close (the one into the last core).
   - `return`: the last long gap (8+ 16ths) after the climax, when there is more than one gap there. The opening phrase, back.
   - `link`: a gap shorter than a beat. No phrase.
3. **A phrase has three parts** (stages 2-4): a voice (1-3 held or 8th/quarter notes with a small bend, slide or vibrato, about half the gap), a tag (the quick move on its end: bend then pull-offs, quick bend then a hammer/pull-off trio, a unison bend, a legato run down the box, a slide into a held note), then a breath (up to a beat) and the landing. The ramp is its own recipe, built backwards from the core: low start, climbing in repeated 3-4 note groups, getting louder, ending next to the core.
4. **Content from real music.** The turns in `STUDY-SOLO.md` (`5 4 b3 4`, `2 b3 2 1`, `4 3 2 1`, ...) are mostly steps and thirds, not 5ths. Each recipe says: room needed, which parts it fits, genre lean, technique tags.
5. **Repeats from the gap study.** Same-size gaps reuse the phrase: the tag exact, or moved to land on the new core, or cut short. Aim: about half the phrases come back (`SOLO-THEORY.md`). The signature lick grows from a 2-4 note cell into a whole phrase.
6. **Mood works inside the phrase**: every jump in a phrase is scored by the mood's interval taste. Mood also sets the bend size (half-step curls for melancholic, whole-step for triumphant, wide for angry).
7. **Rhythm**: mixed cells (quarter, 8th pair, 16th burst), never all the same length. 8ths only as a deliberate slow moment.

## Stages (each behind the switch, Paul listens after each)
1. **Gap study + story on the card, no new notes.** Built. Option "Chosen bars, story plan only (step 2b)" (`soloCores: 'story'`): cores only (plus the climax if its switch is on), and the card says the story: `story (planned, no licks yet): A, ramp, PEAK, release, fall, close` and one line per gap. Check: `npm run solo-story-check`.
2. **Recipes.** Built (2026-10-26): `docs/SOLO-RECIPES.md`. Option "Chosen bars, story told in licks (step 2c)" (`soloCores: 'recipes'`): sung phrase + bend and pull-offs / unison bend / quick run, the ramp from the bottom, builds, falls; the long gap into the climax is cut into statement + ramp; the melody view marks the story. Check: `npm run solo-recipes-check`. (Pull-offs and hammers go through the hands: 96% come out real.)
3. Repeats and variations from gap similarity.
4. Mood inside phrases, the rest of the recipes, rhythm cells.

The old "with moves between" stays as it is until the story replaces it.

## Found while building stage 1
- The card only showed the first line of a solo writer's notes, so the per-gap lines of "with moves between" (and now the story) never reached the page. Fixed in `track.ts`: the extra lines show under the solo's line.
- The climax is often early (bar 3-4 of 8, bar 4 of 16), so the story is mostly "release, fall, fall...". The climax comes from step 1 (the energy crest); not changed here. Worth a look: a later peak (65-80% of the way, `SOLO-THEORY.md`) would give the build more room.
- A long first gap that leads straight into the climax (no gap before it) should hold two parts, the statement and then the ramp. Split in stage 2 (`storyParts`).

## Keep these true
- The cores equal step 1's. Switch off = old songs unchanged; `npm run song-check` says "all 40 songs match". Never refresh `scripts/song-reference.json`.
- Deterministic. The plan draws no dice (it is a function of the cores).
- Old links must not crash: an unknown `soloCores` value is "off".

## Before pushing
- `npm run typecheck`, `npm run build`, `npm run song-check`, `solo-story-check`, `solo-recipes-check`, `solo-core-check`, `solo-moves-check`, `solo-melody-check`, `solo-player-check`, `solo-breath-check`.
