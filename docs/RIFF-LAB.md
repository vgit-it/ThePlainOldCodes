Status: experiment — the riff lab page (`riff-lab.html`, built and deployed, not linked) and the new riff writer (`src/parts/riffwriter.ts`). The app's own riffs (`riff.ts`) are unchanged; songs use it only behind the Riff writer switch (`docs/RIFF-WIRE.md`).

# Riff lab

Why: the app's riffs are random walks on the minor pentatonic (`riff.ts`, `docs/RHYTHM.md`): new every song, but all from one toolkit and with no idea of what makes a riff stick. The riff writer builds one in layers, the way a guitarist does, and the lab is where Paul hears them and keeps the good ones.

Page: `npm run dev`, then `/riff-lab.html` (built with the app, not linked). Pick a key, mode, chords, genre, tuning and tempo; **Write 12 new riffs**; tap one to hear it over drums and bass written to it; ♥ keeps it.

## The writer (`writeRiff(seed, song, chords, options)`)
4/4, eight bars: two runs of four bars, each with its own style (the way the app's riff songs have a style for each half). Pure and deterministic: the same seed, song and options give the same riff.

**Styles** (six of the app's eight; `STYLE_LABEL` in the file):
- **Single-note riff:** hits where a *feel* likes them (Driving 8ths, Syncopated, Sparse and heavy, Chugging 16ths, Bouncy), 2 to 4 pitches, a contour, a pull to the root on the beats.
- **Chugs and stabs:** a power chord on the one and one to three other spots (left to ring), palm-muted chugs on the root between them (8ths or 16ths, a few gaps, ghost notes in 16ths), the odd stab on another note.
- **Big chords:** one chord a bar, halves, quarters, 8ths, a dotted 3-3-2, a 3-3-2-ish tresillo, or a chord and a push or two.
- **Gallop:** an 8th and two 16ths on each beat (or two 16ths and an 8th), on the root or on a line that moves a note a beat; now and then a held hit instead.
- **Pedal note:** palm-muted root hits with open melody notes bouncing off them (a half-bar pattern, played twice).
- **Stabs and a lick:** stabs in the first half of the bar, a single-note lick in the second.
- Not written yet: **picked** hooks and **arp** (clean arpeggios): they pick chord shapes string by string, and stay `riff.ts`'s. A genre arrangement that has one of them isn't used by Auto.

**Layers** (all styles): the style's rhythm, a few pitches (the root most), a one-bar cell, an answer (the first half the same, the second half new notes; a gallop changes a beat at a time), a turnaround (a chord left to ring, a stop for a drum fill, a run of 16ths, a pickup), a form over four bars (AAAB, ABAB, AAAA, AABA). Where both halves have the same style they are the same riff: the second time round has a turnaround and sometimes a note changed. Where they differ, each half is its own riff.

**How it's struck:** open note, palm mute, power chord, ghost note, the odd slide in. Follows the chords (the riff moves to each chord's root; a pedal note stays on the key) or stays on the key. Register: low on the open strings, or up an octave where the 5th and b7 can sit below the root (single-note and lick).

**A pick of many:** it writes *Best of* riffs from the seed (24 by default) and keeps the one the rules like best. Each style has its own ranges: hits a bar, how many pitches, the root's share of the notes, repeated notes, off-beats; and for all: few leaps, bars that repeat (about half to most), no more than three different rhythms, starts on the one on the root, ends on the root, 5th or b7. The score on each row (0 to 10) is the average of the two halves. "Best of 1" is the raw first riff: use it to hear what the rules add. (Chug and gallop score about 10 for most: their rules are wide. Tighten them from what Paul keeps.)

## What the lab does
- Style: **Auto** is the genre's own arrangements (hard rock lick/big/pedal, metal gallop/pedal/chug, grunge single/big/chug, alt-metal chug/big...), by seed, so a dozen riffs show a mix; or one style for both halves, or two (Second half).
- The jam is a real riff-genre idea (`buildIdea`) with the key, mode, chords and tuning set (the chords one per 2 bars, or one chord). Guitar 2 is silent.
- The riff replaces the idea's guitar. The drums (`generateHeavyDrums`, reading each half's style) and the bass (`generateRiffBass`) are written to it, and the riff player (`playRiffPart`) plays it: accents, loudness, a hand that drifts. (The band's hands, squeaks and the slide and legato touches, aren't run here: those need a whole track.)
- Sound: the app's engine, guitar Distortion / Crunch / Clean, levels, and Prepare real sound (the real amps; redo it after picking another riff).
- A roll shows the riff's notes over the chords (palm mutes fainter, ghost notes fainter still).
- **Keepers:** ♥ stores the seed with the jam and the writer's settings in this browser (`localStorage`). Tap one to set it all back; **Copy the keepers** gives the lines to send on. A seed typed in the Seed box writes just that riff.

## Check
`npm run riff-lab-check`: for every style alone, paired with the next, and in each genre's own mix: the same seed gives the same riff; the style asked for is the style written; every riff has hits inside the eight bars, in both halves, whole lengths, frets 0-14 and a velocity; the drums and bass can be written to it; the best of 24 is never worse than the first; the key-following riffs of a style really differ from song to song (90%); every feel can be asked for; the genre mixes reach every style. It prints, per style, hits a bar, pitches, palm and power shares, the root's share, and the mean score of the first riff against the best of 24.

## Next (not built)
- Listen, and tune the rules and kits from the keepers.
- Picked hooks and arpeggios through the same layers (they need the chord-shape picking of `figures.ts` / `riff.ts`).
- Odd meters; real riff numbers from the Lakh MIDI study as the rules' ranges (`src/realism/`).
- The riff and the kick written together, not the kick after the riff.
- Into the app: a switch in Track options ("Riff writer: As before / New"), the writer called for each four-bar run of a section from `generateRiff` (`riff.ts`), where the style is already chosen; the styles it can't write stay with the old code. Once Paul has listened.
