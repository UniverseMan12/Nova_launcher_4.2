# NOVA DROP 0.4.5 updater audit

## Status and scope

November 4, 2026: the updater correction is implemented and its local checks pass. Final packaged IPC validation, CI, publication assets and checksum verification are still pending. Do not describe 0.4.5 as fully verified or published on the basis of this document.

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
| Packaged in-app update | A replacement smoke test is being added to invoke the packaged launcher's actual update IPC and then let that launcher exit. Final result pending. |
| Final Windows CI and artifacts | Pending. No 0.4.5 workflow, artifact digest or executable hash is asserted here. |
| Gameplay | Native baseline unchanged; no new Fortnite session was controlled for this updater task. Existing 0.4.4 owner evidence retains its original scope. |

Release qualification still requires the packaged portable and installed update paths to complete after the real initiating launcher exits, with the expected target version/hash, retained settings and a functioning restarted runtime/worker. Final source, run IDs and verified asset hashes must be recorded after those checks pass. Old installed copies still require the manual first upgrade regardless of the new candidate's test results.
