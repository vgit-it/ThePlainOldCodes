# Wah pedal

Status: steps 1 and 2 built (2026-10-30 and 31), behind the **Wah pedal** switch (Track options). Not heard yet: Paul to listen.

## What it is
A wah pedal in front of the guitar's amp, as on a real board, so the drive bites into it. Two kinds:

| Kind | Sound | Where |
|---|---|---|
| **Auto-wah** (`auto`) | The picking opens the filter: a hard hit quacks, a soft one barely moves it. | Rhythm guitar, funk only, about 6 songs in 10. |
| **Cocked wah** (`cocked`) | The pedal parked half way (950 Hz): a nasal, vocal tone. | Solos and lead breaks (a lead on an electric sound), by genre: hard rock 50%, funk 50%, rock 35%, grunge 30%, metal and alt metal 20%, pop 10%. |
| **Rocking wah** (`rock`) | Parked like the cocked wah, and rocked heel to toe on the long held notes, one rock a beat (a little off it each time), then back to parked. | Of the songs with a lead wah: hard rock 60%, rock 50%, funk 40%, grunge 40%, metal and alt metal 30%, pop none. A song is parked or rocking, not both. |

A song decides once (seeded): either it has the wah or not. A funk song with the auto-wah has it on every band section; a guitar-alone intro stays plain.

## How it works
- `src/audio/wah.ts`: `Wah` sits between each guitar take and its amp. Off, only the dry path exists (the guitar as before). The filter is built the first time it's needed and fades in over 40 ms, with some of the dry guitar kept in (so it keeps its body).
- Auto: the picking level (a follower) sets a band-pass filter's pitch, 350-2400 Hz, up an exponential curve (`autoWahHz`).
- `src/sections/wah.ts`: `planWah` decides it from the genre and the song's seed. Written to `section.wah`.
- The engine (`applyWah`) sets it as each section starts. Exports and the band video get it too, since it's in the audio graph. A real amp's recorded input includes the wah (it's ahead of the amp).
- Link: `wah` in the track options. An old link has none: off. Songs without the switch are unchanged (`song-check`).

## The rocking pedal
- Only a held single note rocks (6 16ths or longer, not muted), and about 3 in 4 of them; the rest stay parked, so it comes and goes with the phrases.
- A rock is a beat long, 12% off it either way (from the note's position, so the same song rocks the same way every time). It starts and ends at the heel, goes to the toe and back, and the pedal then returns to parked.
- 450 Hz (heel) to 2000 Hz (toe). Through a distorted amp the sweep is narrower, 650 to 1500 Hz: a wide sweep turns to mush there.
- It's scheduled when the note is played (`wahRock` in the engine), so export and the band video get it.

## Check
`npm run wah-check`: off changes nothing; on changes only the wah marks; auto only on funk rhythm, electric, after the guitar-alone intro; cocked and rocking only on solos and lead breaks (a song is one or the other); the rocking pedal's plan (a rock fits the note, about a beat long, same note same rock, short notes stay parked) and curve (heel to heel, smooth, in range; narrower sweep is narrower); same seed, same plan; the sweep rises with the picking and stays in range.

## Not heard yet, to listen for
- Does the funk quack sound like a wah, or too thin or too loud? (`WAH.auto` in `wah.ts`: Q, range, sensitivity, dry and wet levels.)
- Is the cocked wah too nasal on a distorted lead? (`WAH.cocked.at`.)

- Is the rocking too regular, too busy, or too wide on a clean funk lead?
- Does it rock on the right notes? (Numbers: `ROCK_SHARE`, `ROCK_MIN_LEN` and `WAH.rock` in `wah.ts`.)

## Next
- Rocking written by the solo writer, note by note (a mark on notes, heard in the lick lab too), to follow the phrase: a faster rock into the climax, the pedal held down on a ending note.
- Wah on other parts (rhythm guitar in rock intros).
