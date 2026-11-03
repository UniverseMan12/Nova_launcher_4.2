# NOVA DROP 0.4.3 — your next drop, a little better

Regular Windows x64 update for Fortnite 4.2 / CL-4072250, based on 0.4.2. The separate bot-lobby prototype is not included.

## New

- **Auto-Sprint** in Settings: sprint while holding W. Applies on the next launch; switching it off restores the previous sprint controls.
- **Full reset (exit Thanos)** and **Clear inventory** in Reboot, with visible console instructions: `cheat local reset`, `cheat local clearinventory` and `cheat local respawn`.
- A single **Thanos** card using the previous Infinity Showdown image. Choose **Thanos normal** or **Infinity Showdown** underneath it.
- A changelog after updating, with rounded corners and a blurred backdrop. It appears once per update and can be reopened through **What’s new**.
- Larger supporting text, clearer controls and a restrained teal visual refresh.

## Fixes

- Reset removes the Gauntlet through its native unequip path, restores the original body before spawning and re-equips the pickaxe. Empty persistent gadget stacks no longer bypass removal.
- Reset actions avoid using a character pointer after Fortnite has replaced or destroyed it. Automatic supply refills are disabled when clearing inventory.
- Per-player cosmetic loadouts are requested and applied after loading; default character parts no longer overwrite existing parts. The pawn receives selected glider, contrail and other cosmetic references.
- Locker choices and selected variants persist outside version-specific launcher workspaces and migrate from a previous installation.
- Cloud settings metadata uses the exact downloaded binary bytes for length and checksums. Auto-Sprint preserves original sprint preferences on disk.

## Updating

From **0.4.2**, choose **Launcher updates → Check → Download update → Update and restart** after stopping the current session. Versions 0.4.1 and older need one manual upgrade using the installer or portable EXE. The Fortnite installation stays in place; launcher updates still transfer the complete launcher package.

Full reset and inventory tools apply to the local player in Classic/ordinary Thanos. Infinity Showdown keeps its established random selection, 20-second handover delay and respawn rules. Only cosmetics included in Fortnite 4.2 can be displayed.

## Validation

68 Node tests, 17 desktop UI tests, the native server build and Windows installer/portable checks passed. Both editions passed an actual update from the published 0.4.2 package, retaining settings and the selected game folder.

**Live Fortnite validation is still pending for Auto-Sprint, in-match cosmetics and repeated full resets.** The build and automated checks do not establish their behavior in a real match. See [the validation record](https://github.com/UniverseMan12/Nova_launcher_4.2/blob/v0.4.3/RELEASE_QA.md) for details.
