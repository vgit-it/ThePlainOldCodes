# Wah pedal

Status: step 1 built (2026-10-30), behind the **Wah pedal** switch (Track options). Not heard yet: Paul to listen.

## What it is
A wah pedal in front of the guitar's amp, as on a real board, so the drive bites into it. Two kinds:

| Kind | Sound | Where |
|---|---|---|
| **Auto-wah** (`auto`) | The picking opens the filter: a hard hit quacks, a soft one barely moves it. | Rhythm guitar, funk only, about 6 songs in 10. |
| **Cocked wah** (`cocked`) | The pedal parked half way (950 Hz): a nasal, vocal tone. | Solos and lead breaks (a lead on an electric sound), by genre: hard rock 50%, funk 50%, rock 35%, grunge 30%, metal and alt metal 20%, pop 10%. |

A song decides once (seeded): either it has the wah or not. A funk song with the auto-wah has it on every band section; a guitar-alone intro stays plain.

## How it works
- `src/audio/wah.ts`: `Wah` sits between each guitar take and its amp. Off, only the dry path exists (the guitar as before). The filter is built the first time it's needed and fades in over 40 ms, with some of the dry guitar kept in (so it keeps its body).
- Auto: the picking level (a follower) sets a band-pass filter's pitch, 350-2400 Hz, up an exponential curve (`autoWahHz`).
- `src/sections/wah.ts`: `planWah` decides it from the genre and the song's seed. Written to `section.wah`.
- The engine (`applyWah`) sets it as each section starts. Exports and the band video get it too, since it's in the audio graph. A real amp's recorded input includes the wah (it's ahead of the amp).
- Link: `wah` in the track options. An old link has none: off. Songs without the switch are unchanged (`song-check`).

## Check
`npm run wah-check`: off changes nothing; on changes only the wah marks; auto only on funk rhythm, electric, after the guitar-alone intro; cocked only on solos and lead breaks; same seed, same plan; the sweep rises with the picking and stays in range.

## Not heard yet, to listen for
- Does the funk quack sound like a wah, or too thin or too loud? (`WAH.auto` in `wah.ts`: Q, range, sensitivity, dry and wet levels.)
- Is the cocked wah too nasal on a distorted lead? (`WAH.cocked.at`.)

## Next (step 2)
- A rocking pedal: the sweep follows the tempo, written phrase by phrase in solos (a mark on notes, heard in the lick lab too), with drift so it isn't mechanical.
- Narrower sweeps in high gain; level matching.
- Wah on other parts (rhythm guitar in rock intros).
