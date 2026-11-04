# NOVA DROP 0.4.4 — corrective test candidate

**Not a published stable release.** The faulty 0.4.3 GitHub release was removed on November 4, 2026; [0.4.2 remains the latest stable download](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/tag/v0.4.2). Earlier 0.4.4 tests still had movement problems. The HUD Scale / Apply crash remains unresolved.

## Changes in this candidate

- **Auto-Sprint is explicitly Beta and off by default.** Enabling it requires a warning acknowledgement each time it is turned on. Older enabled profiles without that acknowledgement return to off. Cancel, Escape or a failed settings save leaves it off. The warning names the reported moonwalking, slow movement and airborne shaking.
- The sprint helper keeps W as movement and uses a separate F12 action. F6 already belongs to Fortnite 4.2 picker/hotbar controls, so it is no longer used. Custom F12 conflicts prevent activation; disabling the beta restores the previous sprint binding and toggle preference. This correction still needs an in-game test.
- Reset and saved-spot teleports use upright, yaw-only pawn rotations. Complete hero parts are resolved and checked together before changing the character. The last valid normal-appearance snapshot survives incomplete loads or repeated gadget equips, and stale possession acknowledgements cannot overwrite the new pawn. Native inventory cleanup verifies that the Gauntlet was removed. Repeated Thanos/reset behavior remains unconfirmed in-game.
- Kills during Showdown/practice respawns now retain the native score and kill notification once per pawn life. Repeated death callbacks do not award again; final eliminations keep native bookkeeping. Full reset no longer replaces a shield-restoration warning with an unconditional success message. Reboot explicitly shows the 20-second Thanos reselection delay.
- The client and headless host prepare separate persistent Fortnite 4.2 settings directories. Only compatible display preferences are imported from the old shared file. Existing isolated settings and the original shared file are retained. The launch command passes `-UserDir`; the game's actual directory selection and any effect on the HUD Apply crash are still unverified.
- Cached launcher updates are revalidated against the current release and checksum before installation. Withdrawn or changed offers are rejected. A failed check preserves the running launcher and cached download; it does not silently downgrade to an older release. A stale installer marker cannot block startup merely because Windows reused its process ID.
- Launcher settings are saved atomically. Preference/log write failures remain visible and stop the pending operation instead of crashing the launcher or being replaced by a success message. Unexpected game exits are reported as errors; failure of the optional sprint helper leaves the game running with normal controls.
- Settings and selected modes are clearer, with restrained teal highlights and the existing larger text. Thanos normal and Infinity Showdown retain one shared card. Choosing Showdown no longer silently changes Solo into Host friends. The rounded, blurred changelog remains available after updates and from the sidebar.

The saved local locker, Clear inventory, practice respawn and Showdown's 20-second random reassignment among all ready players are retained. Remote players are never given the host's saved outfit. The separate bot-lobby prototype is not included.

## Verified so far

All **82 Node/native-helper checks** and **19 desktop UI tests passed**, both locally and in [final desktop build 41857658000](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41857658000) for source `b8d4f18`. Packaged and portable startup checks passed, as did real 0.4.2 → 0.4.4 updates for portable and installed editions, preserving settings and paths. UI coverage includes beta consent/migration, failed-save recovery, cancellation, mode selection and supported window sizes. The actual game-launch script was tested with harmless hidden children for normal/error exits and sprint-helper failure recovery. Native source `ccabd36` compiled in [build 41856450087](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41856450087), including both C++ rules suites. Downloaded EXEs and the native DLL match their recorded checksums. These results do not prove correct Fortnite animation, replication or HUD behavior; the owner playtest remains pending.

The owner's earlier video showed Black Knight, Cloud Strike and the selected pickaxe/contrail in the match. It also showed the remaining movement glitches and HUD Apply crash. With Auto-Sprint off, the owner reports normal movement.

## Owner playtest still required

1. Begin with **Auto-Sprint off** in Classic / Solo. Check the selected lobby outfit/glider, normal walking and gliding. Change HUD Scale and click Apply; report whether it crashes.
2. Transform into Thanos, use **Full reset (exit Thanos)**, then repeat. Check upright proportions, normal movement, restored cosmetics, health/shield and Clear inventory. Test Respawn me and saved-spot return too.
3. Only when ready to test the experimental feature, enable **Auto-Sprint (Beta)** and accept its warning, then restart Fortnite. Check repeated W start/stop, gliding, menus/console and switching away from the game. Turn it off and restart if movement glitches return.
4. In a separate two-player test, check each player's own cosmetics and Showdown death/respawn/reselection. Each kill should increase the killer's counter once, including a kill before the victim's final life. Verify that every ready player remains eligible after the shared 20-second delay.

No live Fortnite session was started or controlled by the agent for this audit. Current native/build provenance, historical evidence and outstanding checks are recorded in [RELEASE_QA.md](RELEASE_QA.md).
