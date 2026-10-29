Status: built, behind a switch (Track options → **Riff writer**: Classic / New). Default Classic. Paul is to listen.

# Riff writer in tracks

Why: the riff lab's writer (`docs/RIFF-LAB.md`, `src/parts/riffwriter.ts`) writes riffs in layers and keeps the best of many. This puts it in the songs of the four riff genres: hard rock, metal, grunge, alt-metal.

## How it works
- Switch on: `buildTrack` marks the song (`Song.newRiff`). Every riff the track builds (the idea's, a new verse riff, a new chorus) goes through `generateRiffIdea` (`generator.ts`).
- There, `writtenRiff` asks `writeRiff` for the riff: the song's own two styles (`sections[0]`, `sections[4]`), the idea's riff seed, **24 tries** (the best by the rules). About 1.4 ms a riff.
- The drums, bass and riff player run on it as they do on the classic riff (the lab already did this chain).
- Classic stays where the writer can't: a half in **picked** or **arp**, or a song not in 4/4 with 8 bars of 16 steps (6/8, 7/8, 3/4). That riff is the classic one, hit for hit.
- Switch off, a wrong value, or an old link: the track as it was.

## How much is the new writer's
Share of ideas where both halves are styles it writes (120 ideas, `npm run riff-wire-check`): metal about 87%, grunge about 73%, alt-metal about 60%, hard rock about 37% (hard rock leans on picked hooks, which the writer doesn't do yet).

## Check
`npm run riff-wire-check`: switch off is the same track; a writable riff is the writer's, the rest the classic one; the same seeds the same track; odd meters stay classic; whole tracks of every riff genre build with valid hits.

## Next (not built)
- Picked hooks and arpeggios in the writer (then hard rock is mostly new).
- One half new and one half classic in the same song.
- Tune the rules from the riffs Paul keeps in the lab.
