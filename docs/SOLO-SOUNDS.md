# Solos: lead guitar sounds

Status: built (2026-10-27), behind a switch. Track options → **Lead guitar sounds** (`soloSounds: 'on'`). Off by default; an old link plays as before. Paul listened to the sounds in the lick lab first (`GUITAR-SOUNDS.md`).

## What it does
It's a pass over the finished solo, after any solo writer ("As before", "Planned", "Melody + player"). It marks notes where a guitarist would reach for each sound, and changes nothing else: the same notes, the same times, the same band. Lead breaks get the same treatment, but softer and with no scrape.

Round 2 (2026-10-27, Paul asked for more of them, tied to what's played): each sound has several moments it can land on, each a roll of its own, instead of one spot a solo.

| Sound | Where | At most |
|---|---|---|
| Pinch harmonic | The highest held note (the climax). Also a note a jump up lands on (a 4th or more), a note a fast run lands on, a long bend, a downbeat in the loudest part of the solo. Each one after the first is less likely, and they're half a bar apart. | 3 |
| Whammy dive | The last note (more likely when the band drops after the solo, or the song ends). Straight after a pinch on the same note (the metal classic; likelier in metal, alt metal and hard rock). A note at the end of a phrase (a beat of rest after it). A small dip, a half or whole step, at the end of a long note (rock, grunge, hard rock, alt metal). Metal, alt metal and hard rock dive an octave, sometimes two; the others a 4th, a 5th or an octave. | 3 |
| Feedback | The last note when it's held long enough to swell (1.2 s or more; likelier when the song ends on it), and maybe the longest note on the way (3/4 of a bar and 2 s or more). Taken over by the octave, or now and then the octave and a 5th. | 2 |
| Natural harmonic | Calm held notes (where the solo is still quiet, or its first 60%), unbent, that an open string gives as a harmonic: an open string up an octave, an octave and a 5th, two octaves, or two octaves and a major 3rd (the 4th and 9th fret). A chord tone first. Now and then a second. | 2 |
| Pick scrape | Into the first note of a full solo (likelier when the band built up into it): a beat, or two beats on a downbeat. And now and then into a new phrase after half a bar's rest in the second half: a beat. | 2 |

A "held" note is a quarter or longer, one string or a double-stop, not trilled, not tremolo-picked, not a ghost.

## How likely
- **Genre lean** (`SOUND_LEAN` in `src/parts/solosounds.ts`): 3 leans in, 2 normal, 1 rare. Pinch, natural harmonic, dive and scrape are the weights decided in `SOLO-CORE.md`. Feedback was added here, with grunge leaning in.
  | | rock | pop | funk | hard rock | metal | grunge | alt metal |
  |---|---|---|---|---|---|---|---|
  | pinch | 2 | 1 | 1 | 3 | 3 | 2 | 3 |
  | natural | 1 | 2 | 1 | 1 | 2 | 2 | 2 |
  | dive | 1 | 1 | 1 | 2 | 3 | 2 | 2 |
  | feedback | 2 | 1 | 1 | 2 | 2 | 3 | 2 |
  | scrape | 1 | 1 | 1 | 2 | 3 | 2 | 2 |
- A lean of 1 is a 15% chance, 2 is 40%, 3 is 70%.
- **The player** changes those chances:
  - The shredder: ×1.25 for pinches and dives.
  - The melodic player: ×1.3 for natural harmonics, ×0.8 for pinches and dives.
  - The bluesy and raw players: ×1.2 for feedback (the raw player also ×1.2 for the scrape).
  - The funky player: ×0.6 for everything.
- **How hard the solo goes**: from half the chance for a quiet solo up to the full chance for the song's climax solo (pinch, dive, scrape, feedback). A lead break counts as fairly quiet.
- **The section's energy** (1 to 5): each step above 3 makes a pinch, dive or scrape 15% likelier and a chime 10% less likely; each step below, the other way round.
- **The amp** (the section's Guitar 2 sound as on Auto; a sound picked by hand on the page isn't known here):
  - Crunch or distortion: as above, chimes ×0.8.
  - Clean: no pinch, feedback or scrape; chimes ×1.6, dives ×0.5.
  - Acoustic: chimes only (×1.3). A piano lead: none.
- **The tempo**: under 90 bpm, chimes and feedback ×1.25, pinches ×0.9. From 140 bpm, chimes and feedback ×0.85, pinches ×1.15. Feedback also needs the note long in seconds, so slow songs get more of it anyway.
- Each moment has its own share of the chance: a pinch on a jump or a run ×0.6, on a bend ×0.5, on a loud downbeat ×0.35; a dive after a pinch ×0.6 (heavy genres) or ×0.25; a phrase-end dive ×0.4, a dip ×0.5; feedback on a long note ×0.5; a second chime ×0.5; a scrape into a phrase ×0.5.
- A key change for the last chorus moves an outro solo up afterwards: chimes are chosen on the notes they'll sound at.
- It uses its own seed (`…-sounds`), so turning it on changes no other choice in the song.

Measured over 60 songs a genre (`npm run solo-sounds-check`), the share of solos with each sound, and how many sounds a solo on average:

| | pinch | natural | dive | feedback | scrape | a solo |
|---|---|---|---|---|---|---|
| rock | 62% (was 29%) | 12% (7%) | 15% (4%) | 15% (22%) | 15% (16%) | 1.6 |
| pop | 5% | 31% (25%) | 4% (11%) | 0% (3%) | 4% (9%) | 0.5 |
| funk | 0% (9%) | 9% (11%) | 3% (11%) | 0% (3%) | 0% (11%) | 0.1 |
| hard rock | 99% (64%) | 14% (7%) | 64% (22%) | 26% (19%) | 43% (28%) | 3.8 |
| metal | 100% (64%) | 19% (24%) | 75% (36%) | 17% (20%) | 80% (61%) | 4.8 |
| grunge | 71% (46%) | 19% (24%) | 33% (13%) | 57% (48%) | 54% (38%) | 2.9 |
| alt metal | 99% (66%) | 18% (24%) | 61% (24%) | 30% (22%) | 52% (39%) | 3.7 |

Pop and funk went down: their leads are mostly on a clean amp, which now rules out pinches, feedback and scrapes.

The section's card says which sounds were used ("Lead sounds: pinch harmonic, whammy dive").

## A planned solo's last note
A planned solo's last note carries on into the next section and bends to its first chord (`carrySolo`, `SOLO-PLAN.md`). That comes after this pass and stays: the bar moves a chime with it, and feedback takes over at the bent-to note.

## The scrape starts early
Notes are scheduled 0.25 s ahead, but a scrape has to start up to a bar before its note. The engine now looks ahead up to a bar, in this section and the next, and starts any scrape that begins on the current step (`Guitar.scrape`). The scrape then ends exactly as its note is picked. Before this, a scrape started late and ran over its note, in the lick lab too. Checked live: a solo's scrape started in the section before it and ended on the solo's first note.

## Check
`npm run solo-sounds-check` (N=60 songs a genre, every solo writer):
- With the switch on, the song is the same apart from the marks, and only solos and lead breaks get any.
- Each mark sits where it should, within the limits above; no pinch, feedback or scrape on a clean or acoustic guitar.
- Metal pinches and dives more than pop, and every sound turns up.
- The same seed gives the same marks.

## Not yet
- Tune the chances by ear.
- Palm mute on the lead, tapping.
- A scrape into a lead line outside the solo.
