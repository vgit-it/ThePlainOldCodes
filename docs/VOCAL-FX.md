# Vocal effects

A card of effects you switch on and off over the vocal, heard live, in exports and in the band video.

## What it is
- Code: `src/audio/vocalfx.ts` (the chain), `src/ui/vocalfx.ts` (the card), in `index.html` as `#vocalfx`.
- The chain sits between the singer and its mixer strip (`Mixer.input('vocal')` is the chain's input). Reverb and echo sends, the fader, mute and stems all come after it.
- Lead only, or the backing singer too (the "Backing too" tick).
- State: `VocalFxState` in `EngineSettings.vocalFx`, so offline renders copy it. In the link as `x` (only when something is on).

## The effects (signal order)
- Speaker: telephone, old radio, megaphone. The voice through a band-limited speaker with a little drive; Amount mixes it in (equal power).
- Grit: distortion, high end tamed.
- Swirl: chorus, flanger, phaser.
- Thicken: two late, drifting copies either side (a doubler).
- Echo (send): slapback, echo on the beat (dotted 8th), ping-pong.
- Reverb (send): plate, hall, room (generated impulse responses; a hall goes dark as it fades).

## Rules
- An effect that is off is not in the path. Its nodes are disposed (nothing runs for it: `docs/PERFORMANCE.md`).
- A change to which effects are in the path dips the sound for about 15 ms live (no click). Amount and echo-tempo changes are smooth ramps.
- This is separate from the baked effect in `polish.ts` (a telephone, megaphone or radio on some first verses by genre): that stays as it was.

## Next
- Hard-tune (Auto-Tune sound): written into the line when it is sung (no glides or vibrato, notes snapped), so lines re-render.
- Vocoder (the voice shaping a synth of the chords) and harmonizer.
- Per-section effects (a telephone verse, a hall chorus).
