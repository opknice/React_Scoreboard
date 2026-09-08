# Performance changes and verification

## Build measurements

Run `npm run build`, then `npm run bundle:report` (human-readable) or
`node scripts/check-bundle-size.mjs --json` (machine-readable).
Run `npm run bundle:check` to enforce the checked-in budgets and lazy boundaries.
The Pages build runs this check before uploading its artifact.

Measured locally on 2026-09-08. Values are decimal kB. Each group includes the
entry and all static dependencies, deduplicated within that group. Quick Setup
includes the authenticated controller. These are build sizes, not measured
network timings or CPU improvements. Gzip totals include JS and CSS, summed per
file. Fonts, external assets, and unopened dynamic features are excluded.

| Group | JS before | JS after | CSS before | CSS after | gzip before | gzip after |
|---|---:|---:|---:|---:|---:|---:|
| Entry | 246.55 | 248.10 | 39.48 | 39.48 | 87.01 | 87.37 |
| Controller | 722.34 | 727.10 | 41.81 | 41.81 | 217.66 | 219.07 |
| Replay screen | 272.03 | 254.10 | 51.87 | 40.44 | 98.44 | 90.01 |
| Controller + Quick Setup | 773.37 | 766.52 | 49.07 | 49.07 | 232.46 | 230.02 |

Entry/controller grew slightly to accommodate scoped state protection and
subscriptions. Replay screen no longer loads control code/CSS, and Quick Setup
loads the crop editor on demand. Budgets allow approximately 10% headroom,
rounded up to whole kB. Review changes to budgets alongside their route reports;
do not increase them solely to make CI pass.

## State and refresh boundaries

- `captureActiveContext()` captures the mounted hook, user and league generation.
  Capture before an async operation and check before committing dependent UI.
  A -> B -> A invalidates the original capture. Successful server writes still
  return their results and invalidate the originating data.
- Local writes and the shared realtime channel publish typed league data events.
  Teams and matches refresh separately after a 200 ms debounce. Player/stat
  consumers subscribe by table, league and team. Missing DELETE IDs conservatively
  refresh consumers of the affected table. Legacy events without a table retain
  broad refresh behavior. Local deletions also invalidate related rows affected
  by CASCADE / SET NULL, without depending on delivery of separate realtime events.
- Replay time lives in `replayClock`; only `ReplayTimeline` subscribes. Metadata,
  commands and playlist handoff remain in the controller. Playback IDs reject old
  clip status and auto-trim runs once for the first duration message.
- Folder connection, file list and actions have separate contexts. The main
  controller uses the connection hook; its file count subscribes independently.
  Rescan actions are stable and ignore results after disconnect. Unchanged file
  metadata preserves the list reference.
- Local fonts load when a font panel opens. Concurrent requests share a promise;
  successful results are cached for the page session. Explicit refresh retries
  permission failures or updates the list. Selected font names remain selectable.

## Regression coverage and remaining manual checks

Final validation: build, lint, bundle budgets, and all 264 tests in 56 files passed.

Tests cover delayed mutations across league/user changes and unmount, targeted
request counts, roster invalidation, folder consumer render isolation, local font
request sharing/retry, and replay timeline updates without parent list renders.
Replay tests also verify stale playback rejection and seek/trim commands.

No browser session or live OBS integration was available during this run. Before
deployment, check with the normal signed-in development session:

1. Switch leagues while saving, and confirm the new league/selected match stays
   selected when the old response arrives.
2. Edit a player in another tab and confirm the corresponding roster updates;
   inspect Network for unnecessary league/match requests.
3. Play/pause, seek, trim and advance a replay playlist with OBS connected.
4. Connect a directory, save a replay buffer, rescan, disconnect, then reconnect;
   confirm the count and clip library agree. Check the fallback folder picker.
5. Open Quick Setup without opening fonts/crop; then open each feature. Check the
   loading UI, font permission/retry and crop save/reset.

Use the same clip library and interaction sequence for before/after Profiler
measurements. Distinguish development StrictMode behavior from production. No
wall-clock render-time or FPS improvement is claimed by these build/test results.
