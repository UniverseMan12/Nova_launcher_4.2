# 0.4.4 corrective audit — test candidate, not a stable release

User objective (2026-11-04): review the existing launcher and gameplay code broadly, repair concrete bugs, withdraw broken 0.4.3, make Auto-Sprint an explicitly warned Beta, fix Thanos transformation/reset distortion, improve clarity and appearance, research other launchers, and verify the resulting update. Do not import the separate bot-lobby prototype or restart the project. The owner tests gameplay; no agent-controlled live Fortnite session is used.

## Requirements and evidence

| Requirement | Current evidence / remaining work |
| --- | --- |
| Remove GitHub 0.4.3 release | Completed 2026-11-04: release ID 433085209 deleted; tagged-release GET returns 404; latest is v0.4.2 / 433019670. Source tag retained. Local receipt: ignored `build/removed-043-receipt.json`. |
| Fix broken public download guidance | Main README commit `24feb49169b46de054192e86123bcfb9d64b1f6f` directs EXE and tagged-source downloads to 0.4.2; withdrawal notice differentiates development features. |
| Auto-Sprint Beta with enable warning | Implemented and UI-tested: off by default; old enabled settings without acknowledgement migrate to off; every enable needs explicit consent. Cancel/Escape and failed saves leave it off. Disabling clears the acknowledgement. Warnings name the known movement glitches. |
| Auto-Sprint movement/input audit | Owner confirms normal movement with feature off. Earlier correction remained unsuccessful. Original 4.2 input config binds F6 to HotbarKeyF6 and PickerNull; current correction reserves default-unbound F12 and checks custom conflicts. Helper/input restoration checks pass. Live movement remains unverified. |
| Thanos transformation and repeated reset | Native commit `ccabd36` uses upright yaw-only reset/teleport transforms, resolves complete compatible parts before applying them, retains the last valid normal snapshot, guards stale possession acknowledgements and verifies Gauntlet cleanup. Compilation and both native rules suites passed. Independent review found no actionable regression. Repeated in-game transform/reset verification is still required. |
| HUD Scale / Apply crash | Original video and minidump preserved locally; executable RVA 0x18c16c9 reads an array with index 0x7fffffff. Dump omits originating heap objects; cause not established. Per-role 4.2 settings preparation is code-tested, but the game's `-UserDir` behavior and the HUD crash remain live-unverified. Compare with Auto-Sprint off before attributing a fix. |
| Broader launcher correctness review | Reviewed updater, download/session lifecycle, process cleanup, backend and persistence. Implemented current-release/checksum revalidation before cached-update installation, exact installer process-identity checks, atomic preference writes and durable errors on write failures. Unexpected game exits surface as errors; optional sprint-helper failure leaves the game running. Regression tests pass; final package validation is pending. |
| Improve design/clarity | Implemented clearer Settings/selection styling with restrained teal highlights; larger text, existing logo, shared Thanos selector and rounded changelog retained. Choosing Showdown preserves Solo. Ordinary Thanos copy does not promise a falling animation. Hidden previews visually inspected; 19 UI tests pass. Research references are recorded below. |
| Retain confirmed behavior | Clear inventory and practice respawn were confirmed on earlier builds; recheck after the native pose/loadout changes. Keep the existing 20-second random Showdown reassignment including all ready players. The separate bot prototype remains excluded. |
| Build, source and release verification | Current local suite: 82 Node/native-helper checks and 19 hidden UI tests passed. Native CI `41856450087` succeeded for `ccabd36`; artifact and DLL checksums verified and pinned. Final combined desktop CI/package evidence and owner gameplay confirmation remain pending. Stable release is still 0.4.2. |

## Verified artifacts and checks

- Native source: `ccabd36cb7dc0e29ad20b8b032c5e3f64261f53e`.
- [Native workflow 41856450087](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41856450087), job `126666283700`: compilation and both C++ rules suites succeeded.
- Artifact `13337861948`: archive SHA-256 `911bc1b04b8bda12e16b227191980ecef81be7cbfddc49056be0ab3fbebc906f`; `reboot.dll` SHA-256 `437e18865be37df6a590f757b846b80a75ea3f8badd7d2720348a84f0d708c0c`. `dependencies.lock.json` records the new pin.
- `npm test`: **82/82 passed** on the final Windows rerun. The initial restricted run could not access a test fixture and was rerun with suitable filesystem access. The actual launch script is exercised using hidden harmless child processes with exit codes 0/7, including after an input-helper failure; process-handle retention fixes a verified PowerShell exit-status regression.
- Hidden Electron regression suite: **19/19 passed**, 24.2 seconds, against the latest main-process changes. Beta consent, legacy migration, failed-save recovery, updates, mode selection, session/cancellation behavior and window-size layouts are covered. Home and Beta-dialog screenshots were inspected.
- Earlier candidate `4079533` desktop workflow `41705646257` is historical evidence only. It does not validate the final current package. Final combined desktop CI, staged-payload checks and EXE provenance must be recorded separately before publication.
- Combined launcher source `b59819be28f978f195da7ea4c949a0eab963c6c1` passed [desktop workflow 41854090367](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41854090367): 82 code checks, 19 UI tests, 861 staged files, packaged/portable startup and real 0.4.2 → 0.4.4 portable/NSIS upgrades. This is interim package evidence; the subsequent native kill-credit/status follow-up still needs to be included in the final package.
- Native follow-up `ccabd36` fixes a confirmed early-return bug that skipped kill credit for handled respawn deaths. A per-life ledger suppresses duplicate credit; final elimination retains native handling. FullReset keeps a shield-restoration warning, and Reboot describes the 20-second delay. Independent review found no concrete regression; the compiled artifact above is verified and pinned. Multiplayer scoring remains to be checked in-game.

## Design references

Reviewed the official [Heroic site](https://heroicgameslauncher.com/), [Playnite site](https://playnite.link/) and [Reboot Launcher repository](https://github.com/Auties00/Reboot-Launcher) for clear navigation, install information and launch/host organization. The changes retain NOVA DROP's existing identity and artwork; they do not copy another launcher's branding.

## Remaining validation

- Owner checks normal movement/cosmetics with Beta off, then optionally tests repeated W start/stop, gliding, menus/console and window switching with Beta on.
- Owner repeats Thanos → Full reset, Clear inventory, practice respawn and saved-spot return; verifies upright proportions, normal animation, health/shield, selected cosmetics and no remaining Gauntlet/duplicate body.
- Owner tests HUD Scale / Apply with Beta off and confirms the actual per-role settings/log paths and persistence after restart. The crash is unresolved until this evidence exists.
- Two-player validation checks remote cosmetics and Showdown death/respawn/reselection. Earlier owner-reported Hamachi success does not verify the current candidate.
- Record final combined build/package evidence before publication. No stable 0.4.4 release has been published, and passing automation does not establish successful gameplay.

## Known scope limits

An exhaustive absence of bugs cannot be proven. Completion requires a documented broad review, concrete fixes and proportionate verification of the requested behaviors. User screenshots/video and runtime results remain authoritative for animation, movement, cosmetics, repeated Thanos transformations and HUD Apply. Missing or indirect evidence is tracked as incomplete, not marked fixed.
