# Desktop release checks

## 0.4.4 — corrective test build, not published

### Current candidate — November 4, 2026

- **Release status:** faulty regular release 0.4.3 was deleted on November 4 (release ID `433085209`; the release-by-tag request returned 404). Its source tag remains for history. Latest stable/download target is **v0.4.2**, release ID `433019670`. Public main README commit `24feb49169b46de054192e86123bcfb9d64b1f6f` corrected the installer, portable and tagged-source links; this branch now matches that guidance. No stable 0.4.4 release is claimed.
- **82 Node/native-helper checks passed locally** on the final rerun. The initial restricted run failed on fixture filesystem access; that was not counted as a code failure or a successful run. The successful Windows run covers the current F12 helper, binary input-settings restoration, backend uploads, isolated display settings, atomic preferences and update revalidation. Hidden harmless child processes exercise the actual launch script for exit codes 0/7 with and without input-helper failure. This caught and corrected Windows PowerShell losing the child exit code unless its process handle is retained while alive.
- **19 hidden Electron UI tests passed** against the latest main-process changes (24.2 seconds). Coverage includes beta acknowledgement on each enable, migration of legacy enabled settings to off, Cancel/Escape, failed preference-write recovery, saved options, mode selection, update controls, session/cancellation guards and supported window sizes. Home and Beta-dialog screenshots were visually inspected; layouts remain usable at 940×700, 1200×820 and 1440×960. These previews used isolated test profiles and hidden windows, without controlling the owner's desktop or game.
- **Auto-Sprint remains experimental, off by default.** UI and IPC require the current explicit beta acknowledgement before enabling; switching it off clears that acknowledgement. Existing enabled profiles without acknowledgement cannot silently remain enabled. The dialog discloses moonwalking, slow movement and airborne shaking; cancellation or a failed save keeps it off.
- The helper now reserves **F12**, after inspection of original 4.2 defaults found **F6 bound to HotbarKeyF6 and PickerNull**, even when absent from the user's saved overrides. It keeps sprint separate from W, rejects custom F12 conflicts and restores the previous secondary/toggle values when disabled. Hidden message-only windows validate scoped F12 packets, focus-loss release and held-W rearming; these checks do not establish that sprint works in Fortnite. The owner reports normal movement with Auto-Sprint off.
- **Native source:** `ccabd36cb7dc0e29ad20b8b032c5e3f64261f53e`. [Native build 41856450087](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41856450087), job `126666283700`, succeeded in compilation and both C++ rules suites. Artifact `13337861948` matched archive SHA-256 `911bc1b04b8bda12e16b227191980ecef81be7cbfddc49056be0ab3fbebc906f`; its DLL matched SHA-256 `437e18865be37df6a590f757b846b80a75ea3f8badd7d2720348a84f0d708c0c` and is pinned in `dependencies.lock.json`.
- The native correction removes camera pitch/roll from reset and saved-spot pawn rotations, resolves complete hero specializations before applying parts, verifies valid gender/body selectors and preserves the last complete normal snapshot if a refresh is incomplete or still shows Thanos. Gauntlet cleanup checks actual removal; old/intermediate pawns are cleaned up through tracked references. Possession acknowledgements for an old pawn cannot overwrite a replacement pawn or reinitialize its health. Independent read-only review found no actionable regression in these changes. Repeated live transformation/reset, replication and movement afterward remain unverified.
- **Separate 4.2 settings:** `LegacyGameData` prepares independent client/server directories and imports only compatible display/quality values. Tests preserve the source file byte-for-byte, retain existing isolated settings and reject invalid roles/values. Startup no longer unconditionally forces a 1280×720 window. The `-UserDir` argument is passed to the game, but actual runtime selection and settings persistence need an owner test. This is not evidence that HUD Scale / Apply is fixed.
- **Launcher reliability:** saved settings/update preferences use atomic replacement. Preference or log failures remain errors and cancel pending work; later helper messages cannot turn them into success. Unexpected game exit codes are surfaced, while optional sprint-helper failure leaves the game running. Cached updates are revalidated before installation against the latest offer and checksum; withdrawn/changed releases or failed online checks do not replace the running launcher. Installer markers check process creation time as well as PID. The updater offers newer versions only, so it does not automatically downgrade 0.4.3.
- **Design and mode selection:** clearer settings and selected states retain larger text, the teal logo, shared Thanos selector and rounded changelog. Selecting Infinity Showdown preserves Solo rather than silently choosing Host friends. Ordinary Thanos copy uses neutral Gauntlet wording and makes no promise of an original falling animation. References reviewed for navigation/install clarity were [Heroic](https://heroicgameslauncher.com/), [Playnite](https://playnite.link/) and [Reboot Launcher](https://github.com/Auties00/Reboot-Launcher); no branding or artwork was copied.
- **Final desktop package:** source `b8d4f18a8ded8d81175e0b7d665c5abbdbc38c10` passed [workflow 41857658000](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41857658000), job `126670507522`: 82 code checks, 19 UI checks, 861 verified staged files, packaged/portable startup and real 0.4.2 → 0.4.4 portable/NSIS updates. Settings, game paths, restart and special-character paths passed. The final native pin is `437e18865be37df6a590f757b846b80a75ea3f8badd7d2720348a84f0d708c0c`.
- Artifact `13338193037` matched GitHub archive SHA-256 `9ac627197838e1ff02c43c2f47cb395a8e67f34dd96c6c4f17c9fc1190d6d7aa`. Downloaded installer hash: `ea333ac245c2e72843af7140252045794055894906095a8124815a40973af367`; portable hash: `20c5547ef4be37471fa60ef4129f19ee52eb302773398ea84134db968da688a5`. The copied local test EXE matches the portable hash and reports NOVA DROP 0.4.4 in its Windows version resource. Its home/changelog screenshots were inspected and copied into the README. Subsequent changes in this branch are documentation/previews only.
- **Still pending:** owner playtests below. No new stable-release assets have been published. The separate bot-lobby prototype remains excluded. GitHub still returns 404 for release v0.4.3; v0.4.2 remains the current regular release.
- **Interim package validation:** source `b59819b` passed [desktop workflow 41854090367](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41854090367), including 82 code checks, 19 UI checks, 861 verified payload files, packaged/portable startup and real 0.4.2 → 0.4.4 updates for portable and NSIS. Subsequent native follow-up `ccabd36` preserves once-per-life kill credit for handled respawns and accurate reset warnings; its verified DLL is included in the final b8d4f18 package above.

### Required owner playtests

| Check | Current status / expected evidence |
| --- | --- |
| Auto-Sprint off baseline | Owner previously reports normal movement. Recheck current candidate with selected skin/glider before testing Beta. |
| Auto-Sprint Beta | Unverified in-game. Repeated W stop/start, landing/gliding, menus/console and window switching must not cause moonwalking, slow movement or shaking. |
| Thanos and Full reset | Unverified for this native build. Repeat transformation/reset while looking up and down; check upright body, normal movement, selected cosmetics, 100 health/shield and removed Gauntlet. |
| Clear inventory / practice respawn / saved spot | Previously confirmed in earlier builds. Recheck after the new native changes and after Thanos; normal tools must not leave a transformed body or duplicate pawn. |
| HUD Scale / Apply | Crash remains unresolved. Test first with Auto-Sprint off; record the new game's actual settings/log directory and whether its settings survive restart. |
| Remote cosmetics and Showdown | Separate two-player test pending. Each player keeps their own outfit; death/respawn and the shared 20-second random reselection include all ready players. |

### Earlier 0.4.4 candidate evidence — superseded, retained for diagnosis

- The owner tested 0.4.3 and reported sprint stalling after stopping/restarting, incorrect default-body proportions before ever becoming Thanos, missing Black Knight/Lightning-glider selection, glitchy full reset, and jitter while flying. Clear inventory and practice respawn worked.
- The saved locker contains `CID_035_Athena_Commando_M_Medieval` and `Glider_ID_010_Storm`; both assets and the selected backpack/pickaxe/contrail were located in the installed 4.2 PAK index without modifying the game. The server log reports no Athena profile during loadout lookup; the client log repeatedly reports rejected `FortGameplayAbility_Sprint` activations.
- Changes under test: keep the native 4.2 ability-activation path (the replacement omits replicated-data cleanup); handle 4.2's six character-part pointers without a later-version wrapper offset; choose a valid gender/body size compatible with the selected parts; apply saved locker choices only to the loopback player when the No-MCP host has no usable loadout. Remote players are never assigned the host's profile. Remote cosmetic delivery remains unconfirmed.
- The appearance rules have native regression cases for a female fallback, Black Knight, restoring a medium body after Thanos, incompatible parts and mask values. Worker tests check that backend and native host receive the same persistent profile directory.
- [Native build 41700629209](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41700629209) compiled `f4bfd6e0e14f54339842988354dbf8ea33637f97` and passed both native rules checks. Artifact `13263486999` matched GitHub archive SHA-256 `a1d3205d47dc0fd90cc643670fc96bcf788eed474bc606be7c0f9391afcb94ac`; the DLL matched its included checksum `ca162057aee3e2efa150ba0dc2be7b107d2dfc12d736737d620de439d250455b`. This was the earlier test DLL and is superseded by the current native pin above.
- **First 0.4.4 playtest failed.** Video `2026-11-03 20-22-24.mp4` shows Black Knight, Cloud Strike and the selected pickaxe/contrail in the match, but the owner reports moonwalking and airborne jitter. Disabling Auto-Sprint and restarting restores normal movement according to the owner. The native activation change removed rejection-log spam but did not fix the movement bug; it is not counted as a successful movement test.
- The same video shows HUD Scale changing to approximately 0.59 and a crash immediately after Apply. The saved minidump identifies a client access violation at executable RVA `0x18c16c9`; a native array index is `0x7fffffff`. Logs enter Apply Settings and suspend async loading before the crash. No reliable symbols identify the originating object. A comparison with Auto-Sprint disabled has **not been tested**. The HUD crash remains unresolved; neither the server nor cloud-settings code is claimed to be its proven cause.
- The superseded second movement candidate removed Sprint from W and used a separate F6 action, with one press/release per W hold targeted only at the launched client's Unreal window. It used no global keyboard injection or game-memory patch. Focus loss released the helper's key and required W release before rearming. Physical F6 was not released by the helper. Existing secondary/toggle settings were restored on saved uploads, and saved F6 conflicts prevented enabling. Original default bindings later revealed an additional F6 conflict; the current candidate uses F12. This earlier implementation is not a successful gameplay result.
- All **70 Node/native-helper checks passed locally** for the second candidate. The new C# helper compiles; state checks cover stopping/restarting, focus loss, held-W rearming and physical-key ownership. Hidden message-only test windows verify real F6 down/up packets and rejection of unrelated process IDs/window classes, without generating OS keyboard input. The owner's existing settings file was read only; the new transformation and restoration returned its original bytes exactly. These checks cannot establish playable in-game behavior.
- No live Fortnite process was started or controlled by the agent for these checks. The code remained a test candidate awaiting owner verification. The initial public known-issues notice for 0.4.3 was followed by withdrawal of that release on November 4; 0.4.2 remains the latest stable release.

## NOVA DROP 0.4.3 — withdrawn release, historical evidence

- Based on regular 0.4.2. The unconfirmed bot-lobby branch is not included.
- 68 Node tests passed locally, including binary client-settings transformations, exact control restoration, malformed-data rejection, cloud length/hash agreement, locker persistence across separate payloads, migration, version notifications and multiplayer worker cleanup.
- The existing 4.2 ClientSettings archive was read without changing it: Auto-Sprint changed only the intended binding/toggle and restoring the preferences reproduced the original bytes exactly.
- [Native build 41693414627](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41693414627) compiled source `f00e67f5979ceb8c7558aa5060e9aa281d5c0e3f` and passed the native Infinity rules tests. Artifact `13260540748` matched archive SHA-256 `dec7666285d66cb2692997ff5e3dd1b9b6ada6a89a8400b0499c109e7cce7eed`; the included DLL and checksum matched `0bbb38e22a0af887d728fc13be527ebe85d2b3d9ab774e472180793aaac88158`.
- [Final Windows validation 41694746838](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41694746838) built source `495f3f770d1b7d7f7db31e219af51a9f1d576dcd` with the new DLL pin above. **68 Node tests and 17 desktop UI tests passed**, along with packaged/portable startup checks and real **0.4.2 → 0.4.3** upgrades for both editions. The update tests retained settings and game paths, including paths with spaces and special characters. The stage contains **859 verified files**.
- Final artifact `13261705693` matched GitHub's archive SHA-256 `f5233e09eb7d1b078cf6188b2ed531a51a72a8f3e6e206cf1fc542eafcc5d540`. Both EXEs matched their checksum file: installer `43aa91dcdf34a45d4a64ea3c79a88366a9999598a8a124b2c2e68d7f52e06624`, portable `89efa659a3c0a6fec49d9021e8f768dccffba255e0f8eb20ade8236b5b88d25c`. Both Windows executables report product/file version **0.4.3** and product name **NOVA DROP**. The preliminary artifact from run `41693121715` is not used for this release.
- The final CI home and changelog screenshots were visually checked and copied into the README. The changelog scrolls at smaller window sizes; its close control remains visible. Publication changes only documentation and README images after the tested source, leaving the executable files unchanged.
- Hidden, isolated launcher previews were inspected at 1200×820 and 940×700, including the shared Thanos selector, larger text and changelog. No live Fortnite session was controlled for these checks.
- **Post-publication gameplay result: failed.** The owner reported Auto-Sprint stalls, missing Black Knight/glider selection, incorrect body proportions and glitchy Thanos resets. Flying also jitters. Clear inventory and practice respawn were confirmed working. After an initial known-issues notice, the release and its assets were removed on November 4, 2026. The source tag remains for history; stable downloads and the automatic-update target point to 0.4.2 while a correction is tested.


## NOVA DROP 0.4.2 — regular updater release

- Based on the regular 0.4.1 release. Native server, game modes and logo are unchanged; the unconfirmed bot prototype remains separate.
- Adds automatic startup checks, optional manual checks, explicit download/install controls, SHA-256 verification and Windows replacement helpers for NSIS and portable builds.
- Local updater tests pass version/feed validation, cancelled and corrupt downloads, cache recovery, session blocking and changed files. Windows helper failure tests confirm that invalid hashes and a cancelled handoff preserve the previous launcher.
- [Windows build 41681911937](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41681911937) tested source `053ced9ccb26014d4a159f2674164d90e5e56ab0`: **60 Node tests and 15 desktop UI tests passed**, as did the packaged and portable launch smoke tests. The build includes 852 verified runtime files and the unchanged regular server DLL `ea242ca57d74ebb0d39cbabba71ef5ba58787b828da39455904fc57afe70cef2`.
- Real **0.4.1 → 0.4.2** upgrades passed for both portable and NSIS editions on GitHub's isolated Windows runner: download/verification through the updater, replacement, restart, preserved settings/game path and portable backup. Test folders include spaces, an umlaut, an ampersand and an apostrophe. The updater feed in these upgrade tests is a fixture because 0.4.2 had not yet been published at test time; the previous 0.4.1 EXEs are downloaded from the real release and verified against their fixed hashes.
- The helper failure tests cover corrupt packages, changed targets, readiness, process exit and cancelled handoffs. Validation caught and fixed Windows PowerShell exiting before a detached script started, UTF-8 path decoding and Windows' four-part product-version resource. The update notification, preference persistence, cancellation controls and disabled installation during a session are covered by the UI tests.
- Artifact `13253201855` matched GitHub's ZIP SHA-256 `f132df08fac5b6fbd3c29f01145f504220210033ebc9ecf95249026de49c20d6`. Both downloaded EXEs matched their checksum file: installer `134c55d37fb13a452f822080f07e57934200618a29d5caf069e8c6df1cef9f59`, portable `be85233b41827a794f34e6602633dffca2d4ce3f54396f09c350a9129559d741`.
- The home and update-panel screenshots were visually checked, including the minimum window size. `launcher-updates.png` uses a fictional 0.4.3 offer to demonstrate the UI; it is not an announcement of another release. No live desktop/game playtest was performed on the owner's running session. The publication changes only release documentation and the README preview after the tested source, without changing its executables.
- Published as the regular **v0.4.2** release, with GitHub's prerelease flag disabled. One manual upgrade from older releases is required to receive future in-app updates. The updater downloads full EXEs, uses the repository's release checksum, and does not provide Authenticode publisher verification.

## NOVA DROP 0.4.1 — regular logo update

- Scope: the owner-supplied teal orbit-and-star logo, matching startup glow, Windows icon, updated launcher preview and 0.4.1 version labels. Based on the regular 0.4.0 release; the separate bot-lobby prototype is excluded as requested.
- The PNG is preserved byte-for-byte, including transparency: SHA-256 `00af8064ff12420a511ab0c7d3d34d8d2d4d05d8d9ccf3f02fb5f973149b9229`.
- Retains the regular native game-server build `1562a467694f98444c16ee2284a1eff5057f2b81` and its existing gameplay validation/limitations below.
- [Windows release build 41670941135](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41670941135) built `6ae32eccd6c15e7fa553156ff511c60d26bf9286`. **45 Node tests and 13 desktop tests passed.** Packaged and portable smoke tests passed payload preparation, build detection, first-use setup, UI/artwork loading, invalid-input handling and clean close on GitHub's Windows runner.
- The CI stage contains **852 verified runtime files**. The native DLL is still `ea242ca57d74ebb0d39cbabba71ef5ba58787b828da39455904fc57afe70cef2`. A stale artifact URL under the old repository name returned 404 during the first candidate build; 0.4.1 uses the current repository URL with the original archive and DLL checksums.
- Artifact `13249391349` matched GitHub's ZIP SHA-256 `e825a86eafb0b58afa6b629377ecfe61bebd799c1c98cf4726badfbd6a54457d`. Both EXEs matched the CI checksum file: installer `a7e0d1c4c9e4723b0733f5bfd8155feb0a3ba76f4c85c8ed73a18811361fa540`, portable `8ae100d149bebeacf18301b93c571e997730983d555df73659d671da0d42070a`.
- Both Windows executables report product/file version **0.4.1**, product name **NOVA DROP**, and their extracted Windows icons show the new teal emblem. The CI screenshot was visually checked and copied to the README preview. The publication commit changes only this QA record and that screenshot after the tested source.

## NOVA DROP 0.4.0 — regular release

- The launcher is now named **NOVA DROP**, with its original transparent meteor emblem in the sidebar, startup screen and Windows icon. The existing app ID and per-user settings directory remain unchanged. The release has no alpha suffix and is published with GitHub's prerelease flag disabled.
- [Windows release build 41329714710](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41329714710) built commit `e246c57e95c99fba39e03964ef0d0b7b5b647ca5`. **45 Node tests and 13 desktop tests passed**, including the version, title and loaded branding asset checks. Packaged and portable smoke tests passed verified payload preparation, build detection, first-use setup, UI/artwork loading, invalid-input handling and clean close. These ran on GitHub's Windows runner, not the owner's desktop.
- The CI package contains **852 verified runtime files** and the pinned native DLL from `1562a467694f98444c16ee2284a1eff5057f2b81`. The new shared 20-second cooldown and all-eligible random selection retain the native coverage documented below.
- Release artifact `13093355095` was downloaded and verified against GitHub's archive SHA-256 `48558bd893995d38b421aaa1848de794e9db86a9ea6b3229122665998ac208b1`. Both EXEs matched the bundled checksums: installer `c4a9f494dd2eb6d61d408ada9bc0fd8920f563d3bba86c451d55ef497385f0b8`, portable `fc57757f45a3074c52a7725b3a8536e8836bfaa784d81bb9c104333043063b61`. The publication process verifies each uploaded asset's size and SHA-256 before making the draft public.
- The CI-generated launcher screenshot was visually inspected and copied into the README's existing screenshot path. Branding fits the sidebar, all three mode cards remain visible, and the main download button and version display are readable. The PNG emblem's transparency was checked. The publication commit changes only this QA document and the screenshot after the tested build.
- The Windows CI runner exposed a pre-existing assertion that compared a canonical installation path to an equivalent 8.3 alias. The regression test now compares resolved paths; installation behavior is unchanged.
- The owner previously reported successful two-player Hamachi gameplay. The new death-to-reselection delay has not yet been playtested in a multiplayer match. Ordinary Thanos mode remains experimental; unsigned executables, the cosmetic Showdown storm timer and clean-machine installation limits are unchanged. Publishing a regular release does not imply those checks were performed.

## Alpha.4 Thanos reselection fix — test build

- Restored Alpha.4 baseline with a shared 20-second cooldown after Thanos dies or disconnects. Duplicate death callbacks return before scheduling; final elimination also starts the cooldown. Normal player deaths do not restart it. Every eligible player can win the draw, including the previous Thanos after their existing respawn/landing delay.
- [Native build 41327999569](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41327999569) compiled `1562a467694f98444c16ee2284a1eff5057f2b81` successfully. Native rules assertions passed for already-ready survivors waiting the full 20 seconds, the exact boundary, repeated cooldowns, empty pools, world reset and selection including the previous Thanos.
- Artifact `13091703062` matched GitHub's archive SHA-256; the DLL matched its included checksum and the updated dependency pin. **45 Node tests passed**. All **852 staged and unpacked payload hashes** passed, including the new native pin and public profile checks.
- The new multiplayer death-to-reselection behavior is **not yet verified in Fortnite**. No desktop/game automation was used for this change. Use the separately named `Fortnite-Launcher-0.4.0-alpha.4-thanos-delay-portable.exe` for the owner playtest; the original published Alpha.4 EXEs remain unchanged.

## 0.4.0-alpha.4 — download directly from Play (prerelease)

- The owner's public Google Drive archive was retrieved without signing in: `4.20-CL-4072250.7z`, **8,946,548,760 bytes**, SHA-256 `d89a92ed1e4038627aa8bf0c0985c7eb16eab033a194c0f66c38f90285c8de4c`. The manifest selects **24,091,769,351 bytes** of game content; extra Epic launcher/redistributable folders are excluded.
- A full-size installer test resumed the final MiB from the real Drive endpoint, hashed the complete archive, extracted the game, validated every selected file's type/size and detected **4.2 / CL-4072250** before moving the finished folder into place. The archive cache was removed after success.
- Regression coverage includes Range resume, servers ignoring Range, dropped connections, cancellation, wrong ranges, HTML/quota pages, hash mismatch, hard-linked caches, unsafe/duplicate archive paths, links, wrong game builds, insufficient space, extractor cancellation, retry after cancellation and preserving existing folders.
- **45 Node tests passed** in the final combined run.
- **13 desktop tests passed**, including the main Play download button, native folder picker, cancellation, choosing an existing installation from Play, bounded download IPC, progress display and automatic installed-folder feedback. The progress and cancel controls were checked at the minimum 940×700 window size and visually inspected.
- The actual packaged EXE passed a live Drive download/cancel/resume check with a fresh profile. It retained partial bytes across retries and did not select an unfinished game folder. The temporary smoke-test cache was removed afterwards.
- Installer and portable EXEs were rebuilt successfully. The portable test passed self-extraction, UI/artwork loading, verified payload preparation, invalid-folder recovery and clean close. Current-version checksums are generated in `dist/SHA256SUMS.txt`.
- A separate packaged startup test launched the actual game-server helper from the newly downloaded installation up to Reboot settings, then stopped it cleanly. Original game settings were restored and no Fortnite processes remained.
- All **852 staged and unpacked payload hashes** passed, including the native server pin, extractor/source pins and public backend profile templates. No game binaries were included in the launcher payload.
- The first combined Node run overlapped the real-game smoke test; the existing display-repair guard correctly rejected that test while Fortnite was running. The combined suite was rerun after game shutdown.
- Google Drive availability/quota remains external. Slow-drive/low-space scenarios, abrupt power loss and a clean-machine installer/uninstaller run are not fully exercised; automated tests cover the stated cancellation and validation paths. Alpha.4 is an experimental prerelease; stable 0.3.1 remains separate.

## 0.4.0-alpha.3 — ordinary Thanos mode (prerelease)

- Added a third launcher selection for the existing Carmine / Infinity Gauntlet playlist. The native preset disables Infinity Showdown, late-game and practice respawning; it does not apply Showdown's arena, starter kit or respawn rules.
- **36 Node tests passed**, including saved Thanos settings and worker routing for solo, host and joining sessions. **11 desktop tests passed**, including distinct artwork, saved mode selection, host-controlled join rules and the three cards at supported window sizes. Thanos screenshots at 940×700 and 1200×820 were visually inspected.
- Applying the native patch twice to an existing pinned-source test checkout left `gui.h` unchanged on the second run. The CI job also applies the patches to a fresh pinned upstream checkout.
- [Native build 41308510309](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41308510309) passed compilation and native rules tests from `9004ee1cde9920d88f6b06e1ecbedc86bd2c2ed0`. Artifact `13084366928` matched the GitHub archive digest `3a8f0b19fb3be8076d5de7a45e3b2a59a718b3cf98ef63df12bb35923fcdb94f`; DLL digest `7b825bfa081151b58db35414e835b9c92fa296e192f934dbe500fb099b1faf9a` matched its bundled checksum and is pinned in `dependencies.lock.json`.
- All 846 staged and unpacked payload hashes passed, including the new native pin and the public profile-template checks.
- The packaged EXE passed fresh-profile preparation and started the actual game-server helper with Thanos selected up to Reboot settings, then stopped it cleanly. No Fortnite processes remained; original game settings were restored.
- Installer and portable EXEs were rebuilt locally with the verified native DLL. The portable smoke test passed self-extraction, the Thanos mode card and its bundled artwork, payload preparation, invalid-folder recovery and clean close. Checksums are generated in `dist/SHA256SUMS.txt`. The release uses these tested artifacts, with runtime source at `69a9a2d`; the publication commit only updates release documentation. Every uploaded asset is checked against its local size and SHA-256 digest before publication.
- The actual launcher screenshot is committed at `docs/launcher-preview.png` and included in the README. A documentation-only commit on `main` adds the screenshot and clearly distinguishes the upcoming preview from the published alpha.2 and stable 0.3.1 releases; no experimental runtime code was merged into `main`.
- A complete ordinary Thanos match, including the falling gauntlet, has not been played during this update. Automatic server startup is not part of this change: Reboot opens with the requested mode selected and still waits for **Start server**.

## 0.4.0-alpha.2 — launcher redesign and runtime audit

This prerelease is developed on `codex/launcher-redesign`. The alpha.1 release and stable `main` have not been replaced. The native game-server DLL remains the verified `bda98ce` build documented below. Release assets are built locally on Windows from this branch; the release body records the exact committed source.

- Reviewed desktop IPC, startup/state handling, saved settings, worker coordination, local backend startup, HTTP/XMPP handling, cloudstorage, setup/download integrity, game-folder detection and native process ownership/cleanup code.
- **34 Node tests passed** in the final combined suite, including backend spawn failure, host/guest invitation routing, cancellation, file validation, setup-command failures/timeouts and terminating the owned Windows setup process tree.
- 10 desktop tests passed: persisted setup/invitations across restart, error recovery, overlapping starts, cancellation, next-step guidance, expired invitations, reduced motion, startup completion, renderer isolation and the three pages at 940×700, 1200×820 and 1440×960. Classic screenshots at 940×700 and 1200×820 were visually inspected.
- Backend protocol regression tests passed after injecting a failing asynchronous profile command, a traversal-shaped cloudstorage request, an oversized settings upload and a malformed authenticated XMPP message. Profile commands also reject traversal, unknown names, arrays and nested query objects. Health and matchmaking remained available afterwards.
- Production backend dependency audit: **0 findings**. Development build tree: **15 moderate findings**, all through minimatch and its dependents. npm suggests an incompatible electron-builder downgrade; it was not applied. These development packages are not shipped in the runtime.
- Season 4 image sources and the original logo are documented in `desktop/ARTWORK.md`.
- Final staged and unpacked payloads passed all **846 file hashes**, the pinned DLL check, public profile-template comparisons and private-file exclusions.
- The rebuilt packaged EXE passed fresh-profile extraction, build detection, first-use preparation, public-host rejection and renderer-error checks with Infinity Showdown selected. It also started the actual Fortnite game-server helper up to Reboot playlist selection and stopped it cleanly. No Fortnite processes remained, and the user's original game settings were restored.
- Both final alpha.2 EXEs were rebuilt successfully. The portable EXE passed self-extraction, artwork loading, verified payload bootstrap, invalid-folder recovery and closing the application. Checksums and the release-note asset are generated from these final outputs before upload; each uploaded asset's size and SHA-256 digest are verified before publication.
- Native gameplay changes were not made in this redesign. Real two-PC VPN play and clean-machine installation/uninstallation remain unverified. Setup cancellation terminates owned processes, but interruption of a fresh source/CMD Git clone may leave a partial vendor checkout requiring manual recovery; the EXE uses its bundled backend.

## 0.4.0-alpha.1 — Infinity Showdown, November 1, 2026

The release target is the experimental **v0.4.0-alpha.1** prerelease. The stable public release remains **v0.3.1**. The development branch has not been merged into `main`.

### Server provenance

- Native source: `bda98ce772651b219476e04e934d9397effe9fe1` on `codex/infinity-showdown`.
- [Native build 41255821532](https://github.com/UniverseMan12/fortnite-4-2-launcher/actions/runs/41255821532): successful compilation and native rules tests, including solo fallback, multiplayer preference and guarded bus exit.
- Artifact: `13063331595`, `launcher-server`.
- Archive SHA-256: `9b0ba9544f82e78e207f637b72fe0a9bf6efa2ac24946f354dabde23a44d1ac0`, verified against GitHub artifact metadata before updating the dependency manifest.
- DLL SHA-256: `5c898810f41344de82d5911c3249d2c84decbac4df6605b83ca305218328fa67`, verified against the artifact's `reboot.sha256`.
- The previous installed DLL hash is retained in `previousGameServerSha256s` so setup can safely replace it.

### Current validation

Both alpha EXEs were rebuilt with the final `bda98ce` DLL after the confirmed zone playtest. Packaged and portable smoke tests passed again on those final outputs. Historical gameplay observations below name their tested DLL explicitly.

- `npm run setup`: passed; installed the new pinned DLL.
- `npm test`: **28 passed**, run before starting Fortnite.
- `npm run test:desktop`: **7 passed**.
- `npm run stage:release`: staged 845 verified payload files. The staged and unpacked DLL hashes match the new pin.
- `electron-builder --win nsis portable --x64 --publish never`: rebuilt both alpha EXEs successfully with the new pin.
- Packaged launcher smoke test with Infinity Showdown selected: passed fresh-profile extraction, build detection, first-use preparation, public-host rejection and renderer-error checks.
- Portable smoke test: passed self-extraction, initial UI/artwork, payload bootstrap, invalid-folder recovery and closing the application.
- All 845 packaged payload file hashes were checked. Bundled backend profile templates match the pinned public source apart from Windows newlines; no private configuration, session data, logs or Fortnite game files were staged.
- `dist/SHA256SUMS.txt` and `dist/RELEASE-NOTES.md` are generated from the final EXEs and the repository's complete release notes before upload. The alpha notes link to this branch's QA record.
- An isolated manual playtest of the earlier `7fa0949` DLL reached the island and the first successful Thanos transformation. Its loaded module hash was verified. After Thanos death, the tester's screenshot showed the original skin skydiving with 100 health, 100 shield, restored weapons/consumables and retained materials. The server log recorded gadget removal and new possession without a crash.
- Solo reassignment succeeded in that same session: the native log records initial gadget application at 00:34:49, removal/new possession at 00:35:29 and successful application again at 00:36:09 (Europe/Zurich). The 20-second landing threshold is verified by native rules tests; the manual observation was not a frame-accurate timing measurement.
- Follow-up appearance fix in `92773e4`: restores original body type, gender, all six part slots and animation override. The tester confirmed normal body proportions after Thanos death; the earlier skin-visibility result alone did not establish correct proportions.
- Follow-up bus fix in `92773e4`: uses the native `StartsWithAirCraft` zone startup and a guarded native jump path. Bus startup and the subsequent Thanos death completed without a crash, but the tester reported a missing storm wall with only the white minimap circle. This candidate is not ready for publication. Native assertions cover missing arena/configuration, non-passengers, the drop-start boundary, invalid time and end-of-route ejection.
- Zone lifecycle repair in `bda98ce`: completes native initialization once after Aircraft, with a valid indicator, and repairs native resets of the fixed geometry, timestamps and preview pause state. Native rules cover both lifecycle stages and preserving the captured radius. The final solo playtest used the verified DLL hash listed above. The tester confirmed the blue storm wall both before and after leaving the bus. Native logs recorded stage 1 at 01:21:17 and stage 2 at 01:21:34 (Europe/Zurich), with a 15000 cm radius in both stages. Read-only diagnostics after the transition showed the same game-state/mode indicator, active zone, paused mode progression, unpaused indicator/preview, all four radii at 15000 cm and matching fixed timestamps. A screenshot showed the purple storm and safe area on the minimap. Repeated early jump input was not separately measured manually; the countdown boundaries are covered by native assertions.
- Rejected intermediate build `ba9e4e4`: the bus-start playtest crashed before zone creation (access violation reading the indicator's `NextCenter` at null + `0x348`). It is excluded from publication. The pinned DLL removes the premature direct phase call and refuses phase initialization without an indicator.
- Multiplayer preference is covered by native rules tests; a real two-player match has not been performed.
- The repository was renamed to `UniverseMan12/fortnite-4-2-launcher`. The old URL redirects correctly, the pinned native artifact downloads under the new name with the same verified digest, and `main` remains at `fd5384cfc8da2fc327e448ed77f84c8687835515`.

The installer and portable build are unsigned alpha artifacts. Clean-machine installation/uninstallation remains untested. The storm HUD still has the approximately 1439-minute cosmetic timer. See [INFINITY_SHOWDOWN.md](INFINITY_SHOWDOWN.md) for game behavior and limits.

## Historical stable release — 0.3.1

## What is included

- `Fortnite-Launcher-0.3.1-x64-nsis.exe`: per-user Windows installer, with selectable install location.
- `Fortnite-Launcher-0.3.1-x64-portable.exe`: portable launcher; persistent data still lives in the user's AppData.
- `SHA256SUMS.txt`: release asset checksums.
- `RELEASE-NOTES.md`: short usage and compatibility notes.

The installer does not contain Fortnite game files, personal configuration, local profiles, logs or credentials. The backend is staged from its pinned Git revision, with the repository's patches and audited dependency lock. The game-server DLL is checked against dependencies.lock.json. The first-run workspace checks every bundled payload file before use. Login HTTP and XMPP remain bound to loopback.

## Validation performed

- 27 Node tests: game-folder/build detection; backend login/profile/XMPP; local and VPN matchmaking targets; cancellation and process cleanup; download integrity/retries; atomic server replacement; payload integrity/path traversal; first-player warmup regression.
- 6 desktop UI tests: navigation and mode selection, invalid paths/retry, isolated renderer, bounded external links, overlapping start rejection, immediate cancellation, artwork loading, reduced motion, current-page accessibility and all three pages at 940×700, 1200×820 and 1440×960. The hero description and launch button are checked for overlap.
- Packaged EXE with a fresh user-data directory: payload extraction, build detection, first-use component download, rejection of a public host IP, no renderer script errors.
- Previous 0.2.0 packaged EXE with the local Fortnite 4.2 installation: starts the real backend and game-server helper, reaches Reboot playlist settings, then stops the session through the launcher. The 0.3.1 redesign preserves that session coordinator; this real-game check was not repeated for the visual update.
- Portable EXE: self-extraction, initial UI, bundled artwork decoding, verified payload bootstrap, invalid-folder recovery and closing the application.
- The owner previously confirmed successful 4.2 island entry after the multiplayer warmup fix.

Tests cover the stated scenarios, not every possible bug. A full two-PC Hamachi match through this GUI and installation/uninstallation on a clean Windows VM have not been verified. Server-side practice tools and Thanos retain their existing compatibility limits.

## Dependency review

The backend's older packages produced seven audit findings, including one critical finding. Dependencies were updated and UUID generation moved to Node's built-in crypto API. The updated backend lock reports **zero npm audit findings** at the time of this release. The desktop application has no additional production npm dependencies; Electron's version is pinned.

The build-tool dependency tree still reports **15 moderate findings** involving minimatch and its dependents. These packages are development-only and are not included in the launcher runtime. No unsupported forced downgrade was applied. npm audit does not audit native DLL behavior and does not establish complete safety.

## Known limitations

- Windows x64 and Fortnite 4.2 only; game files and Visual C++ runtime are separate.
- Executables are unsigned; no signing certificate or publisher identity has been configured.
- First component preparation needs internet access. No automatic update service is installed.
- Multiplayer requires an existing private VPN/LAN connection and a host firewall allowing UDP 7777 from peers. No public account system, lobby parties or shared progression.
- Do not run the CMD launcher and GUI launcher simultaneously: they use the same fixed local ports. Conflicts are shown as errors, without stopping unrelated services.
- Closing or stopping the launcher ends its own game session. Runtime data is retained across uninstall/reinstall.

## Reproduce and publish

On Windows with Node.js 22+ and Git:

```powershell
npm ci
npm run setup
npm run package:release
node scripts/smoke-release.mjs
node scripts/smoke-portable.mjs
node scripts/release-files.mjs
```

Upload the two EXEs, SHA256SUMS.txt and RELEASE-NOTES.md from `dist/` to a GitHub release. Do not upload runtime/, vendor/, personal config, logs, or the unpacked development folder. The GitHub **Build desktop launcher** workflow performs the same build and publishes a downloadable artifact; it does not automatically publish a GitHub release.
