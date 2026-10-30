Status: experiment — Android only, behind a switch. Paul is to try it with the screen off.

# Keep playing with the screen off

Android pauses a page's sound when the screen locks. Now (switch on) it keeps going.

## What it does
- **Switch:** "Keep playing with the screen off (Android)" under Volume. Only shown on Android. Off by default. Remembered on the phone.
- **Silent loop:** while the band plays, the page loops a near-silent 10 s file (`src/audio/silence.ts`). Android then treats the page as a music player and leaves it running.
- **Lock-screen player:** title, play and stop buttons (Media Session, `src/page/background.ts`).
- **Longer look-ahead:** while the page is hidden, notes are scheduled 1.5 s ahead instead of 0.25 s (`Engine.setBackground`), as a locked phone's timers run late.
- **Back on the page:** if the sound was put to sleep, it is woken.
- **Interruptions:** a call or another player pausing our sound stops the band.

## Not covered
- iPhone: not tried (Paul uses Android).
- Only checked in code here. Listening with the screen off is on a real phone.

## If it still cuts out
- Battery saver / "Optimise battery" on Chrome can still kill it: set Chrome to "Unrestricted".
- Try a bigger look-ahead (`LOOKAHEAD_BACKGROUND` in `engine.ts`).

Check: `npm run background-check` (the silent file and the Android test).
