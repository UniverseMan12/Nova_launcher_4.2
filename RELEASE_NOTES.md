# NOVA DROP 0.4.1

Regular Windows x64 update for Fortnite 4.2 / CL-4072250.

## New launcher logo

- Replaces the meteor emblem with the owner's new transparent teal orbit-and-star logo.
- Uses the new artwork in the sidebar, startup screen, Windows application icon, installer and portable launcher.
- Matches the startup glow to the teal logo and refreshes the launcher preview.
- Updates the displayed version and download filenames to 0.4.1.
- Fixes the pinned server download address after the GitHub repository rename; the server file and its checksum remain the same.

This release builds on the regular 0.4.0 version. Classic, ordinary Thanos, Infinity Showdown, the game download on Play and private VPN/LAN multiplayer remain available. Existing settings and the saved game-folder location are kept. The separate bot-lobby prototype is not included in this logo update.

## Downloads

- **NOVA-DROP-0.4.1-x64-nsis.exe** — Windows installer.
- **NOVA-DROP-0.4.1-x64-portable.exe** — run without installing.
- **SHA256SUMS.txt** — executable checksums.
- **RELEASE-NOTES.md**, **launcher-preview.png** and **NOVA-DROP-logo.png**.

Use the installer to update an installed launcher, or download and run the new portable EXE. The launcher does not have an automatic updater.

Windows 10/11 x64 and the Visual C++ x64 runtime are required. Node.js and Git are not needed by EXE users. Fortnite game files remain a separate download. Friends need the same LAN or private VPN, such as Hamachi or Radmin VPN.

## Validation and known limits

This is a regular release, with GitHub's prerelease flag disabled. Build and package checks are recorded in [RELEASE_QA.md](https://github.com/UniverseMan12/Nova_launcher_4.2/blob/v0.4.1/RELEASE_QA.md).

The gameplay limits documented for 0.4.0 still apply: ordinary Thanos is experimental, the new 20-second Showdown reselection flow needs a multiplayer playtest, and the approximately 1439-minute Showdown timer is cosmetic. EXEs are unsigned; clean-machine installation/uninstallation is not fully tested. Game-download availability depends on the source host.
