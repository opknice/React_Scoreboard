# Source Record Macro verification — 2026-11-07–08

## Environment

- Windows x64; OBS 32.2.2; obs-websocket 5.7.4.
- Private portable OBS, generated authentication, port 4457; user configuration was not copied.
- Plugin source baseline `31b562c`, state core `9e85100`, vendor `ec83e10`, reviewed lifetime fixes `b631e5b`.
- Tested plugin DLL SHA256: `6E3A7C3F32328CF24B541FD408DE6D24A11D26E4A7931DCCD2B1FEC5769AE2A3`.
- Original plugin source updated only after original-file hashes matched the baseline manifest.
- Original backups and new DLL: `D:\obs-source-record-master\backup\source-record-macro-20261107`.
- Delivered source also builds successfully in `D:\obs-source-record-master\build`.

## Automated plugin checks

- PASS: 8 pure-C state cases, including timeout, epoch, idempotency, legacy coalescing and retention.
- PASS: 7 protocol cases using real libobs data objects and a fake external host.
- PASS: 6 adapter cases including actual production implementation with controlled external OBS interleavings.
- RED evidence reproduced premature token retirement, startup null-token crash and worker encoder access before fixes.
- Independent task review and scoped fix review approved both lifetime fixes; no open P1/P2 finding at this gate.
- Existing D9025 optimization warning and legacy optional Vulkan/CMP0177 configure notices remain; not new regressions.

## Live plugin checks

| Scenario | Result and evidence |
| --- | --- |
| Vendor registration | PASS: real OBS returns protocolVersion 1, ok true from ListFilters |
| Selected A, main Buffer disabled | PASS: A file exists; B folder remains empty; main replay unavailable/inactive |
| A settings 15s; B settings 30s | PASS: ListFilters reflects separate settings and folders. A sample file duration 12.633s by ffprobe; native Buffer/keyframe behavior, not frame-exact 15s |
| Reuse requestId | PASS: returns previous saved state and exact same file path |
| Changed target under same requestId | PASS: REQUEST_ID_CONFLICT |
| Wrong source/filter pair | PASS: TARGET_MISMATCH |
| Attempt duration override | PASS: INVALID_REQUEST |
| Rename source | PASS: UUID pair unchanged; save succeeds using the original pair |
| Multiple Filters on one Source | PASS: second Filter has distinct UUID and writes its own file/folder |
| Scene Filter | PASS: targetKind scene; saved file exists |
| Disabled Filter | PASS: FILTER_DISABLED |
| Replay disabled | PASS: REPLAY_DISABLED |
| Rapid Buffer disable/re-enable | PASS: 5 cycles, OBS remains responsive, subsequent save succeeds |
| Changed Filter settings | PASS: existing target reflects 7-second setting and saves to configured folder |
| Physical Hotkey binding persistence | NOT RUN live; deterministic callback/construction coverage exists |
| Encoder paused/no saved signal for 60s | NOT RUN live fault injection; core/client automated coverage required |
| Collection cleanup/remove while pending | Deterministic adapter coverage passed; live scenario pending |
| Macro executor/client to real OBS | PASS on 2026-11-08: actual TypeScript executor/client loaded through Vite SSR; selected Filter saves real file, logs path, then runs next Action. File size 1,678,441 bytes. UUID pair survives OBS restart |
| Manual browser-button and physical keyboard | NOT RUN live; selector/editor integration and trigger/executor paths covered by automated tests |

Evidence copies and reports are retained under
`D:\obs-source-record-master\backup\source-record-macro-20261107\verification`.
The live executor test uses a Node window/timer shim; it does not claim manual browser-button acceptance.

## Web checks

Before changes: PASS 79 files / 380 tests. Existing InstantReplayScreen warnings are recorded separately.
Final WEB commit: `b2d2685`.

- PASS focused: 6 files / 61 tests.
- PASS full suite: 82 files / 412 tests, exit 0.
- PASS `npm run build`: TypeScript and Vite production build.
- PASS `npm run lint`: oxlint clean.
- PASS committed diff whitespace checks.
- Independent combined spec/quality/integration review: approved, no Critical/Important findings.

## Installation and delivery

New DLL is built at `D:\obs-source-record-master\build\source-record.dll`.
Writing to installed `Program Files` was denied by Windows. The original installed DLL was verified unchanged
and backed up before that attempt. No privilege escalation or user-settings changes were attempted.

Remaining host action: close OBS, open PowerShell as Administrator and run
`D:\obs-source-record-master\install-source-record-macro.ps1`, then open OBS again.
The installer requires Administrator, refuses a running OBS, backs up the installed DLL and verifies its hash.
Its syntax was parsed successfully and it was included in the combined review; the privileged copy itself
could not be executed in this session.

WEB work remains on `feature/source-record-macro` in the managed worktree. Nothing was pushed or deployed.
