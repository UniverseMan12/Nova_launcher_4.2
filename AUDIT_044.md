# 0.4.4 corrective audit — regular release

Objective (2026-11-04): continue the existing launcher, repair verified gameplay and lifecycle bugs, withdraw broken 0.4.3, make Auto-Sprint an explicitly warned Beta, improve clarity, and verify the update. The separate bot-lobby prototype remains excluded. The owner performs live gameplay tests; agents do not control the owner's Fortnite session.

## Current outcome

The owner confirmed Test F manual sprint with Auto-Sprint off, then separately enabled Auto-Sprint, restarted Fortnite, and confirmed normal W stop/start, jumping and gliding. Normal Thanos transformation and two Full resets restore the selected outfit, body proportions and movement without a remaining Gauntlet. Test E had already passed selected Black Knight/glider, walking/gliding/skydiving and HUD Scale → Apply without a crash.

Final product source c5d6906 and native source cafb7a5 have verified CI artifacts. The final product differs from the owner-tested cb01901 baseline only in three changelog descriptions; native/gameplay code is unchanged. Both packaging/update paths and the downloaded checksums passed verification. Publication targets [regular v0.4.4](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/tag/v0.4.4), replacing 0.4.2 as the stable version after the withdrawal of 0.4.3.

## Requirements and evidence

| Requirement | Evidence and scope |
| --- | --- |
| Withdraw broken 0.4.3 | Completed November 4: release ID `433085209` deleted; release-by-tag returned 404. Source tag retained. The previous latest stable is v0.4.2 / `433019670`; ignored receipt `build/removed-043-receipt.json`. Main README correction `24feb49169b46de054192e86123bcfb9d64b1f6f` fixed the then-current installer/portable/tagged-source guidance. |
| Warn before enabling Auto-Sprint | Beta, off by default. Each enable needs explicit acknowledgement; Cancel/Escape or a failed save keeps it off. Disabling clears acknowledgement. Unacknowledged legacy enabled settings migrate to off. UI/IPC regression checks passed. |
| Correct movement | Test F owner confirms normal manual W + Shift, and separately normal Auto-Sprint W stop/start/jump/glide after enabling and restarting. The restored server-activation hook retains upstream native calls and failure/input handling; bounded diagnostics record successful Sprint activation. No movement-speed override was introduced. |
| Preserve selected cosmetics and body | Test E owner confirms Black Knight and the selected glider, normal walking/gliding/skydiving. Complete compatible character parts and loopback-only fallback avoid assigning the host's outfit to remote players. Remote cosmetic replication is not live-verified on this build. |
| Thanos and repeated Full reset | Test F owner confirms normal transformation and two complete resets: chosen outfit/body/movement restored, Gauntlet removed. Upright transforms, complete normal snapshots, stale-possession guards and cleanup safeguards remain in place. No forced transformation-height workaround was added. |
| HUD Scale → Apply | Test E with Beta off passed without a crash. Original video/minidump are retained; the earlier array-index crash's precise initiating cause remains unproven. No claim that every settings scenario is fixed. |
| Launcher lifecycle and updates | Atomic preferences, persistent error states, update-offer/checksum revalidation, owned-process identity checks, corrected shared-settings startup and unique portable extraction are implemented. Full CI covers packaged startup, repeat launching and both real update formats. |
| Design and clarity | Larger text, teal logo, shared normal-Thanos/Showdown selector, rounded changelog and clearer Settings/selection styling retained. Showdown selection preserves Solo. Ordinary Thanos copy makes no promise of an original falling animation. Hidden previews were inspected; 19 UI tests passed. |
| Retain existing modes/tools | Existing 20-second random Showdown reselection, including all eligible ready players, remains. Clear inventory/practice respawn were confirmed in earlier builds; current confirmation covers two Full resets. No current two-player Showdown or saved-spot edge-case retest is claimed. |
| Verify source and release payload | Final c5d6906 passed 91 code/helper checks, 19 UI checks, 860 payload-file checks and all package/update checks. Native cafb7a5 compiled and passed both native suites. Downloaded archives/EXEs/DLL matched manifests. The final in-app changelog was inspected; subsequent changes are documentation/previews only. |

## Verified release and baseline provenance

- **Final release product:** `c5d6906e22a57a71f5bd47f875f4961550b1c5af`; [desktop workflow 41897477584](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41897477584), job `126810777170`, and standalone `41897477608` passed. Artifact `13355858721` matched ZIP SHA-256 `fc2b0c313cd15d48565b5279991ac42b518f6fda7002252ef06d4de333a6e766`. Both EXE hashes match their manifest and are recorded in [RELEASE_QA.md](RELEASE_QA.md); ignored receipt `build/verified-build-044.json`. Only three static changelog descriptions changed from the owner's product baseline.
- **Native:** `cafb7a5cc5026bb7ab29aebab75ca52ab32af4ca`; [workflow 41893154077](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41893154077), job `126795563076`, artifact `13353329402`. Archive SHA-256 `28bd61daf227d1d85baea0fab936d2fecb366b8501040f15bf9ee11f0f7e0ed4`; verified/pinned DLL SHA-256 `b93a717223e5f89447a8138cf4f715057365d497b159e60b4c94ddabbf30d763`.
- **Product:** `cb019010d433d182e1022228e8387944f0b16107`; [desktop workflow 41894231091](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41894231091), job `126799325019`, and standalone tests `41894231081` succeeded. Desktop artifact `13355034536` matched ZIP SHA-256 `812b223f0fce30b48f820c48fd897d5e26c2de9ef0a0fbe3dc003ffdbc9858f9`; both EXEs matched the included manifest.
- **Owner Test F:** local same-source portable SHA-256 `12c529f44ccfc55826bc76a99d1b3569aaf45f7fb78e9150e51e5c773e3b3a5c`, native pin as above. Its local build hash differs from the CI portable. Exact EXE sizes/hashes and receipts are recorded in [RELEASE_QA.md](RELEASE_QA.md).
- Five activation-patch regressions exercise pinned upstream excerpts, disabled-hook migration, retained native paths, idempotence and malformed/ambiguous-source rejection. Fresh pinned upstream `10c659028ad9d6816f78226483f11a884bf81f57` accepted the complete patch; all 352 files remained byte-identical on a second application. Independent source review found no actionable ABI/include/behavior regression.
- Hidden UI/input/process tests use isolated fixtures. Actual update probes verify the restarted Electron main and bundled worker, rather than only the portable wrapper. They do not claim renderer interaction after the update. Native compilation and automated checks complement, rather than replace, the owner's gameplay results.

## Historical investigation and corrections

These entries describe superseded candidates. Their former failures and pending checks must not be read as the current Test F result. Full build/hash provenance remains in [RELEASE_QA.md](RELEASE_QA.md).

### Early movement, appearance and HUD reports

The owner originally reported missing selected cosmetics, distorted body parts, moonwalking, flight jitter and glitchy resets. The video `2026-11-03 20-22-24.mp4` also showed a HUD Apply crash; its minidump identifies a client access violation at RVA `0x18c16c9` and an invalid array index, without reliable symbols for the originating object. Later Test E verified Apply with Auto-Sprint off, while the precise original cause remained unproven.

Appearance fixes validate complete compatible parts, preserve a complete normal snapshot and reject delayed possession acknowledgements from replaced pawns. Native `ccabd36` also fixed kill credit skipped by an early respawn return and preserved reset warnings. It passed workflow `41856450087`; its verified DLL `437e18865be37df6a590f757b846b80a75ea3f8badd7d2720348a84f0d708c0c` is superseded by cafb7a5, which retains those safeguards.

The first helper used a W mapping, then a separate F6 action. Original 4.2 defaults revealed F6 conflicts with HotbarKeyF6 and PickerNull. The current helper uses F12, rejects conflicting custom mappings, releases its own held input on focus loss and restores original secondary/toggle settings. Test F now has positive owner Auto-Sprint evidence; menu/window-switch edge cases remain scoped to automated coverage.

### Portable extraction and update probes

The b8d4f18 portable failed with “The session helper stopped unexpectedly.” ICU/worker resources were missing while the main/renderer remained running. Pinned builder 26.18.0's default shared extraction folder could be deleted by a second wrapper exiting through Electron's single-instance check. `portable.unpackDirName: true` selects a unique `$PLUGINSDIR\app` folder in that implementation; bundled documentation misleadingly described `false` instead.

The new regression launches the portable twice with an isolated profile/TEMP, verifies the first runtime's files remain intact, starts a fresh working helper and checks clean closure. Source `87a488b` passed the replacement tests. A strengthened update probe initially exposed PowerShell Unicode-output corruption; explicit UTF-8 and canonical path/process ownership fixed it. Run `41877981055` eventually completed successfully. Its package was superseded; final baseline cb01901 revalidated both update paths and repeated portable launching.

### Shared settings and early server exit

Test D's “Game server could not start” occurred before login with `Cannot Flush Async Loading while async loading is suspended (1)`; memory/reboot DLLs had not loaded. `-UserDir` did not redirect the files used by this 4.2 build. Role-isolated preparation was removed, restoring 0.4.2's backup/process-guarded repair of the actual shared settings file.

Global log discovery now requires the exact quoted ABSLOG marker, resolves the actual file before reporting an early process exit, and handles `Fatal error:`. Historical same-fatal/mismatched-resolution evidence supports restoring the guard without proving the engine's initiating cause. A CI-only failure in the new tests came from 8.3 versus long-path spelling; test-only a84e70a changed assertions to canonical existing-file identity. All focused checks passed with a real short TEMP alias. Test E startup and the 0801843 full CI/artifact verification then passed.

### Test E sprint/Thanos failure and Test F correction

Test E's cosmetics, walking/gliding/skydiving and HUD Apply worked, but manual W + Shift remained slow/jerky with Auto-Sprint off. Thanos could remain in a ground-level falling pose. Read-only settings inspection found no active helper or tagged sprint overlay; saved bindings were LeftShift/None with the historical toggle preference. Logs/screenshots are retained under ignored `build/sprint-thanos-044e`.

Source review identified the candidate's 4.2-specific removal of Reboot's server ability-activation hook. A [comparable engine implementation](https://github.com/folgerwang/UnrealEngine/blob/release/Engine/Plugins/Runtime/GameplayAbilities/Source/GameplayAbilities/Private/AbilitySystemComponent_Abilities.cpp#L1328) conditionally compiles the native wrapper with WITH_SERVER_CODE. This supported restoring the upstream compatibility hook; it does not prove the internals of this Fortnite binary.

Test F restores that hook without changing native prediction/input/failure handling, movement speed, spawn height or reset safeguards. Bounded logs record Sprint/Carmine activation and reset results. The owner subsequently confirmed normal manual sprint, normal Beta sprint after restart, normal Thanos transformation and two successful Full resets. Those results supersede the Test E failures.

## Design references

Reviewed the official [Heroic site](https://heroicgameslauncher.com/), [Playnite site](https://playnite.link/) and [Reboot Launcher repository](https://github.com/Auties00/Reboot-Launcher) for navigation, install information and launch/host organization. NOVA DROP retains its own identity and artwork; no branding was copied.

## Remaining limits

- No current two-player live retest verifies remote cosmetics, Showdown death/respawn/reselection or multiplayer kill credit. Earlier Hamachi success is historical evidence only.
- Clear inventory/practice respawn were confirmed earlier; saved-spot and further multiplayer edge cases remain separate. The current reset result is two successful Full resets in the owner's test.
- Auto-Sprint remains Beta and off by default despite the successful owner comparison. Current live evidence covers W stop/start, jumping and gliding after restarting; additional focus/menu cases have automated coverage only.
- HUD Apply succeeded in the tested comparison, while the original crash's exact cause remains unproven. The game still uses shared settings.
- Passing automation and these owner tests do not establish an exhaustive absence of bugs. Keep statements tied to the build and actions actually verified.
