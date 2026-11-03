# NOVA DROP 0.4.2 — launcher updates

Regular Windows x64 update for Fortnite 4.2 / CL-4072250. Based on the regular 0.4.1 release, with its teal orbit logo and existing gameplay. The separate bot-lobby prototype is not included.

## Update when you choose

- Checks for newer regular GitHub releases at startup. Automatic checks can be switched off.
- Adds a visible **Launcher updates** button and an update notification above Play.
- **Download update** shows progress and supports cancellation. **Later** lets you keep playing.
- **Update and restart** installs only when requested and after the current game session or game download has stopped.
- Supports both installed and portable launchers, preserving settings and the Fortnite folder.
- Checks the release source, package size and SHA-256 before installation. Corrupt or incomplete downloads leave the existing launcher in place.
- Keeps a backup when replacing the portable EXE and reports installation errors after restart.

Version 0.4.1 and older require one manual upgrade: run **NOVA-DROP-0.4.2-x64-nsis.exe** to update an installed copy, or use **NOVA-DROP-0.4.2-x64-portable.exe**. Later published releases can be downloaded and installed inside the launcher. Updates transfer the complete launcher package; Fortnite does not need to be downloaded again.

## Requirements and limits

Windows 10/11 x64 and the Visual C++ x64 runtime are required. Node.js and Git are not needed by EXE users. Fortnite game files remain separate. Friends need the same LAN or private VPN, such as Hamachi or Radmin VPN.

Executables remain unsigned. Updates require access to GitHub and write access to the launcher location; the normal per-user installer and a writable portable folder are supported. An update is never scheduled for unattended installation. GitHub checks can be delayed by rate limits or network outages.

Classic, ordinary Thanos and Infinity Showdown retain their existing behavior and limits. See [RELEASE_QA.md](https://github.com/UniverseMan12/Nova_launcher_4.2/blob/v0.4.2/RELEASE_QA.md) for the validation record.

## Validation

60 Node tests and 15 desktop UI tests passed. Real 0.4.1-to-0.4.2 upgrades passed for both the installed and portable editions on an isolated Windows runner, including restart, retained settings/game paths and folders with spaces and special characters. The EXEs are the unchanged, checksum-verified artifacts from [build 41681911937](https://github.com/UniverseMan12/Nova_launcher_4.2/actions/runs/41681911937).

The included `launcher-updates.png` demonstrates the update controls with a fictional 0.4.3 offer; the version released here is **0.4.2**.
