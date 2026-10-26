Status: experiment, stage 2 built (2026-10-26). Paul is to listen.

# Solo recipes: the story told in licks

Stage 2 of `docs/SOLO-STORY.md`. Every part of the story gets its own recipe. No move picked from the list; no gap filled with whatever fits.

Switch: Track options, **Solo core notes**, "Chosen bars, story told in licks (step 2c)" (`soloCores: 'recipes'`). Off by default; an old link plays as before. The cores and the story are exactly "story plan only" (`story`); the licks sit between the cores. Code: `src/parts/solorecipes.ts` (`storyParts`, `writeStory`), called from `generateSoloMelody`. Check: `npm run solo-recipes-check`. The played climax (`soloClimax`) works on top, as before.

## The recipes
- **Sung phrase** (statement A, answer A′/B, return, a build that is long):
  - lead-in: 2-4 notes, 8ths and quarters (rhythm cells, not all the same length), stepwise, one of them with a slight bend (a half step up into it);
  - then a **tag**, laid right up against the core (the silence is before the phrase):
    - **bend + pull-offs**: a note bent up, held, let down, then 2-3 notes pulled off (`art: 'legato'`);
    - **unison bend**: two strings, the lower one bent a whole tone up to the upper one (needs a whole step under the note), then 1-2 quick notes;
    - **held note + quick run**: a held note (slight bend, vibrato), then 3-4 quick 16ths, mostly down, sometimes up (some hammered).
  - the held note never rubs the chord; it stays inside the playable range (the end note is picked so it does).
- **Ramp** (the gap into the climax, 6+ 16ths, at most 16): fast 16ths climbing from the bottom of the range, ending just under the climax. Five shapes: a plain run, groups of three, groups of four, three-note pull-off cascades (each group a step higher), louder as it goes. Some are hammered (genre lean). A long gap is cut: the statement (if none yet) or a build, then the ramp.
- **Build** (the other gaps before the climax): a short rising sequence, pairs or threes, each a step higher (8ths when calm, 16ths when busy). Where the core sits too low to climb to and there is room, a short sung phrase.
- **Release / fall / close** (after the climax): one long note (bent and let down, or vibrato), then 1-3 notes pulled off into the core. A long release (20+ 16ths) first has a note falling straight from the core before.
- **Link**, and a gap too short or that nothing fits: silence ("space" on the card).

## Repeats
A gap the size of the opening (the statement) plays the opening's lead-in again: the same rhythm and shape, moved to its core. An answer changes the tag. A return keeps it. Not every one fits (range, chord), then it is a fresh phrase.

## What decides what
- Genre leans on the tags and the ramp shapes (3 leans in, 2 normal, 1 rare; every one possible in every genre): `TAG_LEAN`, `RAMP_LEAN`, `LEGATO_LEAN`.
- The mood picks among what fits, by its liking for the way in and the way out (the vocal's interval theory), as before. Mood inside the phrase is stage 4.
- Never the same tag twice in a row when another is possible.

## Card and melody view
- The card: `story (told in licks): A, A′, ramp, PEAK, release...` and one line per part: bars, name, what was played, note count, the core it leads into.
- **Melody view** (Lead guitar view of the solo): a **Story** row above the notes (each part: A, A′, build, ramp, PEAK, release, fall, close, coloured by role) and a **Played** row under it with the pieces (sung phrase, bend + pull-offs, unison bend, held + quick run, ramp ↑, build ↑, fall). With "story plan only" the Story row shows the plan.

## Numbers (238 solos)
- 1,098 parts; 94 left as space (the rest played).
- Sounding: cores about 39% of the steps, licks about 33%, the rest silent.
- 96% of notes asked to be pulled off or hammered came out as a real pull-off or hammer-on in the hands (the others picked).
- A gap the size of the opening plays it again in about 80% of cases.

## Checked (`solo-recipes-check`)
Cores and story equal to "story plan only"; licks only inside a part, never in a link; in the key; no overlap; each part ends within 2 scale steps of its core; a ramp has 6+ 16ths, climbs from the bottom; bend + pull-offs has a let-down note and 2+ pull-offs; a unison bend is a bent double-stop; a sung phrase has a tag; repeats have the opening's rhythm; every tag and ramp shape shows up; same seed, same notes; nothing set plays as off.

## Not done (later stages)
- Stage 3: variation of repeats beyond "tag changed" (moved shape, cut short), the signature lick grown into a phrase.
- Stage 4: mood inside the phrase (interval taste for every jump, bend size by mood), more recipes (slide into a held note, quick bend + hammer trio, tapping), mixed rhythm in builds.
- Fewer notes if it is too busy: the lick share and the "space" share are the dials.
- A later peak (65-80%) would give the build more room; not changed.
