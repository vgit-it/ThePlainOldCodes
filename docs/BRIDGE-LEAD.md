Status: built (2026-10-29), behind a switch. Paul has not heard it.

# Lead in bridges and breakdowns: a melodic line gets the solo treatment

Paul: in alt metal some breakdowns have a solo-like lead line, but without the solo's expression or the drummer's fills.

Cause: bridges and breakdowns use the older Guitar 2 writer (`parts/guitar2.ts`). Only solos, outro solos and lead breaks go through the solo writer, Solo expression and the drummer's solo pass.

Switch: Track options → **Lead in bridges and breakdowns** → On (`bridgeLead: 'on'`). Off by default; an old link plays as before. Check: `npm run bridge-lead-check`. Code: `src/track.ts` (`writeBreakSolo`), `src/sections/guitar2.ts` (`isLeadLine`), `src/players/drummer.ts` (`playUnderSolo`, `lead`).

## What it does
- **When**: a bridge or breakdown whose Guitar 2 got a melodic line in at least half of its four-bar runs (a melody or an octave melody; not fills, swells, arpeggios, funk lines, rhythm or a picked figure).
- **The line**: rewritten as a lead break is (`docs/LEAD-BREAKS.md`): the song's Solo writer, quoting the hook, low and sparse (intensity 0.3), and Solo expression when it is on. It follows the section's tension.
- **The drummer** (marked `section.leadSolo`): a fill at the end of each four-bar phrase where the guitar is not busy, and a crash with the guitar's long notes and its top note (once every two bars at most). The groove, the hats and the level stay as the band had them: no ride, no build.
- **The section before** may play pickup notes into it (the usual hand-over).
- The section card says: "Guitar 2: a lead line through the breakdown, written like a short solo".

## Not changed
- Solo sections, outro solos and lead breaks.
- Sections with a picked figure, swells, fills, funk lines or no Guitar 2.
- Songs with "no lead guitar" (Lead breaks switch): the line is dropped as before.

## For later
- Solo variation (another band feel for a stretch) for a long bridge.
- The same for the other lead parts (answers, climbs, the hook).

## Next
1. Paul listens (alt metal breakdowns first).
