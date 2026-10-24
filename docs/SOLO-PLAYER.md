# Solo player: the melody handed to a guitarist (scope, version 2)

Paul (2026-10-24): take everything built up to Melody + joins and treat it as if it were handed to a guitarist: work out how to play it well and add flourishes like a pro. Built from single **skills**, arranged in meaningful ways.

Version 2 (same day) after Paul's answers: the **core is substitution**. The player replaces a note, or a stretch of notes, with a different way of playing it, **without losing the note itself** (one long note becomes a triplet pulse on that same note and then a hold). It must be very robust, have the **personality of the player**, find **several ways** for each spot, and decide the options by **recognising the arrangement** of the input, with mood, energy and drums counted in.

Status: step 1 (the foundation, section 12) and step 2 (the reader, section 13) built 2026-10-24; no rule changes a note yet. (The skill lab is parked: not needed. Reuse the five lead players as personas. No must-have skills added.)

## 1. The idea in one picture

```
 base score (melody + gap map + joins)  +  context (chords, drums, energy, mood, tempo, meter, neck position)
        |
  1 READ      split into spans; recognise each span's situation (tags + numbers)
        |
  2 INTEND    the player decides the solo's story: where it is quiet, where it builds, what is featured
        |
  3 PROPOSE   every rewrite rule that fits a span offers itself (with its settings), "keep it plain" always among them
        |
  4 CHOOSE    score by fit + the player's taste + chance; resolve clashes; keep the budget
        |
  5 REALISE   turn the choice into timed notes and techniques; VERIFY (anchors, key, time, hands); fall back if it fails
        |
 the performed solo + a report (what was recognised, what was chosen, what was left out)
```

## 2. The core: rewrite rules (substitution)

A **rewrite rule** says: *for a span that looks like this, you may play it like that.* It is the unit that replaces "skill" and "gesture" of version 1: a skill is a rule on one note; a gesture is a rule on a larger span, built from smaller rules.

### 2.1 Spans (what gets rewritten), at four scales
| Scale | Span | Examples of what is seen |
|---|---|---|
| Note | one note with its room (tail up to the next note) | long note, short note, repeated pitch, the climax, the first, the last |
| Joint | two notes and the space between | leap up, leap down, step, same note, a picked gap |
| Cell | 2 to 5 notes in a row | a stair up, a stair down, an arch, long-short-short, a run of 8ths |
| Phrase | a call, an answer, the end, a repeated phrase | a call that hangs, an answer that lands, the phrase before the climax |
Rewrites are tried **top-down** (phrase, then cell, then note) so a big gesture is not broken by small ones. Spans nest; a chosen rewrite **claims** its time, and smaller rewrites inside it are only allowed if the rule says so.

### 2.2 The identity contract: "without losing the note"
Every note in the base has an **identity**. A rewrite must say which parts of it it keeps, and the checker enforces it. The parts:
- **Pitch**: the note's pitch is heard (the most, or the longest, or on the strongest beat) in the span.
- **Onset**: the span starts on that pitch at the note's start step (or the rewrite says it borrows a few steps from before: a pickup into it).
- **Landing**: the span ends on that pitch (so the next note is reached from it).
- **Length**: the span's total time is the note's time (or the rewrite says how much it borrows from the tail / the rest / the previous note).
Each note carries an **anchor level** by role: the climax and the home note keep all four; a plain long note keeps pitch and onset; a short passing note keeps pitch only. A rewrite may only be offered where the anchors it keeps cover the note's level.

### 2.3 A rewrite rule, as data
- **name**, **scale**, **kind** (re-articulate, decorate, approach, elaborate, connect, fill, shape).
- **matches**: situation tags it suits, with weights, and **vetoes** (where it must never go).
- **keeps**: which identity parts it keeps (above).
- **layers**: what it changes, so rules can combine: *rhythm* (re-divides the time), *pitch* (adds notes), *articulation* (picked, legato, slide, bend, vibrato, rake, mute...), *dynamics* (loudness shape).
- **needs**: room (steps), tempo (milliseconds per note), interval, string and fret limits (asked of the hands).
- **feel**: a few numbers (section 3.3) so mood, energy and the player can be matched without a table for every pair.
- **settings**: what it can vary (how many repeats, which division, which approach, which side).
- **realise(span, settings, rng) -> events**: pure and seeded.

### 2.4 Examples: what one long note can become (several ways, same note)
Base: a long note, one bar, high, mid-solo, energy rising; hats in 8ths, snare on 2 and 4.

| Way | What is played | Keeps | Suits |
|---|---|---|---|
| Stay plain | the note, vibrato | all | any; the default; always offered |
| Triplet pulse | the same note picked in triplets for a beat or two, crescendo, then held with vibrato | pitch, onset, landing, length | a shuffle or triplet groove, a building energy |
| Stutter then hold | the note 2 or 3 times on the 16ths, then held | all | high energy, a drum fill nearby |
| Gallop | 8th + 16th + 16th, repeated, then a hold | all | angry, driving, metal / hard rock |
| Tremolo | picked as fast as the hand goes for a beat, then eased out | all | tense, big climax |
| Neighbour shimmer | the note, a half or whole step above, the note... (pull-off / hammer-on) then held | all | happy, bright, a shred player |
| Pedal cell | the note, a run up and back down, the note again to hold | pitch, onset, landing | a long note over a chord change, a lot of room |
| Scoop and swell | slide in from below, swell, wide vibrato | pitch, landing | sad, dreamy, a melodic player |
| Bend and hold | pre-bend or late bend to the note, vibrato | pitch, landing | blues, a bluesy player |
| Ghosted pulse | the note with muted scratches between | pitch, onset | funk, a tight pocket |
| Echo-fall | held, then falling run at the end | pitch, onset | a call's end, a phrase before a rest |
Short note: 8th into two 16ths (note + neighbour), triplet fragment, grace in. Joint: connector run, bend, slide, octave jump, arpeggio over a leap (a sweep later). Rest zone: ghosts, a quick lick, a pickup into the next note, a stab with a drum hit. Phrase end: turnaround, falling run, tremolo + dive. The full vocabulary is in section 6.

## 3. Reading the arrangement (the recogniser)

The rewrite choice is only as good as the **reading** of the input. The recogniser is its own module, with its own check, and its output is **shown** on the melody roll before any rewriting exists (the way to check it by eye and ear).

### 3.1 What it measures per span
- **The notes**: length (steps and milliseconds at the tempo), interval in and out (size, direction), chord note or not, same pitch as the last, the climax or not, first or last.
- **Place**: phrase role (call, answer, climax, end), position in the phrase, in a repeat or the source of one, on a beat / off the beat / on the downbeat, bars from the end of the section.
- **The room**: the gap map (kind, size, picked or bare), silence before and after.
- **Neighbourhood**: how dense the notes are around (a run of shorts, long-short patterns), a stair, an arch, a leap and step back.
- **The chords**: a chord change inside the note, the next chord's notes.
- **Energy**: value, slope (rising, falling), crest, trough, how it compares with the solo's average. **Mood and tension** (the tension curve at that bar, the mood's profile).
- **Drums** (`idea.drums`: kick, snare, hats, ride, crash, toms, fills): the hits inside the span and just after it, the groove's feel (straight 8ths, 16ths, shuffle or triplet, half-time), where the snare backbeat is, a fill or crash coming, how busy the drums are (busy drums leave less room; open drums leave more), whether the span's end lands on a hit.
- **The hands**: where on the neck the player is now (the energy diagonal), which strings and frets are near.
- **The player**: what was just played, the recent budget used, the moves it has already used (for echoes and signatures).

### 3.2 Archetypes (named situations)
Predicates over the numbers, each with a strength from 0 to 1; a span can have several. Examples:
`held-peak`, `long-before-rest`, `long-over-chord-change`, `long-with-room`, `static-repeat`, `leap-up`, `leap-down`, `stair-up`, `stair-down`, `arch`, `call-hanging`, `answer-landing`, `phrase-end`, `phrase-start`, `pre-climax`, `post-climax`, `lone-short`, `dense-cluster`, `into-snare`, `into-crash`, `drum-fill-window`, `locked-to-kick`, `open-drums`, `busy-drums`, `triplet-groove`, `shuffle-groove`, `half-time`, `rising-energy`, `falling-energy`, `crest`, `trough`, `bar-before-section-end`, `repeat-source`, `repeat-copy`.

### 3.3 Feel axes (how mood, energy, drums and the player meet the rules)
Instead of a table for every pair, five numbers describe a rewrite, a mood, a player and the moment alike:
- **Agitation**: calm to frantic.
- **Roughness**: smooth to edgy (rakes, dead notes, tremolo).
- **Ornament**: plain to ornate (more notes and decoration).
- **Weight**: light to big.
- **Looseness**: locked to the grid to floating (rubato, scoops, late bends).
The moment's **wanted feel** = mood + energy + section + drums (open drums lift Ornament and Looseness, busy tight drums lower them and raise Lock) + the player's own lean. A rule's **fit** is how close its feel is to the wanted feel. A new rule needs only its feel numbers, not a hand-made table. (Mood leanings: sad / dreamy: calm, smooth, loose; angry: frantic, rough, heavy; happy: light, ornate; tense: agitated, rough, tight; triumphant: heavy, ornate.)

## 4. The player's personality

A **style sheet** (from the five lead players, with a small random twist per song so no two are identical):
- **Vocabulary**: a taste weight per rewrite (likes, neutral, rare, never). Melodic: scoops, swells, slow vibrato, late bends. Bluesy: bends, wide vibrato, double-stops, pentatonic bursts. Shredder: runs, tremolo, trills, legato, later sweeps and tapping. Raw: rakes, slides, ghosts, pulses, dead stops. Funky: ghosts, 16th cells, pickups, dead stops, double-stop slides.
- **Signatures**: 2 or 3 pet rewrites drawn per solo that come back (a callback is how a player sounds like a person).
- **Allergies**: 1 or 2 rewrites this player never plays.
- **Density**: how many rewrites per bar; **restraint**: how often "stay plain" is chosen on purpose.
- **Risk**: how often a wild, ambitious option is taken; a shredder takes more.
- **Rhythmic language**: straight, swung, triplet-leaning, gallops, 16ths.
- **Pitch language**: pentatonic and blue notes, diatonic, chromatic approaches.
- **Attitude to the drums**: locks to the kick, floats above, or answers the gaps.
- **Story arc** per solo (drawn): statement, development, climax, resolution; each stage allows a different part of the vocabulary and density, so the solo *builds* rather than being even.
- **Consistency**: a rewrite chosen in a call is repeated in its answer 85% of the time with one setting changed (the gap map and the vocal's repeat shapes do the same); signatures return.

## 5. Choosing: several ways, one performance

- For every span, collect **all** rewrites that match and pass the cheap checks. Each gets a score:
  `fit(tags) x feel fit x taste x energy / budget x novelty (not the last used, not overused) x drum fit x chance`
- "Stay plain" always has a base weight (a pro is mostly restraint).
- Pick by weighted chance (not the best one: the variety is the point). Settings are drawn too (how many repeats, which division, which side).
- **Several ways**: the report keeps the runners-up for each span, so a later "play this note another way" is possible without writing anything new.
- **Drum fit** in particular: re-articulations take the groove's own division (8ths hats: 8ths; 16ths: 16ths; shuffle: triplets), a flourish ends on a snare or crash where it can, simple holds under a drum fill, a stab with a kick in a tight pocket.
- **Budget and pacing**: a limit of rewrites a bar by energy and the player; no two heavy rewrites in a row; heavy ones need a plain note or a rest on each side; the climax and the home note get a prepared arrival, not a flurry.
- **Clash resolution**: higher scales claim first; a claim blocks overlapping ones unless the rule allows nesting; the layers (rhythm, pitch, articulation, dynamics) let compatible rules combine on one span (a triplet pulse with a crescendo with vibrato on the end).

## 6. The vocabulary (the single skills the rules are built from)

Each is a building block the rules use; a rule is a short arrangement of these.

- **Arrive**: pick, hammer-on, pull-off, slide-in, scoop, bend-in, pre-bend, grace note, rake-in, ghost-in.
- **Hold**: vibrato (narrow, wide, late), late bend, bend-release, swell, trill, tremolo, unison bend, double-stop, (pinch / natural harmonic later).
- **Leave**: let ring, cut, fall-off, slide-out, release, palm-mute tail, (whammy dive later).
- **Move** (one or two notes between others): passing note, neighbour, chromatic approach, enclosure, turn, mordent, bend-and-slide, double-stop slide.
- **Re-divide** (the new part, the time inside a note): same-note repeats in 8ths, triplets, 16ths, 32nds, gallop (8th + 2 x 16th), reverse gallop, stutter (a few repeats then a hold), pulse with crescendo, ghosted repeats.
- **Runs**: legato run, picked run, pull-off flurry, pentatonic burst, tremolo run, rake run, wide leap, (sweep, string skip, tapping later).
- **Rhythm colours**: ghost notes, triplet push, dead stop, pickup.
Almost all are played by the engine today (`GuitarHit`: `bend`, `art`, `slide`, `vib`, `lateBend`, `unbend`, `trill`, `tremolo`, `rake`, `mute`, `shift`, `swell`, `dyad`). Not yet: pinch and natural harmonics, whammy (new sounds); sweep and tapping (a hands rule).

## 7. Robustness (how it stays safe)

1. **Contract, then checker**: every rewrite declares what it keeps; an independent checker (not the rewrite's own code) verifies: anchors kept, total time, in key (except marked passing notes), no overlaps, no silence over a beat, speed possible at the tempo, a fingering found by the hands, techniques allowed together.
2. **Transactions**: a rewrite is tried on a copy and kept only if it passes; a failure goes to the next candidate, then to the plain note. The performed solo is never worse than the base.
3. **Fuzz check** (`npm run solo-player-check`): every rule against thousands of random spans (lengths, pitches, chords, tempos 60-200, meters 4/4, 3/4, 6/8, 7/8, 5/4, mixed, odd drums): any rule that says "I apply" must produce a valid result.
4. **Determinism**: same seed, same performance; every rule seeded from the span, not shared state.
5. **Old modes untouched**: the old-writer hash and the five earlier Solo writer modes stay identical; the player is its own entry (**Melody + player**).
6. **Meters and tempo**: all timing in the song's own beat groups and milliseconds at the tempo; triplets in 6/8 and 12/8 are the natural division there.
7. **Reading checks**: the recogniser has its own check (archetypes against hand-made spans with known answers; no span with no tags; strengths in range).
8. **A report** (`idea.soloCurve.moves`): for every span, the tags, the options, the pick and why; shown on the roll; used by the check.

### Known technical points to check first (a small spike, before the rules)
- Timing finer than a 16th: the engine has `shift` (a third of a step for triplets) and `tremolo`; repeated same-note events, 32nds and note lengths in fractions of a step need a check; if they do not fit, a small extension to the hit's timing is needed (a list of sub-events inside one hit).
- The hands: a rewrite sends several notes on one string / across strings; the hands' fingering must accept or refuse each chain.
- The engine's late bend rule (a late bend fails if it has no time to arrive) applies to any rewrite that bends.

## 8. Where it sits in the code

- `src/parts/soloread.ts`: the recogniser (spans, numbers, archetypes, the feel axes).
- `src/parts/soloplayer.ts`: the director (intention, proposal, choice, budget, clash, verification, report).
- `src/parts/solorules.ts` (and `solorules-*.ts` by family): the rewrite rules and the vocabulary they use.
- `src/parts/soloperson.ts`: the style sheet from the lead player.
- Hooked into `track.ts` after the joins step: Track options -> Solo writer -> **Melody + player**; also **Melody + read** (the tags drawn on the roll, nothing changed).
- Roll view: tags under each note; chosen rewrites as labels on notes and gaps; the runners-up in a hover text.
- Docs and checks: `npm run solo-read-check`, `npm run solo-player-check`.

## 9. Build order (each step heard or seen)

1. **Foundation spike**: the finer timing (sub-events), the checker (anchors and playability), the rule interface, "plain pass-through"; the fuzz harness. Nothing changes in the sound.
2. **The recogniser** + **Melody + read**: spans and archetypes shown on the roll. Paul checks the reading by eye ("is this really a held peak? a leap up? into the snare?") before any rewriting.
3. **Note rewrites for long notes** (re-divide, shapes, bends, scoops, trills) with the player's taste, the feel axes, the drum fit and the budget. Heard.
4. **Joints, rests and short notes** (connectors, pickups, ghosts, grace), which finish the fills left from step 0b.
5. **Phrase level**: intention (story arc, featured spans), signatures, echoes, turnarounds, climbs, closings.
6. **Extras**: sweeps, tapping, harmonics, whammy (each only when it sounds right).
7. **Tune by ear** with Paul's notes.

## 10. Decisions taken (change on request)
- The base is Melody + joins; the picked joins stay as the fallback and one of the candidates for a joint.
- The five lead players are the personas, each with a small twist per song.
- First version uses only what the engine already plays; new sounds later.
- The recogniser is shown before the rewriting is heard.
- "Stay plain" is always an option and often chosen.

## 11. Open
- How wild may a rewrite be on short notes? (Proposal: short notes only get pickups, graces and two-note splits; the big rewrites are on long notes and rests.)
- Should rewrites be allowed to shift a note's onset by up to a 16th for feel (push or drag)? (Proposal: yes, only for loose players, never on a beat that a drum hit lands on.)

## 12. Step 1 built: the foundation (2026-10-24)

What it is: the frame every later rule sits in. **Nothing changes in the sound yet**: the Solo writer entry `player` (code only, not in the menu) plays Melody + joins note for note, through the frame.

### Files
- `src/parts/soloevents.ts`: the performance as events (`PEvent`: a time in 16ths with fractions, a length, the hit with its techniques, the melody note it belongs to). Events sit on a grid of 1/12 of a 16th: thirds (triplets), halves (32nds) and quarters land exactly. `readBase` reads the melody into notes with their **anchor** (`all` for the climax, the end of a phrase and the last note; `main` for a note of a beat or more; `pitch` for the rest). `eventsToHits` writes events back as hits (the step, the part of a step it is late by, the length); an untouched hit comes back as the same hit.
- `src/parts/soloverify.ts`: the checker, independent of the rules. Per melody note: still there, the pitch heard most, nothing sounding outside its own time, and by anchor its start and its landing. Over the line: nothing added outside a gap, every note in the key or a note of the chord under it, in the guitar's range, no overlaps, no silence over a beat (also before the first note), a speed the hand can play (60 ms between picks, 40 ms for a hammer-on, pull-off or slide; tremolo and trills exempt), techniques that can be played together, a bend that has time to land (the engine drops one silently, leaving the lower pitch), and **a fingering from the hands' own placement** (`unplayable`).
- `src/parts/solorules.ts`: the rule interface (`weight`, `realise`, what it `keeps`), `covers` (a rule is only offered notes whose anchor it keeps), the plain rule (step 3 adds the profile and `fitOf`; the rules are in `solorules-long.ts` and listed in `solorules-live.ts`).
- `src/parts/soloplayer.ts`: `performSolo`: reads the melody, offers each note to every rule that fits, tries them in a chance order (the plain rule takes its place in the draw by weight), keeps one only if the checker finds nothing new, tries the next if it does, and in the end plays the note as it was; then the hands have the last word (a note with no place on the neck goes back). Writes the report (`idea.soloCurve.moves`: a note, the rule played, the rules offered).
- (`src/parts/solorules-spike.ts`: three rules written only to prove the frame; replaced by the real rules of step 3 and removed.)
- `scripts/solo-player-check.ts` (`npm run solo-player-check`): described below.

### Small changes elsewhere (all off unless asked for)
- `GuitarHit.exact`: played as written, not held on through a short rest into the next note (engine `held`, hands). A pulse on one note needs it.
- `SoloCurve.fine`: the hands read each hit at its real time (step + shift) and length, not at its step (`playGuitar2`, now exported; `leadHands` pulled out of `playHands`). Without it nothing changes (the old writer's hash is the same).
- The engine already played a hit late by a part of a step (`shift`), any number of hits in one step and fractional lengths; nothing was needed there.
- `track.ts`: the `player` entry writes the melody with the joins, then `performSolo`. The last note is **frozen** (played as written): `carrySolo` carries it into the next section and bends it to the next chord, and knows one hit only. Later: the carry learns about events.

### Found on the way
- A melody note may be outside the key: the chord under it can be (a chord from outside the key). The key check allows the key and the notes of the chord.
- A real bug of the joins (step 0c): a late bend in a note too short to land it was started at 1 step anyway (`Math.max(1, at)`), so the engine dropped the bend and the note stayed at the lower pitch (2 of 742 notes). Now no bend is used there (another join is).
- The carried last note ends in the next section, and its pitch is the bent pitch, which may be outside this key: the check leaves that one note alone.

### Numbers (140 songs, 100 solos and breaks, 2,684 notes)
- Pass-through: identical to Melody + joins, note for note.
- The melody passes the checker: 0 violations, 0 notes without a place on the neck.
- 12 kinds of damage are each refused (a note lost, out of the key, out of range, a silence over a beat, an overlap, notes too quick to pick, a bend with no time to land, a trill with tremolo, a note added outside every gap, the last note cut short, a long note starting late, the last note on another pitch).
- Spike rules forced on every note they fit: used 942 (triplet pulse, 2,138 hits between the 16ths), 968 (gallop) and 968 (stutter) times; every result passes the checker as read again from the hits alone, every note has a place on the neck, the same seed gives the same performance.
- Fuzz: 300 random melodies in 4/4, 3/4, 6/8, 7/8, 5/4 and 12/8 at 60 to 200 bpm, 897 performances: 0 bad.

### Next
- Step 2 (below). The neck view and the band view will read a hit at `step + shift` (the roll already does); `hitTime` is in `src/idea.ts`.

## 13. Step 2 built: the reader and Melody + read (2026-10-24)

Track options -> Solo writer -> **Melody + read (nothing changed; the reading on the roll)**. It sounds exactly as Melody + joins. Open a solo or lead break: the Melody view shows what the reader saw.

### What it reads (`src/parts/soloread.ts`, stored as `idea.soloCurve.read`)
Per **note**: tags with a strength from 0 to 1 (only 0.35 and over are kept), the **feel** the moment wants, and the numbers behind the tags. Per **joint** (the space between two notes), **cell** (2 to 5 notes) and **phrase**: tags too. Pure: the same melody, the same song, the same reading.

| Family (colour on the roll) | Tags |
|---|---|
| The note and how it moves (blue) | long-note, short-note, beat-note, held-bar, peak-note, held-peak, climax-note, long-before-rest, long-with-room, long-over-chord-change, high-register, low-register, static-repeat, leap-up, leap-down, skip-up, skip-down, step-up, step-down, before-leap |
| Its place (purple) | first-note, last-note, phrase-start, phrase-end, call-hanging, answer-landing, final-landing, pre-climax, post-climax, closing (the last two bars), on-downbeat, on-beat, off-beat |
| The chord (teal) | root-note, third-note, fifth-note, seventh-note, colour-note, common-tone-next (a note held over a chord change that the next chord has too) |
| Energy and tension (green) | rising-energy, falling-energy, crest, trough, high-energy, low-energy, high-tension, low-tension |
| The drums (orange) | on-kick, on-snare, on-crash, into-snare, into-kick, into-crash (the note ends on it or the next note starts on it), under-fill, busy-drums, open-drums (the bar against the section's average) |
| The groove (yellow) | shuffle (the song swings), half-time, sixteenths, eighths, quarters (read per bar from the hats and ride) |

- **Cells**: stair-up, stair-down, arch, valley, static-run, zigzag, leap-and-return, dense-cluster (3+ short notes), long-short-short, short-short-long, lilt, even-pulse.
- **Phrases** (from the melody's own landings): opening, call, answer, climax, final, pre-climax, repeat-copy (the rhythm of an earlier phrase again), repeat-source, rising, falling, busy, sparse, wide.
- **Joints**: step / skip / leap up or down or a repeat, touching or a rest between, and the gap map's kind, whether it was picked and how it was joined.
- **Feel** (five numbers from -1 to 1: agitation, roughness, ornament, weight, looseness): the mood's own start (angry: frantic, rough, heavy; dreamy: calm, smooth, loose...), moved by the energy, the tension, how busy the drums are and whether the note sits on a kick or a snare. The rules of step 3 are matched to this.
- **The solo**: one line (mood, bars, tempo, the energy shape, groove, drums, notes, phrases).

### On the roll
- A **Phrases** row (each phrase and its role) and a **Read** row: the two most telling tags on each note (a word where the note is wide enough, a coloured bar where it is not). Tap a note for all of its tags by family, its cells, its phrase, the space after it, its feel and its numbers; tap it again to close. The legend names the colours.

### The check (`npm run solo-read-check`)
- Spans with a known answer (36): a held top note, a leap, a stair, an arch, a valley, repeats, cells, the bar, first and last, the closing bars, a long note over a chord change with a common tone, chord function, a long note with room, a long note before a rest, on the kick, into the snare, a crash, a note under a fill, each groove, busy against open drums, rising, falling and crest energy, phrase roles, a repeated phrase, the feel by mood, and purity.
- Real solos (140 songs, 105 solos and breaks, 2,660 notes): every note has 3 or more tags, sorted, in range; exactly one place in the bar and one chord function; the phrases follow on and cover the notes; cells and joints point at real notes; the joined joints agree with the gap map; one climax note a solo and a peak in every solo; the tags that must fire do; angry reads more agitated than dreamy.
- Found on the way: a note a join bends into sounds another pitch than the one the melody landed on, so phrases and gaps are matched by step, not by pitch.

### Not yet
- The feel does not include the player's own lean (the style sheet comes with the rules). Drums are read for the section's kit lanes only (kick, snare, hats, ride, crash, toms, fills), not the drummer's feel after the band plays.

## 14. Step 3 built: the long-note rewrites (2026-10-24)

Track options -> Solo writer -> **Melody + player (long notes played like a guitarist)**. Melody + read stays as it was (nothing changed). The roll shows what was played: a pink **Played** row under the reading (the rule's name on each note played another way); tap a note for the rule and the scores of the other ways it could have gone. The legend and the stats line count them.

### The rules (`src/parts/solorules-long.ts`): 14 ways to play a long note
Each one keeps the note: it starts on the note's pitch at its time, the pitch stays the one heard most, and (marked *all*) it ends on it at the note's end. Each fills the note's time exactly.
| Kind | Rule | What is played | Keeps |
|---|---|---|---|
| Re-pick | triplet-pulse | the note struck in triplets (3 or 6), louder each time, then held | all |
| | eighth-pulse | struck in eighths (2 to 4), then held | all |
| | stutter-hold | two to four 16ths, then held | all |
| | gallop | 8th + 16th + 16th, once or twice, then held | all |
| | ghost-pulse | note, muted scratch, note, scratch (once or twice), then held | main |
| | tremolo-hold | tremolo picked for a beat or two, then held | all |
| Shape | scoop-in | slid into from below (1 to 5 semitones), with a wider vibrato on a long one | all |
| | bend-in | bent up into the note (half or whole step, from a note of the key) | all |
| | late-bend | held, then pushed up to the note (from a note of the key) | all |
| | wide-vibrato | the same note with a wide vibrato (20 to 34 cents) | all |
| Move | shimmer | note, hammer-on to the next scale note, pull-off back (once or twice), held | all |
| | trill | the whole note trilled, or a beat or two of it, then held | all |
| | tail-run | held, then two or three quick scale notes off the end (up on a call that hangs, down otherwise) | main |
| | turn-return | held, then a turn (up, the note, down) and back on the note | all |

All timing is in the song's own beat (triplets are a third of its beat group) and checked against the tempo (no pick quicker than 60 ms).

### How it chooses (`soloplayer.ts`, `solorules.ts`, `soloperson.ts`)
1. **Offered**: a rule only where it can be played (a long enough, plainly picked note; never the last note, never a note that must keep its landing for a rule that gives it up).
2. **Fit** (`fitOf`): the rule's own **profile** against what the reader saw. Likes: read tags that suit it (a shuffle for triplets, a sixteenth groove under a fill for the stutter, a held peak under a crash for the tremolo, a long note before a rest for the tail run...). Vetoes: tags where it never goes (no pulse, gallop or stutter on the final landing). Feel: how close its own five numbers are to the feel the moment wants (**mood + energy + tension + drums + the player's own lean**).
3. **The player**: a taste for every rule by lead player (melodic: scoops, wide vibrato, late bends; bluesy: bends and vibrato; shredder: shimmer, trill, tremolo, runs; raw: gallop, stutter, ghosts; funky: ghosts and stutters), each with a twist per band and **one allergy** (a move this person never plays); **two or three pet moves per solo** that come back (drawn by taste, weighted 2.5 times); a **density** (how likely a long note is decorated) with restraint, lifted by the energy and by notes that want an ending.
4. **The budget**: two heavy rewrites never side by side, at most one or two a bar (by energy), the same rule not again and again, a note after a rewritten note less likely.
5. **A repeated phrase** is played as its source was (85%): the same move or the same restraint.
6. **Several ways**: the draw is by weight; a try that fails the checker (or the hands) gives way to the next, and in the end the note is played as it was. The report keeps the scores of the five best.

### Numbers (60 songs, 40 solos and breaks, 1,053 notes)
- Every rule forced on every note it fits: valid as read again from the hits alone, fingerable, the same seed the same performance; fuzz 100 random melodies in 6 meters at 60-200 bpm: 0 bad.
- As it plays: 39% of long notes rewritten, 0.38 a bar, never more than 2 in a bar; the mix of rules follows the player and the moment (angry: stutter, tremolo and gallop; dreamy: late bend, wide vibrato, scoop).
- `npm run solo-rules-check`: 40,684 rewrites over a grid of lengths, pitches, tempos, meters and modes (the note's time filled exactly, its pitch, the key), what each rule is offered, what the reading steers (angry against dreamy, shuffle against straight, a fill, the final landing), and the five players.

### Not yet
- Not listened to. The weights (restraint 0.55, the likes and feels) are first guesses; Paul's ears tune them (step 7).
- Short notes, joints and rests (step 4); story arc, echoes and turnarounds (step 5); sweeps, tapping, harmonics, whammy (step 6).
- The player's feel and the drums reach the choice only through the reading and the profile; a flourish does not yet end on a snare or a crash on purpose.

## 15. Plan: step 3b, long notes become figures (2026-10-24, not built)

Paul's note after hearing the plan for step 4: **long notes should mostly turn into expressions**, not stay held. A long note is held as it is only to slow things down or to push that note's mood. Otherwise it becomes a short **figure** (a lick of 3 or more notes: hammer-ons, pull-offs, picked notes, 1/16ths, 1/8ths, triplets) that **keeps coming back to the held note**, so the note's mood goes on. The figures use the **intervals that carry the mood** (the vocal's work, `docs/INTERVALS.md`), go up and down, stay in the key as much as they can, and some of them **start on the note and build toward the next note**.

This is built before step 4 (section 16), because step 4 (short notes, joints, rests) needs the same machine.

### 15.1 The big picture
```
long note ──read──> INTENTION ──compose──> FIGURE ──check──> played (or the next try, or held)
 (mood, energy,      stay / return /        (time place + rhythm + path of
  drums, next note,   bridge / flurry        notes + hammer/pull/pick + loudness)
  chords, player)
```
Three new parts, in this order of importance:
1. **The intention** (what the note is for): one per long note.
2. **The figure composer** (how a figure is made): one engine, used for every intention.
3. **The hold policy** (how rare "held as is" is): a dial, by mood, energy and place.

The 14 rules of step 3 stay, in new jobs: the pulses, tremolo and ghosts are **flurry** figures; the scoop, bend, late bend and vibrato **decorate the held part** of any figure (the held note at the start or the landing) and are the whole of a **stay**.

### 15.2 The intentions
| Intention | What the note does | Ends on | Where it fits (the reading) |
|---|---|---|---|
| **Stay** | held, with vibrato, a scoop, a bend or a late bend; slowed, not busy | the note | the climax and held peak, the final landing, a closing bar, sad or dreamy moods, low energy, a note that must be heard (a hanging call before a rest); a note with no room |
| **Return** | the note, then a figure around it, then back on the note (the note's mood keeps going) | the note | the default for a long note: held-bar, long-with-room, long-before-rest, answer-landing, a long note over a chord change |
| **Bridge** | the note, then a figure that **builds toward the next note** (a stair, a run, an approach from a step or a leap away) and hands over to it | a note next to the next note's pitch | rising or falling energy, a pre-climax note, a note before a leap, a call that hangs (leaves it open) |
| **Flurry** | the note struck again and again (the step 3 pulses, gallop, tremolo, stutter) then held | the note | tense, angry, drums busy, a fill, a crash coming |
- **Hold share** (how many long notes are stay): by default about **25%**. The dial moves it: dreamy, melancholic, low energy and quiet sections up to about 45%; angry, happy, high energy and busy drums down to about 12%. The climax and the final landing are held (stay or a prepared return) **most** of the time, but not always (a held peak can also be a return with a long first hold). Rewriting of a note into a figure never goes against what the reader says the note must do.
- **Proportions of the rest**: return about half, bridge about a quarter, flurry the rest (all moved by the same dials and by the player's taste).
- The notes that must **keep the landing** (the climax, the end of a phrase, the last note) are only offered stay, return and flurry, never bridge.
- **Identity**: the note's pitch is on its start (at least an 8th, or a quarter of the note, before the figure leaves), is the pitch **heard most**, and is at least **a third** of the note's time (a new check). A return ends on it. A bridge does not (it hands over), so it is for notes that need to keep only their start.

### 15.3 The figure composer (`src/parts/solofigure.ts`, new)
One engine in five layers; each layer has more than one way, so the same note can be played many ways.

1. **Place in time.** The note is cut into **head** (the struck note, held), **motion** (the figure) and **tail** (the landing, held). Patterns: head+motion+tail (the common one), motion at the start then a long landing (the note "falls into" itself), two motions with a hold between (a bar-long note: figure, hold, figure, hold), motion to the very end (bridge). Lengths follow the note's time, the beat and the groove; the head is at least a beat for a sad moment and short for an agitated one.
2. **Rhythm.** The motion is laid out in **cells** from the grid the song allows: 8ths, 16ths, triplets (a third of the beat, always in a shuffle or 6/8), 32nds only when the tempo allows. A cell set per groove (eighths: 8th pairs, dotted pairs, 16th groups; shuffle: triplets; sixteenths: 16th cells and syncopes; half-time: 8ths), by speed (no pick quicker than 60 ms, legato 40 ms), with the real lick rhythms of `reallicks.ts` as one source. Strong notes of the cell land on the beat or on a drum hit where it can; the last note before the landing is on a beat or the "and".
3. **Contour** (the shape the figure draws): a small set of templates: *neighbour* (up and back, or down and back), *turn* (above, note, below, note), *arch*, *dip*, *stair up*, *stair down*, *wave* (up, down, up), *leap and fill*, *arpeggio* (chord notes), *pedal* (the note again and again with another note between), *enclosure* (above and below, then the note), *real shape* (a shape of the lick library, `LIB_SHAPES`, moved to start on the note). Bridges use *stair* / *run* / *approach* toward the next note.
4. **Pitch path** (the interval theory comes in here). The notes are picked by a **beam search** over the scale notes near the note (about a 4th below to a 6th above, inside the register the neck plan wants), each next note scored by:
   - the **mood's own interval cost** (`profileFor` and `intervalCost` of `src/verse/intervals.ts`: how much the mood likes the interval, its size, its direction, a leap stepped back from), at the bar's **tension**;
   - the contour template (how near the path is to the shape wanted), and ending on the note (return) or on the approach to the next note (bridge);
   - **in the key** always; chord notes on the strong beats; when a chord changes inside the note, the figure after the change leans to the new chord's notes;
   - a **colour note** (the mood's own degree), a **blue or chromatic passing note** only for the players who use them (bluesy, funky; at most one a figure, on a weak beat, stepped away from; marked `out` for the checker);
   - the player's taste for intervals (a shredder likes runs in 2nds and 3rds, a raw player 4ths and 5ths and octaves, a melodic player 3rds and 6ths, a bluesy player minor 3rds and 4ths, a funky player 2nds with an octave pop);
   - not the same as the last figure, and not a copy of a real lick (the lick library's guard).
   Many candidates are made (rhythm x contour x a few random starts), scored, and **one is drawn by weight** from the best; the runners-up are kept in the report.
5. **How it is played** (articulation and loudness): each step of the path is marked **pick**, **hammer-on**, **pull-off**, **slide** or **bend** (small steps up on one string: hammer; small steps down: pull; a 3rd or 4th at speed: legato if the hands can reach, else picked); the first note of a figure and any leap are picked; the tail keeps the decoration of step 3 (vibrato, late bend). Loudness follows the contour (crescendo up a stair, a lift on the beat, softer pull-offs). A loose player may push or drag the figure a hair (never on a drum hit).

### 15.4 Mood in the figures (what the interval work gives)
The mood's profile (size, up share, gap fill, liked intervals) is used as it is, and shows in the figure's character:
- sad / melancholic / dark: small steps, falling, 2nds and minor 3rds, a sigh (♭6 to 5); few notes, 8ths; the head is long.
- happy / triumphant: 3rds, 4ths, 5ths, 6ths, rising; arpeggios and stairs; brighter and quicker.
- angry: repeats, 4ths and 5ths, the octave; tight 16ths; return on the note again and again.
- tense: half steps, tritones, repeated notes; short rough figures that do not resolve (a bridge that stops a step short).
- dreamy / nostalgic: 2nds and 6ths, wide and slow, triplets, long landings.
Energy sets how many notes and how fast (the figure's density), tension makes the intervals rougher and bigger (as in the vocal), the drums set the rhythm cells and where it lands.

### 15.5 The player's style (personality)
Each of the five players gets its own **figure vocabulary** (which contours, cells and articulations, the taste weights of step 3 carried over), a **density** and a **risk**. As before: an allergy, two or three pet moves a solo (now pet figures, which come back, changed), the player's lean in feel.
- melodic: neighbour, turn, arch, 3rds and 6ths, 8th cells, slow hammer-pull, scoops into the head.
- bluesy: pentatonic shapes, a minor 3rd hammer, bends inside figures, enclosures, triplets, a blue note.
- shredder: runs and stairs, 3-notes-a-string, 16th and triplet cells, long legato, tremolo as flurry.
- raw: 4ths, 5ths and octaves, slides, repeated notes, power-note leaps, gallops as flurry.
- funky: 16th cells with ghost notes, chromatic approaches, octave pops, short and tight.

### 15.6 Coherence (so it sounds like a player, not a random generator)
- **Motif memory**: the first figures of a solo are kept as motifs (a rhythm and a contour). Later figures reuse a motif's rhythm or contour, moved to the new note (a copy of a phrase is played with the same figure moved to its note, as in step 3).
- A call's figure is answered in the answer (the same idea, a changed ending).
- Never the same figure twice in a row; a figure seen already is changed.
- A chord change inside a note: the figure's landing is on a note of the new chord.
- A bar-long note may take two figures with a hold between.

### 15.7 Safety (nothing new is trusted)
- All the old checks (nothing lost, in the key or a chord note or a marked passing note, no overlaps, speed, bends that land, no silence over a beat, fingering) apply to every figure, and a figure that fails goes to the next candidate, then to a simpler figure (a neighbour turn), then to the held note.
- **New checks**: the note is a third of the note's time; the note is on the start; a return ends on it; a bridge ends within a scale step or a leap of the next note and never over it; at most one out-of-key note a figure (and only where the player allows); the figure's total fits its slot; hammers and pulls are on notes the hands can reach on one string (the check asks the hands).
- A new `npm run solo-figure-check`: the composer on thousands of made-up spans (every meter, tempo 60 to 200, mood) and on real solos.

### 15.8 What the roll shows
The **Played** row names the intention and the figure: `return ↑2 ↓3 ↑1`, `bridge ↑2 ↑2 ↑1`, `stay`, with the notes drawn on the roll as now. Tap a note: the intention, the contour, the rhythm cell, the candidates' scores (the other ways it could have gone), the mood's interval fit.

### 15.9 Sub-steps (each one heard)
1. **Composer core**: place in time, rhythm cells, contour templates, the pitch search with the mood's interval cost, articulation, the checks; the **return** intention only, on long notes, in place of the step 3 rules (those stay available as flurry and stay decoration). Hold share dial in. *Listen.*
2. **Bridge** (builds toward the next note), chord changes inside the note, approach notes, the colour and passing notes by player. *Listen.*
3. **Intention chooser** with the full reading (hold share by mood, energy, place; peak and landing rules; drums), the step 3 rules recast as stay decoration and flurry. *Listen.*
4. **Motifs and copies**, two figures in a bar-long note, the player's figure vocabulary and pet figures, push and drag for loose players. *Listen.*
5. Tune by ear with Paul's notes.
The step 3 menu entry stays as it is while this is built (Melody + player), and the figure version replaces its long-note choice when step 1 is in.

### 15.10 Open questions (my picks first)
1. **Hold share**: about 25% by default, 12% to 45% by mood and energy? (a held peak is still a held peak, mostly)
2. **Notes outside the key**: only a blue or chromatic passing note, one at most a figure, only for the bluesy and funky players, never on a strong beat. Everything else in the key. OK?
3. **A bridge hands over to the next note** (it need not end on the held note), except for the climax, the end of a phrase and the last note. OK?
4. **Step 3's 14 rules**: keep them inside the new system (flurry and stay decoration) rather than as a separate choice. OK?
5. **Order**: build the figures (this section) first, step 4 after. OK?

## 16. Step 4 (saved): short notes, joints, rests, on the same composer (2026-10-24, not built)
Kept from the plan told on 2026-10-24, rebuilt on the figure composer, so it comes after section 15.
- **Short notes** (a beat or less), light touches: a grace into it (a 2-note figure), a split into two (the note and a scale neighbour), a triplet fragment, a quick slide in, a ghost scratch before, and for loose players (melodic, bluesy) a **push or drag** (a hair early or late, never on a drum hit). The shredder may go a little wilder (triplet bursts).
- **Joints** (between two notes): a scale run, an approach from a step or a leap away, an enclosure, a slide between, an octave jump, an arpeggio over a leap. These are **bridge figures** between two notes of the melody; the step 0c join (a bend or notes in between) stays as one option and the fallback.
- **Rests and tails** (the gaps): ghost fills, a quick lick, a pickup into the next note, a stab with a kick or snare (funky and raw only). Rests stay rare; never over a beat of silence. A pickup borrows time from the quiet before the note or the previous note's tail, never the next note's start.
- Spans that touch two notes **claim** the stretch of time, larger first (joint, then note), and the budget counts them (no piling up in a busy bar).
- Built in three parts, each heard: 4a short notes, 4b joints, 4c rests and pickups.
- A small checker change: a note may start up to a 16th off its time only where the rule says so (push and drag).
