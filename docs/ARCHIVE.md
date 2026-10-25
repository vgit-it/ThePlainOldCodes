Status: live — what was taken out of the repo during the clean-up, and how to get it back.

# Archive: what was removed and how to bring it back

Nothing is lost. Before the clean-up the repo was marked at this point in git:
- **Tag:** `archive/before-cleanup` (see below if it isn't on GitHub yet).
- **Commit:** `ea84fd7` (main, 2026-10-25, after Phase 1 merged; all code is exactly as it was before the clean-up). This commit stays in the history of `main`, so it is always reachable.

To see or restore a removed file (use the tag, or the commit if the tag is missing):

```bash
git show archive/before-cleanup:<old path>          # print it
git checkout archive/before-cleanup -- <old path>   # put it back in the working tree
git show ea84fd7:<old path>                         # the same, by commit
```

On GitHub: open the repo, switch to the tag (or paste the commit id), and browse the old path.

**Tag note (2026-10-25):** the tag `archive/before-cleanup` is made in the clone but pushing tags was refused from the coding session (the git proxy hangs up). To put it on GitHub: Releases → Draft a new release → "Choose a tag" → type `archive/before-cleanup` → target `ea84fd7` → Publish release. Until then use the commit above.

## Removed items

One row per thing taken out, added by the phase that removes it.

| What | Why removed | Old path | Phase | Get it back |
|---|---|---|---|---|
| Classic solo writer `generateSolo` (the first solo writer, with its lick tables and cells) | Unused since 2026-10-17; solo2, the planned writer and the melody writer replaced it. `playSolo` and `Ev` stay in `src/parts/solo.ts` (all writers use them) | `src/parts/solo.ts` (the part before `playSolo`) | 2 | `git show archive/before-cleanup:src/parts/solo.ts` |
| Solo writer menu entries "Melody only", "Melody + gap marks", "Melody + joins", "Melody + read" | Paul keeps three: As before, Planned (landings first), Melody + player. The steps still run inside Melody + player and in the checks (`soloCheck`) | `index.html` `#t-soloplan`, `src/track.ts` (`soloPlan` values `melody` `marks` `joins` `player`) | 2 | `git show archive/before-cleanup:index.html` |
