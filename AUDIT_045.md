# NOVA DROP 0.4.5 updater audit

## Status and scope

November 4, 2026: the updater correction passed local checks, final packaged IPC validation and Windows CI. Artifact `13362285503` was downloaded and verified against ZIP SHA-256 `acf470a587ed80d04f64c76aafee5bcc07c57fcdf05ce64b7c41a78c93d6de5f`; both EXEs match their included manifest. Publication targets [regular v0.4.5](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/tag/v0.4.5). Exact package hashes and source provenance are in [RELEASE_QA.md](RELEASE_QA.md).

Users running 0.4.2–0.4.4 need to install 0.4.5 manually once. Those versions run the defective handoff code before any downloaded replacement can start, so a corrected release alone cannot fix their existing in-app updater.

This correction changes launcher update handoff and its validation. It does not change gameplay or the native DLL. The retained native source is `cafb7a5cc5026bb7ab29aebab75ca52ab32af4ca`; `reboot.dll` SHA-256 remains `b93a717223e5f89447a8138cf4f715057365d497b159e60b4c94ddabbf30d763`. The owner's successful 0.4.4 Test F movement, cosmetics, Thanos and Full reset checks remain evidence for that same baseline. Their limits, including the outstanding multiplayer checks, remain in [RELEASE_QA.md](RELEASE_QA.md).

## Confirmed failure

The owner made three installed-launcher update attempts. All three transactions reached `.ready` and `.apply`, but no completed result was written and the installed target remained version 0.4.2. The downloaded 0.4.4 installer matched its published SHA-256 (`4566006234ae03efc9e641eb40bd7f6dbdc157adad5959e6525ea15c2c2c0362`). This was a handoff failure after download, not evidence of a missing or corrupt package. Copies of the three request, helper and marker sets are retained under ignored `build/update-failure-045/`.

The 0.4.2–0.4.4 handoff directly spawns Windows PowerShell from Node/Electron. The helper is ready before the launcher exits, but does not survive that exit. An isolated regression reproduced the old attached-child failure in all six initial runs. A separate 54-case probe matrix found no working direct attached/detached launch combination in the tested environment: attached helpers were lost with the parent, while the detached PowerShell variants did not execute the required script successfully. A detached flag alone was therefore not accepted as the fix.

This matches libuv's documented Windows implementation: ordinary spawned children are assigned to a job that terminates them when the parent closes its job handle. Its silent-breakaway setting permits subprocesses launched by those children to remain outside that job. This source supports the lifetime explanation; the local probes establish behavior for this project's environment. [Primary libuv source](https://github.com/libuv/libuv/blob/v1.x/src/win/process.c).

## Correction to previous test claims

The earlier update smoke test used a separate, long-running test Node process to start the helper. Closing the launcher under test did not close that Node parent. Those tests did exercise package replacement, launcher restart, runtime/worker startup and preservation of settings, but bypassed the failing lifetime relationship in the actual in-app flow.

Accordingly, the previous descriptions of successful real 0.4.1 → 0.4.2, 0.4.2 → 0.4.3 and 0.4.2 → 0.4.4 upgrades were too broad. The runs and artifact receipts remain historical evidence for the operations they actually performed; they do not validate the old launcher's self-update handoff. [RELEASE_QA.md](RELEASE_QA.md) records this correction alongside the preserved 0.4.4 build and gameplay history.

## Implemented handoff

`desktop/update-install.mjs` starts a short-lived, hidden PowerShell bootstrap. That bootstrap uses .NET process creation to start the real helper with normal PowerShell initialization and without relying on the direct Node child's lifetime. An identity file carries the helper PID and creation timestamp back to the launcher; inherited output pipes are not used to wait for the long-running helper.

The launcher still waits for readiness, rechecks the helper's creation timestamp, records the pending transaction and writes the apply marker before quitting. Pending-install checks distinguish that exact helper from an unrelated process that later reuses its PID. A failed handoff removes consent/pending markers and keeps the launcher open. Existing package/target checksum checks and the helper's parent identity checks remain in place. Independent source review found no actionable issue in this implementation or its readiness/identity guards.

## Verification and remaining gates

| Check | Current evidence |
| --- | --- |
| Old failure reproduced | Initial attached-child regression failed in 6/6 runs; direct attached/detached matrix yielded no working alternative in 54 probes. |
| Independent bootstrap lifetime | Isolated .NET-bootstrap probe survived exit of the actual Electron main process. |
| Local automated suite | All 92 Node/helper checks passed, including actual spawning-parent exit; the old implementation fails the new comparison. |
| Local UI checks | All 19 tests passed, including the revised changelog and update controls. |
| Packaged in-app update | Current 0.4.5 portable and NSIS packages passed their own check/download/install IPC, real initiating Electron exit, helper survival and automatic restart. A debugger supplies only a simulated older starting version and release feed; the packaged handoff is unchanged. Separate real 0.4.2 file-replacement compatibility tests also passed using the corrected helper. |
| Final Windows CI | Source `3e25465bb51b7618ce9529363357d3a530c70493` passed desktop `41906951181` / job `126844054951` and standalone `41906951876` / job `126844056294`: 92 code checks, 19 UI tests, 860 payload files, packaged startup, repeated portable launches and all four update cases. |
| Gameplay | Native baseline unchanged; no new Fortnite session was controlled for this updater task. Existing 0.4.4 owner evidence retains its original scope. |

Both formats completed after the real initiating launcher exited, with the expected target version/hash, retained settings and a functioning restarted runtime/worker. Old installed copies still require the manual first upgrade; a new package cannot fix the handoff already running inside the old launcher.

## First CI attempt and path-length correction

Initial source `fa5ccca` passed replacement and automatic restart, but its portable worker probe failed. The expanded test-case directory made extraction paths exceed the Windows portable extractor's limit. A local hidden portable control reproduced 17 missing files out of 860 with paths up to 264 characters and an `ENOENT` before workspace preparation. Shortening the case label while retaining the same Unicode, spaces, ampersand and apostrophe produced all 860 files and a successful worker check (maximum source path 235 characters). The unpacked-worker control also passed, isolating extraction as the issue.

Commit `3e25465` changes only that test fixture's directory length and preserves detailed IPC/stdout/stderr/path diagnostics on failure. No product validation was removed and the updater implementation is unchanged. The final CI passed all four cases. Arbitrarily long Windows installation/TEMP paths are not claimed supported. Evidence remains under ignored `build/portable-path-evidence-31dXO4/`.
