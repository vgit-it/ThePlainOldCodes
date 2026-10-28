Status: built (2026-10-28), behind a switch. Step 2 of the Solo expression plan. Waiting for Paul's listen.

# Solo bends: the bend dials

Paul: a bend is not one thing. A snap, a lean, a slow crawl that sings. Before, every bend in the app moved at one speed.

Switch: Track options → **Solo bends** → Dials (`soloBends: 'dials'`). Needs Solo writer: Tune first and Solo expression: On. Default: plain. An old link plays as before. Check: `npm run solo-bend-check`.

## The dials (per bent note)
- **Speed** (`bendRise`, ms): from a snap (about 35 ms) to a crawl (up to 900 ms).
- **Shape** (`bendEase`): even, quick-then-creeping (0.7, 0.8), or slow-then-quick (1.25 to 1.8).
- **Timing** (`bendAt`, steps into the note): when a late bend or a let-down happens. Climax and last note wait longer; others go earlier.
- The engine reads them (`audio/multisampler.ts`). No dial set: the engine's old fixed bend, note for note.

## Who sets them (by place and neighbours, not mood)
- The climax and the last note: lean to the slow crawl (they sing).
- A goal note (call, answer): sometimes slow.
- A quick note right after: always a snap, no time for more.
- Little room left in the note: a snap.
- The dial is drawn from the note's own place in the time (own seed): the tune, the windows and the bends themselves are as they were.
- The last note of a solo that carries into the next section (`carrySolo`): the push or let-down takes 0.3 to 0.6 s, bigger steps slower, arriving on the bar line.

## Kept safe
- A bend never takes longer than what is left of the note. A let-down never starts before its bend up has finished.
- The engine shortens a dialled bend to fit instead of dropping it.
- Same seed, same notes. Plain is identical to before.

## Numbers (60 songs, 77 solos)
- 241 bent notes: about half snaps, a third mid, the rest crawls; climax and last note bend about 3x slower than the rest.

## Next
1. Paul listens.
2. Recast: pedal, legato and library licks as run parts; slide-ins.
3. Expression as a motif; fold into Mood: all the way.
4. Maybe: whole-step bends with a held-then-vibrato finish, bends in the runs.
