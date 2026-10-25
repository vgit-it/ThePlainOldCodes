# Clean-up plan (2026-10-25)

A step-by-step plan to tidy the repo now that the app's goal has changed: from an 8-bar **idea generator** to a **full-song generator with an animated band** playing the song. It is written for a coding agent (e.g. Claude Sonnet) to carry out one phase at a time. Paul (the owner) is a designer, not a full-time developer: keep reports to him short, in plain words, as bullet points.

**To start a phase**, tell the agent: "Read `docs/CLEANUP-PLAN.md` and do Phase N. Follow the ground rules. Stop and ask me where the plan says ask."

## Goals

1. **One clear goal** in the code, the docs and the page: a song generator plus a band view.
2. **Less to read**: a short CLAUDE.md, a docs index, no dead code or dead pages. Every session reads CLAUDE.md (35 KB today, roughly 9k tokens), and every search walks through the dead code, so trimming both saves tokens and avoids mistakes.
3. **Nothing lost**: everything removed stays in git under a tag, listed in `docs/ARCHIVE.md`.
4. **No change in sound**: every song the app makes today should come out note for note the same after each phase, except for the menu options Paul chose to drop.

## Paul's decisions (do not change)

- **Solos**: keep only these three options in Track options → Solo writer:
  - `off`: "As before" (`src/parts/solo2.ts`, the default)
  - `on`: "Planned (landings first)" (`src/parts/soloplan.ts`)
  - `perform`: "Melody + player" (`src/parts/solomelody.ts` in `'joins'` mode, then `playSolo(..., true)` → `src/parts/soloplayer.ts` and its rules)
  - Remove these menu options: `melody` (Melody only), `marks` (Melody + gap marks), `joins` (Melody + joins), `player` (Melody + read). Code that `perform` still runs through stays (e.g. the `'joins'` mode of `generateSoloMelody`, `soloread.ts` if `perform` uses it).
- **Vocals**: the Vocal melody card stays as it is (Writer New / New · bass-led / Classic, the mood-note switches, the sliders). No behaviour change to vocals in this plan. Phase 6 only *lists* dead vocal code for Paul to decide on later.
- Paul is still experimenting with solos and the vocal melody, so keep those files and their check scripts unless a step below names them.

## Ground rules for the agent

- **One phase = one PR**, merged before starting the next. Small commits inside each.
- **No behaviour change.** After every phase run the song snapshot (Phase 0). If it differs, stop and find out why; never refresh the reference to make it pass. Only Phase 2 may change output, and only for songs that used a removed solo option (those aren't in the snapshot).
- **Prove it's dead before removing it.** Use the reachability script (Phase 0, step 3) and `grep`. Code used by scripts that are kept counts as used.
- **Archive, don't agonise.** Anything removed is still in git at the tag. Record it in `docs/ARCHIVE.md` (what, why, the path it had).
- **Before every push**: `npm run typecheck`, `npm run build`, `npm run song-check`, plus any check script that touches the files you changed. CI (the GitHub Pages deploy) only runs `npm run build` on `main`, so a broken build breaks the live site.
- **Shared links and saved settings**: the page saves options into the link (`#...` hash, `src/main.ts` `updateLink` / `readLink`). An old link may still say `soloPlan: 'melody'` and so on. Removed values must fall back to `'off'`, never crash.
- Keep code style as it is: plain-English comments, the same naming and idioms.
- Names (decided by Paul, 2026-10-25): the project and repo are **The Plain Old Codes** (GitHub repo `ThePlainOldCodes`, already renamed from `MusicIdeaGen`); the band is **Plain Old Codes** (no "the"). The build uses a relative `base`, so the rename doesn't break the site, but its address changes (check the Pages link). Don't rename anything else.

---

## Phase 0: safety net (1 PR) — DONE 2026-10-25 (the tag could not be pushed from the coding session; see `docs/ARCHIVE.md`)

1. **Tag the current state** and push the tag:
   `git tag archive/before-cleanup origin/main && git push origin archive/before-cleanup`
   (From the coding session the tag push is refused by the git proxy. The tag then has to be made on GitHub by Paul: Releases → new release → new tag `archive/before-cleanup` on commit `ea84fd7`. Until it exists, ARCHIVE.md points to that commit.)
   (Existing tags: `voices-v1-klatt`, `voices-v2-voicebox`.)
2. **Song snapshot**: `scripts/song-check.ts`, wired up in `package.json` the same way as the other checks (`rolldown ... && node ...`).
   - Make songs exactly as the page does: `generate({ ...opts, ...MAIN_METHOD }, seeds)` (`src/generator.ts`, see `src/main.ts` line ~33), then `buildTrack(idea, opts)` (`src/track.ts`).
   - Cover: every genre in `src/genres.ts`, several fixed seeds each (~40 songs in total), every meter at least once, `soloPlan` in `off` / `on` / `perform`, and `vocalWriter` in `verse` / `bass` / `classic`. Force a solo section on (`solo: 'on'` in the track options) so solos are always there to compare.
   - For each song store a short hash per part (chords, strum, drums, bass, guitar 2 / lead, solo sections, `sung` vocal lines, backing vocals, words), plus the section list. Use a stable JSON stringify (sorted keys, numbers rounded to 4 decimals) → sha1, the first 12 characters.
   - `npm run song-check -- --write` writes `scripts/song-reference.json`; without the flag it compares and prints the songs and parts that differ, and exits 1 if any do.
   - Run it twice in a row: the results must be identical (deterministic). If they aren't, find the hidden randomness (`Math.random`, `Date`) and seed it in the script, not in the app.
3. **Reachability script**: `scripts/reach.mjs` (plain Node, no build). Given entry files, it walks the `import`, `export ... from`, `import()` and `new URL('...', import.meta.url)` paths and lists every file under `src/` it never reaches. Entries: `src/main.ts`, `src/band/main.ts`, `src/lab/lickLab.ts`. Run it with and without `scripts/*.ts` as extra entries. A first run (2026-10-25) found nothing in `src/` unused by the app except `src/guide/anchor.ts`, `real.ts`, `dynamics.ts`, `src/realism/measure.ts` and the lab pages: most dead code is *branches inside used files*, not whole files.
4. **`docs/ARCHIVE.md`**: a table (what · why removed · old path · how to get it back: `git show archive/before-cleanup:<path>`). Fill it in as each later phase removes something.
5. PR: "Clean-up phase 0: snapshot and safety net".

## Phase 1: the goal and CLAUDE.md (1 PR, the biggest token win) — DONE 2026-10-25 (done before Phase 0; no `song-check` yet, no code changed)

1. **`docs/HISTORY.md`**: move the whole "Later milestones" log from CLAUDE.md here **word for word** (it's the decision record; don't summarise it away). Put a two-line note at the top: what it is, newest last.
2. **Rewrite `CLAUDE.md`**: aim for under 6 KB. Sections:
   - *What it is*: a browser app that writes and plays whole songs (sections, chords, rhythm guitar, lead guitar and solos, bass, drums, a sung demo vocal with words) and shows a pixel band playing them; MIDI / audio / video export; static site on GitHub Pages; desktop and phone.
   - *Owner*: keep the existing lines about Paul (short, non-technical, bullet points; design in code, no Figma).
   - *Stack*: Vite + TypeScript, Tone.js, @tonejs/midi, mediabunny; samples in `public/samples/`; real amps in `public/amp/`; band art in `public/band/` and `art/`.
   - *How a song is made*: one flow, with file names: options + seeds → `generator.ts` (the idea) → `track.ts` (sections) → `src/parts/*` (each part written) → `src/players/*` (the band plays it their way) → `src/verse/*` (the lead vocal) → `src/audio/engine.ts` (playback) → `src/band/*` (band view / video) → `src/export/*`.
   - *Folder map*: one line per folder in `src/`.
   - *Rules*: the generator is pure and deterministic given a seed; new ideas go behind a switch until Paul has listened; every feature gets a doc in `docs/` and a check script; run `npm run song-check` before pushing.
   - *Current focus*: solos (the three writers above) and the vocal melody (the Vocal melody card). Next ideas: link to the "next" items in HISTORY.md.
   - *Docs*: "start with `docs/README.md`". Don't list every doc here.
3. **`docs/README.md`**: an index: one line per doc, grouped (App & spec · Song form · Rhythm guitar · Lead & solos · Vocal · Voice & sound · Band view · Research studies · Archive).
4. **`README.md`**: rewrite the top for the new goal (a song generator with a band), update the project layout list, keep "Run it". Keep the credits/licences section if there is one.
5. **Page title**: `index.html` `<title>` and the visible heading → "The Plain Old Codes" (Paul's answer). `package.json` `name` follows (`the-plain-old-codes`).
6. **`docs/SPEC.md`**: add a short note at the top that the v1 idea-generator spec is history and the current goal is in CLAUDE.md. Don't rewrite it.
7. Check: `npm run build`, `npm run song-check` (nothing in code changed, so it must pass).

## Phase 2: solo writer menu down to three (1 PR) — DONE 2026-10-25

As built: the menu has three entries; `soloPlan` is `'on' | 'off' | 'perform'`; old values in links play as `off` (done once in `buildTrack`, which also hands the cleaned options back to the page). The classic writer is gone from `src/parts/solo.ts`. **Kept on purpose:** the melody writer's `plain` / `marks` / `joins` modes and the player's no-rules pass, because `solo-gaps-check`, `solo-player-check`, `solo-melody-check` and `solo-read-check` need them. They are reached through a check-only `soloCheck` option that the page never sets (so those four scripts stay and now say `soloCheck`). The roll's gap marks and reading stay, since Melody + player shows them too. `song-check` unchanged.

1. `index.html` `#t-soloplan`: keep only `off` "As before", `on` "Planned (landings first)", `perform` "Melody + player (long notes become licks that come back to the note)".
2. `src/track.ts`: `TrackOptions.soloPlan` type → `'on' | 'off' | 'perform'`. Simplify the two solo branches (~lines 1670–1695, solo sections and lead breaks): `perform` → `generateSoloMelody(..., 'joins')` then `playSolo(sol, ..., true)`; `on` → the planned writer; otherwise solo2. Drop `MELODY_PLANS`.
3. `src/main.ts` (~line 583): the cast to the new type. Wherever track options are read back (shared link `readLink`, the defaults, the `<select>` value), map any old value that isn't `on` or `perform` to `'off'`.
4. Inside the solo files, remove what only the dropped options used, proven with grep:
   - `generateSoloMelody`'s `'plain'` and `'marks'` modes, if nothing kept calls them (check `perform`, the planned writer and the kept scripts).
   - The read-only path of `playSolo` / `soloplayer.ts` (`perform === false`), if only `player` used it.
   - `generateSolo` in `src/parts/solo.ts` (the classic writer, unused since 2026-10-17); keep `playSolo` and `Ev`, which solo2 and soloplan import.
   - The roll's solo layers that only made sense for the dropped modes (gap marks, the "Melody + read" reading), if any: look in `src/ui/leadnotes.ts`, `src/ui/roll.ts` and `src/ui/neck.ts`.
5. Scripts: `solo-melody-check` (uses `'melody'`) and `solo-read-check` (uses `'player'`). Point them at `perform` if what they check still matters there; if not, archive them. Keep `solo-figure-check`, `solo-plan-check`, `solo-player-check`, `solo-gaps-check`, `solo-rules-check` and `solo-tags-check` working.
6. Docs: in `docs/SOLO-MELODY.md` and `docs/SOLO-PLAYER.md`, a one-line note at the top that only "Melody + player" is in the menu now (the other steps live on inside it). Record what was removed in ARCHIVE.md.
7. Check: `npm run song-check` must pass unchanged (only `off` / `on` / `perform` are in it), plus the solo check scripts and the build. Ask Paul to try one song with each of the three options on his phone.

## Phase 3: the old Guide line (1 PR)

The Guide card left the page on 2026-10-17. Its writers are dead; some of its helpers are used by the singer.

1. Remove `src/guide/anchor.ts`, `src/guide/real.ts`, `src/guide/dynamics.ts`, and `writeGuide` plus anything only it uses in `src/guide/line.ts`.
2. **Keep** what the app imports: from `line.ts` (`DOWN`, `GuideIdeas` and the constants `tune.ts` needs: `GUIDE_SCALES`, `HEIGHT`, `LEAD_INS`, `LEAD_IN_P`, `TIRED`, `noteName`, the types), plus `tune.ts`, `words.ts` and `feel.ts` (used by `src/parts/leadvocal.ts`, `src/audio/singer.ts`, `leadVoice.ts`, `singPool.ts`, `singWorker.ts`, `src/verse/sing.ts`, `src/export/midi.ts`, `src/idea.ts`). Run the reachability script after.
3. Optional, same PR if small: move what's kept into a name that fits (e.g. `src/vocal/` or `src/verse/shared/`). Only if the snapshot stays identical and imports stay simple; otherwise skip.
4. Scripts: archive `guide-check` and `scripts/guide-reference.json` (they test the removed writers). Check every other `scripts/*.ts` still builds (build each with rolldown as its npm script does; running them all isn't needed).
5. Docs: move `GUIDE.md`, `GUIDE-ANCHOR.md`, `GUIDE-FEEL.md` and `GUIDE-TUNE.md` to `docs/archive/` (keep `GUIDE-TUNE.md` in `docs/` if the Classic vocal writer is explained there; read it first). Update the links in other docs and in `docs/README.md`.
6. Check: snapshot, build, typecheck.

## Phase 4: pages, prototypes and loose files (1 PR)

Archive (delete from the tree, list in ARCHIVE.md):

| What | Why |
|---|---|
| `spike/` | the first prototype; the app replaced it long ago |
| `experiments/kokoro-singer/`, `experiments/midi-vocal-player/` | tried and dropped (Paul: the old voices are better) |
| `verse-lab.html` + `src/lab/verseLab.ts` | not built or linked |
| `voice-lab.html` + `src/lab/voiceLab.ts` | not built or linked |
| `voice-creator.html` + `src/lab/voiceCreator.ts` | not built or linked |
| `src/lab/quiz.ts`, `scaleCheck.ts`, `measure.ts`, `src/realism/measure.ts` | only if the reachability script (with the kept scripts) shows nothing uses them |
| `trk.png` | unused screenshot at the root |
| `.claude/launch.json` "solo-test" entry | points at a Windows folder |

- **Keep**: `lick-lab.html` (built and deployed, Paul uses it for solos), `src/lab/lickLab.ts`, `src/lab/words.ts` (scripts use it), `band.html`, `art/`.
- Paul said (2026-10-25): archive the three lab pages, and keep them easy to trace. The tag plus `docs/ARCHIVE.md` is enough: give each a row with its exact old path and the command `git show archive/before-cleanup:<path>`.
- `package.json` scripts: remove those whose script file was archived. Then go through the "lab" scripts (`fof-lab`, `timbre-lab`, `ess-lab`, `flow-lab`, `level-lab`, `voice-lab`, `energy-lab`, `melody-lab`, `asr-render`, `spec-png`, `formant-check`, `stop-check`, `track-check`...): if one no longer builds, or only tests something removed, archive it. Don't fix them.
- `.gitignore`: keep `voice-lab/` (local data, 259 MB, never committed).
- Check: build, snapshot.

## Phase 5: docs tidy (1 PR)

1. Move docs that describe removed or replaced things to `docs/archive/` (keep their names). Candidates, read each before moving:
   - Guide docs (Phase 3).
   - `LEAD-LINES`, `LEAD-FIGURES`, `LEAD-ROOM`, `LEAD-BREAKS`, `LEAD-LICKS`: the switches are always on now, so these describe current behaviour. **Keep** them, but add one line at the top: "always on since 2026-10-17, no switch".
   - Vocal writers no longer reachable (`VOCAL-RHYTHM`, `VOCAL-MELODY`, `VOCAL-FIRST`, `VOCAL-MOVES`, `VOCAL-ENERGY`): **keep for now** (Phase 6 decides).
   - `SOLO-NEW` (the "As before" writer), `SOLO-PLAN`, `SOLO-MELODY`, `SOLO-PLAYER`: keep.
   - Research studies (`STUDY-*`): keep; they're the evidence behind the writers.
2. Every doc gets a first line in the same form: `Status: live | always on | experiment | archived — <one line on what it is>`. That way an agent can skim the first lines instead of whole files.
3. `docs/README.md` matches the result.
4. No code changes.

## Phase 6: vocal dead code: list only, then ask Paul (no removal without a yes)

The page fixes the classic vocal writer's settings (`MAIN_VOCAL` in `src/generator.ts`: rhythm `words`, melody `learned`, `vocalReal` and `vocalPatterns` on). So these look unreachable from the page: the vocal rhythm writers `classic` and `grid`, the melody writers `classic` (motif), `shaped` and `first`, the Moves and Energy menus' manual choices, and maybe much of `src/parts/melody.ts` (2,178 lines), `first.ts`, `moves.ts`, `energy.ts` and `vocal.ts`.

1. Prove it: for each option, grep how it's reached from `MAIN_VOCAL` and the Vocal melody card. Also check `src/lab/lickLab.ts` and the kept scripts.
2. Write `docs/VOCAL-DEADCODE.md`: what's unreachable, its size in lines, and what removing it would and wouldn't change.
3. Stop and ask Paul. He's experimenting with vocals now, so the answer may be "later".

## Phase 7 (optional, later): smaller files

Big files cost the most tokens whenever they have to be read: `src/parts/melody.ts` (2,178 lines), `src/track.ts` (1,922), `src/verse/verse.ts` (1,305), `src/audio/engine.ts` (1,166), `src/parts/soloplan.ts` (1,177), `src/guide/line.ts` (1,218 before Phase 3), `src/main.ts` (771).

- Split only along lines that are already there (e.g. `track.ts`: options and defaults / the song arc / solos and lead / vocals / carry-overs; `main.ts`: the track card, links and sharing, playback buttons).
- Pure moves: no logic edits in the same PR. Snapshot must be identical.
- One file per PR. Stop after `track.ts` and `main.ts` unless Paul wants more.

## Phase 8 (optional): branches

- There are about 20 remote branches and local ones (`solo-new`, `solo-real`, `solo-study`, `claude/solo-energy`...). List them with their last commit date and whether they're merged into `main`.
- Delete only merged ones, and only after Paul says yes. Unmerged work: tag it `archive/<branch>` first, then delete.

---

## Done when

- CLAUDE.md is under 6 KB and describes the song generator + band; the history is in `docs/HISTORY.md`.
- The Solo writer menu has three options; old links still open.
- No dead pages, prototypes or Guide writers in the tree; everything removed is listed in `docs/ARCHIVE.md` and in the `archive/before-cleanup` tag.
- `npm run build`, `npm run typecheck` and `npm run song-check` pass; the songs are note for note the same as before Phase 0.
- Paul has played a few songs on his phone after Phases 2 and 3 and heard nothing change (besides the menu).

## Reporting to Paul after each phase

Three to five bullets: what was removed or moved, anything that changed for him (menus, page names), what to try on his phone, and any question he needs to answer.
