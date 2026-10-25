# The Plain Old Codes

Browser app that writes and plays whole songs, and shows a pixel band playing them. A song has sections (intro, verse, chorus, bridge, solo, outro), chords, rhythm guitar, lead guitar and solos, bass, drums, and a sung demo vocal with words. Export as MIDI, audio (MP3 / WAV / stems) or a band video. Static site on GitHub Pages (deploys on push to `main`), no server. Desktop and phone.

The band is called **Plain Old Codes**. The project and repo are **The Plain Old Codes** (the repo was `MusicIdeaGen`).

## Owner
- Paul is a senior designer, not a full-time dev. Keep explanations short and non-technical unless he asks. Bullet points, concise.
- No Figma. Design straight in code: a rough working version he can try on his phone, then iterate.
- He listens on his phone and decides. New ideas go behind a switch until he has listened.

## Stack
- Vite + TypeScript, static build, relative `base` (works under any repo name).
- Tone.js (playback), `@tonejs/midi` (MIDI), `mediabunny` (video), `fflate` (zip), lamejs (MP3).
- Samples in `public/samples/` (self-hosted, credits in `README.md`). Real amps (Neural Amp Modeler) in `public/amp/`. Band art in `public/band/`; sources and tools in `art/`.
- Checks are Node scripts in `scripts/`, built with rolldown: `npm run <name>-check`.

## How a song is made
Options + seeds → `src/generator.ts` (the idea: chords, strum, drums, bass, 8 bars) → `src/track.ts` (sections, solos, lead breaks, vocal) → `src/parts/*` (each part written) → `src/players/*` (the band plays it their way: groove, hands, lead) → `src/verse/*` (the lead vocal's melody) → `src/audio/engine.ts` (playback) → `src/band/*` (band view, video) → `src/export/*`.
- `src/main.ts` is the page. Options live in the link hash (`updateLink` / `readLink`), so an old link must never crash: unknown values fall back to the default.
- `MAIN_METHOD` / `MAIN_VOCAL` / `ALWAYS` in `generator.ts` fix the writers the page uses. Menus for old writers are gone.

## Folder map (`src/`)
- `generator.ts`, `track.ts`, `idea.ts`, `tension.ts`, `genres.ts`, `sounds.ts`, `rng.ts`: the idea, the track, mood and tension, instrument choice, seeded random.
- `parts/`: writers for every part (chords, strum, riff, drums, bass, guitar 2, solos `solo*.ts`, licks, layers, vocal and words).
- `players/`: drummer, bassist, guitarists, lead, hands (string and fret), presence.
- `verse/`: the lead vocal's melody writer (forms, mood notes, sets, shapes, intervals, bass-led).
- `guide/`: old Guide-line code. Only `tune.ts`, `words.ts`, `feel.ts` and some helpers in `line.ts` are still used (by the singer).
- `realism/`: numbers measured from real songs (patterns, targets, licks) that the writers lean on.
- `audio/`: playback engine, mixer, samples, real amps, the singer (formant / FOF voices) and its workers.
- `band/`: pixel band view and video render (`band.html`).
- `ui/`: page cards (controls, roll, neck view, chord editor, locks).
- `export/`: MIDI and audio export. `theory/`, `rhythm/`: chords, scales, voicings, meters.
- `lab/`: tools. `lickLab.ts` is live (`lick-lab.html`, built, not linked). Others are old (see `docs/ARCHIVE.md` once Phase 4 lands).

## Rules
- The generator is pure and deterministic given a seed. No `Math.random` or `Date` in writers.
- Every feature gets a doc in `docs/` and a check script (`npm run …-check`).
- Before pushing: `npm run typecheck`, `npm run build`, and the check scripts that touch your files. (`npm run song-check` once Phase 0 of `docs/CLEANUP-PLAN.md` is done.)
- Write plain-English comments. Match the file's style.
- Don't read big files whole. Search first (`grep`), then read the part you need.

## Current focus
- **Solos** (Track options → Solo writer): "As before" (`solo2.ts`), "Planned (landings first)" (`soloplan.ts`), "Melody + player" (`solomelody.ts` → `soloplayer.ts`). Docs: `SOLO-NEW`, `SOLO-PLAN`, `SOLO-MELODY`, `SOLO-PLAYER`. Paul is listening to the newest steps.
- **Vocal melody** (Vocal melody card): the verse writer and its mood-note switches (`docs/VERSE-SECTIONS.md`, `VOCAL-EMOTION`, `INTERVALS`).
- **Repo clean-up**: `docs/CLEANUP-PLAN.md`, one phase at a time. Anything removed is in git tag `archive/before-cleanup` (once Phase 0 is done) and listed in `docs/ARCHIVE.md`.
- The "next" ideas and the full decision record are in `docs/HISTORY.md`. Read it only when you need the why behind something.

## Docs
Start with `docs/README.md` (an index). `docs/SPEC.md` is the v1 idea-generator spec, kept as history.
