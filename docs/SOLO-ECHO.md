Status: built (2026-10-28), behind a switch. Paul has not heard it.

# Solo echo: an answer plays its call's figure again, one signature per solo

Paul: the solo's expression should be a motif, not a scatter. Step 4 of the plan in `SOLO-EXPRESSION.md`.

Switch: Track options → **Solo echo** → On (`soloEcho: 'on'`). Needs Solo writer: Tune first and Solo expression: On. Off by default; an old link plays as before. Works with Solo recast and Solo bends: Dials. Check: `npm run solo-echo-check`. Code: `src/parts/soloecho.ts` (the plan) and `echo` in `src/parts/soloexpress.ts` (plays it).

## How it works
- A post-pass, like the dials and the recast: it runs after the plan is chosen, before the recast. The tune and every window it does not touch stay as they were, so On vs Off is a fair A/B on the same solo.
- The melody step already marks every phrase's goal note (call, answer, climax, end), so nothing had to be handed over: the pass reads the roles it has.
- A window only takes another window's *parts* (the cuts, hold or run, speed, shape, legato). It is laid on the window's own time, scaled to fit (a run stays on its grid), and played again with the source's seed. The pitches follow the answer's own notes, so the figure comes back at the answer's pitches: often another way up or down, not always.
- The checker and the hands have the last word. A copy they send back goes to the window it was before.
- The card says: "echo: 3 answer windows play their call again, the signature figure comes back 2 times" (counted after the checker).

## Answers
- A call (or the climax) and the answer right after it. Each pair echoes with a chance drawn per solo (55% to 100%: some solos repeat themselves, some don't).
- Counted back from the goal note: the window before the goal takes the call's window before its goal, and so on, up to four. A call window that was left plain is not echoed.
- The goal note itself takes the same kind of dress as the call's (a bend into it, a late bend, a let-down, or vibrato), if it is long enough for it.
- Changed: a copied window takes a seed of its own 3 times in 10, so the answer says the same thing and now and then ends it differently.

## One signature figure
- A run of 4+ notes from the first half of the solo (the ones with a character count more: a pedal figure or a sequence, an arch, hammered and pulled).
- It comes back, laid on the window nearest the goal note of the climax phrase and of the last phrase. The same kind, the same speed, new pitches.

## Numbers (60 songs, 74 solos)
- 26 solos have answers that echo (64 windows); 50 have a signature (84 windows).
- Copies run at their source's speed in every case. The same way up or down in about 4 of 10 (the rest are the figure turned round: that is the "changed").
- 90% of notes as the plan had them; outside the echo windows 1 note in 4656 differs (the hands read in order, so one window the checker sent back may now pass).
- With the recast and the dials on too: playable, goal notes kept.

## Not yet
- Only calls and answers that were marked by the melody step. A melody step that echoes its rhythm more (its `ECHO_RHYTHM` is 55% when the two phrases are as long) would give the echo more to hold on to: only if listening says so.
- The signature does not come back in other sections' solos of the song (each solo has its own).
- Next: fold it all into Mood: all the way.
