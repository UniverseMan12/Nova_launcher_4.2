# NOVA DROP 0.4.4

Regular Windows x64 update for Fortnite 4.2, with corrected movement, Thanos resets and launcher startup. This replaces the withdrawn 0.4.3 release.

## Gameplay fixes

- **Smooth sprinting:** restored the Fortnite 4.2 server ability path used by normal sprint and Thanos. The owner confirmed W + Shift works normally again after repeated stops and starts.
- **Auto-Sprint (Beta):** sprint while holding W without Shift. The corrected version passed the owner's movement and gliding test. It remains off by default, with a warning before enabling it under Settings; restart Fortnite after changing it. Custom F12 conflicts are detected, and turning it off restores the prior sprint preferences.
- **Thanos transformation and full reset:** normal transformation works again. Full reset restores the chosen character with upright posture, normal movement and no remaining Gauntlet. Two consecutive resets passed the owner test. Clear inventory and practice respawn remain available in Reboot's player tools.
- **Saved locker:** selected outfits, backpacks, pickaxes, gliders and emotes persist across launcher versions. Black Knight and the selected lightning glider were confirmed in the match. Remote players keep their own cosmetics.
- **Respawn scoring:** handled practice/Showdown respawns retain kill credit once per pawn life. Showdown keeps its 20-second delay before randomly selecting from all ready players, including the previous Thanos.

## Launcher fixes and improvements

- Fixed portable relaunch cleanup that could remove files from an already-running launcher and cause the session helper to stop.
- Restored game-server startup and detection of the current Fortnite log. Unexpected game exits report an error; an optional Auto-Sprint helper failure leaves the game running with normal controls.
- Saved launcher settings use atomic writes, and write failures remain visible instead of showing a false success.
- Downloaded updates are checked again against GitHub before installation. Withdrawn or changed offers are rejected; failed online checks preserve the current launcher and cached download. Old installer markers no longer block startup after Windows reuses a process ID.
- Clearer selections, larger small text and restrained teal styling. Thanos normal and Infinity Showdown share one card; choosing Showdown keeps the selected Solo/Host session type.
- A rounded changelog appears after updating, with the launcher blurred behind it. Reopen it through **What's new** in the sidebar.

## Get the update

In 0.4.2 or 0.4.3, open **Launcher updates → Download update → Update and restart** after stopping the game session. Settings and the Fortnite installation are retained. Version 0.4.1 and older need a manual upgrade once.

- **NOVA-DROP-0.4.4-x64-nsis.exe:** Windows installer.
- **NOVA-DROP-0.4.4-x64-portable.exe:** run without installing.
- **SHA256SUMS.txt:** checksums for both executables. Tagged source is available below.

## Validation and known limits

The owner confirmed lobby/island startup, selected skin and glider, normal movement, Auto-Sprint, gliding, Thanos transformation and two full resets. HUD Scale → Apply also succeeded in the latest test; the exact cause of the earlier crash is not proven.

Automated validation covers 91 code/helper checks, 19 desktop UI tests, native compilation and two C++ rule suites, packaged startup, repeated portable launches, and real 0.4.2 → 0.4.4 upgrades for both installer and portable editions. Detailed build provenance is recorded in [RELEASE_QA.md](https://github.com/UniverseMan12/Nova_launcher_4.2/blob/main/RELEASE_QA.md).

Two-player remote cosmetics and Showdown's death/reselection flow have not been retested in this version. Earlier Hamachi multiplayer worked; friends still need the same LAN or private VPN. Auto-Sprint remains Beta, ordinary Thanos remains experimental, and the executables are unsigned. The separate bot-lobby prototype is not included.
