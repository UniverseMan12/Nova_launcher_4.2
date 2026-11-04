# NOVA DROP 0.4.5

Regular Windows x64 update fixing the launcher update handoff. Gameplay, the game server and the 0.4.4 sprint/Thanos/reset fixes are unchanged.

## Fixed

The old launcher could close after **Update and restart** without installing the download or reopening. Its update helper was tied to the closing process. The corrected helper runs independently, completes replacement and restarts NOVA DROP. Verification, cancellation and backup protections remain in place.

The regression test now exits the process that actually starts the helper. The previous upgrade test kept that process alive, so its success did not establish that the in-app handoff worked.

## Install this correction once

**Versions 0.4.2–0.4.4 need one manual upgrade**, because the fault is in their existing updater. Download the appropriate file below and close the old launcher:

- **NOVA-DROP-0.4.5-x64-nsis.exe:** run it to update an installed launcher.
- **NOVA-DROP-0.4.5-x64-portable.exe:** replace your old portable EXE and start this one.

Your saved settings, Fortnite folder and game installation are retained. Later updates use **Launcher updates → Download update → Update and restart**. The updater still downloads a complete launcher package, not the game.

Detailed verification is recorded in [RELEASE_QA.md](https://github.com/UniverseMan12/Nova_launcher_4.2/blob/main/RELEASE_QA.md). Auto-Sprint remains Beta; the previous multiplayer testing limits remain unchanged. The bot-lobby prototype is not included.
