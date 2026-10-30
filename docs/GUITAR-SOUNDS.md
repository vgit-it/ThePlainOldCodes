# Lead guitar: the new sounds

Status: built (2026-10-27). Heard in the labs (the lick lab's "Try a sound", the recipe lab's note marks), and in solos behind the "Lead guitar sounds" switch (`SOLO-SOUNDS.md`).

## What's there
Five sounds the docs listed as "no sound yet" (`LEAD.md`, `SOLO-CORE.md`, `SOLO-PLAYER.md`):

| Sound | What you hear | Mark on a note |
|---|---|---|
| Pinch harmonic | The picked note, a bit softer, with a squeal an octave and a 5th above. The squeal is bent and shaken along with the note, with wider vibrato. | `harm: 'pinch'` (library `ph`) |
| Natural harmonic | A clear chime at the written note that rings a long time. No vibrato, but the whammy bar can still move it. | `harm: 'natural'` (`nh`) |
| Whammy dive | The pitch drops over the last 0.8 s of the note: slowly at first, then fast. | `dive: N` semitones (`dvN`) |
| Feedback | After the note has spoken, a tone above it swells in and takes over while the note fades. | `feedback: N` semitones up, 12 or 19 (`fbN`) |
| Pick scrape | The pick dragged down the strings: a rough, growly rasp that falls in pitch and ends as the note is picked. The engine starts it ahead of the note (`SOLO-SOUNDS.md`). | `scrape: N` 16ths before the note, up to 16 (`scN`) |

They work together. A pinch with a dive is the metal classic.

## How they're made
No downloads. They're made in code, like the finger squeaks (`src/audio/guitarfx.ts`), and go into the guitar's amp like any note, so the drive makes them squeal and roar:
- **Chime**: almost a pure tone, a soft tick at the start, a long ring. Used for natural harmonics and the pinch's squeal.
- **Drone**: a steady tone with a slow wobble in level. Used for feedback.
- **Scrape**: a knock for each string winding the pick passes, each one a bit harder or softer and early or late (that roughness is the growl), with a little hiss on top, slowing from about 650 to 170 knocks a second. The first version was mostly high hiss, and Paul found it weak (2026-10-27). The slowest knocks go in softer, and the fall stops at 170 a second: lower than that, a driven amp turned them into a roar 9 dB over the note, and turning the level down didn't help (the amp is flat out).
- **Pitch of dives and scrapes** (2026-10-30, Paul: too high sounds weird, low sounds nice). Real dive bombs fall from the middle of the neck into a low flutter, and a scrape rasps the wound (low) strings, so:
  - A big dive (a fourth or more) starts on a note no higher than C5 (`DIVE_TOP`), or E4 when pinched (`DIVE_TOP_PINCH`: the squeal sits 19 above). A two-octave dive lands no lower than the low E (`DIVE_FLOOR`). Small dips (a half or whole step) can be anywhere.
  - The scrape is never sped up to fit its time (that made a quick tempo zing at 1.5-2 kHz). A short scrape plays only the end of the sound, the low growl; a long one is slowed (`scrapeFit` in `guitarfx.ts`).
- The pitch moves (bends, vibrato, the dive) come from the sample player (`src/audio/multisampler.ts`, `dive`). The guitar plays the sounds in `Guitar.strumTake` (`src/audio/instruments.ts`).

## Levels (measured, an A4 held 2.5 s)
- Natural harmonic: about the plain note's level, then rings on longer.
- Pinch: about 2 dB above the plain note.
- Scrape: through a driven amp, at the note's level, growing to 1-3 dB over it at the bottom of a two-beat scrape; on a clean amp, about 2 dB over.
- Feedback: on a clean amp it holds the note's level. Through crunch or distortion it swells to about 5 dB above the note by the end of a long hold. The amp is already flat out, so a lower setting barely changes that. Real feedback swells the same way.
- The levels are the `FX` numbers in `instruments.ts`.

## Where to hear them
- **Lick lab** (phone too): Sound card, **Try a sound**: pinch on the longest note, natural harmonics (every note a chime, bends removed), a dive at the end, pinch and a dive, feedback on the last note, a two-beat pick scrape into the first note.
- **Recipe lab** (PC): a note's Harmonic, Whammy dive, Feedback and Pick scrape menus. Saved in the lick's text as `ph`, `nh`, `dvN`, `fbN`, `scN`. The tab shows them as `PH`, `<12>`, `dvN`, `fb`, `sc`.

## Check
`npm run guitar-sounds-check` covers:
- The made sounds: the right pitch, the chime dies away, the drone holds, the scrape falls.
- The library's new marks read back the same.
- "Try a sound" puts each sound where it says.
- A placed note carries the sounds to the guitar.
- No live lick uses them (so the songs are unchanged).

## Not yet
- Writers other than the solo pass (`SOLO-SOUNDS.md`) using them.
- Palm mute on the lead. The guitar can already play a palm-muted note; nothing writes one for the lead yet.
- Tapping (plays as hammer-ons and pull-offs), sweeps, quarter-tone curls.
