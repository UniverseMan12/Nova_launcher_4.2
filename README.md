> **Latest stable release: [NOVA DROP 0.4.4](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/tag/v0.4.4).** Corrected sprinting, Thanos transformations and full resets, with more reliable startup and updates. See [release notes](RELEASE_NOTES.md) and [test results](RELEASE_QA.md). The faulty 0.4.3 release was withdrawn.

# NOVA DROP - Fortnite 4.2 Launcher

<img src="docs/thanos-dancing.gif" width="360" alt="Thanos dancing">

![NOVA DROP with Classic, Thanos and Infinity Showdown](docs/launcher-preview.png)

*NOVA DROP 0.4.4, with the shared Thanos selector, clearer settings and update changelog.*

## Controls and updates in 0.4.4

**Settings → Auto-Sprint (Beta)** makes you sprint while holding W, without holding Shift. It is off by default and takes effect on the next game launch. Manual sprint and Auto-Sprint passed the owner's latest playtest, including repeated stopping/starting and gliding. A warning remains before each enable because this is a beta feature; **Keep it off** or Escape leaves it disabled. Earlier enabled settings without acknowledgement return to off.

Auto-Sprint keeps W for movement and reserves F12 for its separate sprint action. Conflicting custom F12 bindings prevent activation. Disabling the beta restores the prior sprint binding and toggle preference.

Your selected outfit, backpack, pickaxe, glider and emotes are saved outside the version-specific launcher files. The first updated launch imports your previous locker choices. Only cosmetics present in the installed Fortnite 4.2 game can be rendered.

After updating, **What’s new** appears once with the changes for the installed version. Close it with **Let’s play**, the close button or Escape; reopen it from the sidebar at any time.

![The update changelog, with rounded corners and a blurred launcher behind it](docs/launcher-changelog.png)

Automated checks cover launcher settings, updates, cancellation and layouts. The owner also confirmed selected cosmetics, normal sprinting/gliding, Thanos transformation and two complete resets. HUD Scale → Apply succeeded in the latest test. See [validation and remaining limits](RELEASE_QA.md), including the outstanding two-player comparison.

## Download the game in the launcher

On **Play**, the main button says **Download Fortnite 4.2** when no game folder is selected. Click it and choose an installation location. Progress and **Cancel installation** stay on the Play screen. The launcher downloads the owner-provided 8.3 GiB archive, verifies its pinned SHA-256 checksum, extracts only the game files and automatically finds and selects the folder containing **FortniteGame** and **Engine**. The main button then becomes **Launch Fortnite** (or Host & play / Join friend). Already installed? Use **Choose folder** directly below the main controls. Allow about **32 GiB free space** during installation; the downloaded archive is removed after success.

You can cancel at any stage. Choose the same location to resume the downloaded bytes; interrupted extraction starts again from the verified archive. Existing installations are never overwritten. If Google Drive's quota or sharing prevents downloading, retry later or select your existing game folder. No Google login, Git, Node.js or separate 7-Zip installation is required by the EXE.

The built-in download targets **4.2 / CL-4072250** only. It does not install or run the extra Epic launcher/redistributable installers found in the source archive. The Visual C++ x64 runtime is still a separate prerequisite.

## Choose your game

- **Classic:** the normal island and practice tools.
- **Thanos:** choose **Thanos normal** under the shared Thanos card for the ordinary Infinity Gauntlet playlist on the full island. No fixed Showdown arena or additional Showdown respawns.
- **Infinity Showdown:** choose this option under the same Thanos card for a compact fixed arena, randomly assigned Thanos, retained equipment and ten extra respawns. After Thanos dies, a shared 20-second cooldown precedes the next random draw. Every eligible player can be selected, including the previous Thanos once ready.

The selected mode is preselected in Reboot; click **Start server**, then **Play** in Fortnite. Friends joining your session use the host's rules.

## Launcher and multiplayer

The launcher includes a simpler Play screen, a teal orbit logo and startup animation, locally bundled Season 4 artwork, saved setup choices and copy/paste invitations for private multiplayer. Component preparation runs automatically at launch; manual checks are under **Settings → Repair and diagnostics**. Friends still need the same LAN or private VPN, such as Hamachi or Radmin VPN. See [release notes](RELEASE_NOTES.md) and [current QA](RELEASE_QA.md).

## Infinity Showdown

The host can start a small late-game arena with a random Thanos, ten additional respawns per player, retained equipment and a starter kit with 999 materials/ammo. Friends join the host's VPN as before. See [the mode guide](INFINITY_SHOWDOWN.md) for setup, exact rules and in-game testing limits. The new 20-second death-to-reselection flow has automated coverage; a multiplayer playtest of that specific change is still pending.

A launcher for Fortnite 4.2, with local play and private VPN/LAN multiplayer using **LawinServer** and components from **Project Reboot**.

## Desktop launcher

The desktop launcher has Season 4 and Thanos banners and a prominent launch button. Choose **Solo / Host friends / Join friend**, select your game folder, and let the launcher prepare its components. Settings, live activity, host invitations and **Stop session** remain easy to reach. Reduced-motion preferences are respected. Closing the launcher also stops its owned game processes. The existing CMD launchers remain available.

For **0.4.4**, choose **[NOVA-DROP-0.4.4-x64-nsis.exe](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/download/v0.4.4/NOVA-DROP-0.4.4-x64-nsis.exe)** to install, or **[NOVA-DROP-0.4.4-x64-portable.exe](https://github.com/UniverseMan12/Nova_launcher_4.2/releases/download/v0.4.4/NOVA-DROP-0.4.4-x64-portable.exe)** to run without installing. Existing 0.4.2/0.4.3 users can use **Launcher updates → Download update → Update and restart**. Earlier releases remain on the [Releases page](https://github.com/UniverseMan12/Nova_launcher_4.2/releases), except the withdrawn 0.4.3 release.

1. Open **Play** and click **Download Fortnite 4.2**, or use **Choose folder** if you already have the game. The downloaded installation is selected automatically; an existing installation should contain FortniteGame and Engine.
2. Choose **Solo**, **Host friends**, or **Join friend**. Join accepts the host's invitation or VPN/LAN IPv4 address.
3. Click **Launch Fortnite**. Components are prepared automatically. First use needs internet access.
4. When hosting, Reboot opens with the selected mode already set. Click **Start server**, then press **Play** in Fortnite. Start **Bus Countdown** when everyone is on the island.

**EXE requirements:** Windows 10/11 x64, Fortnite 4.2 files, and the [Visual C++ x64 runtime](https://aka.ms/vc14/vc_redist.x64.exe). **Node.js and Git are not needed by EXE users**: Electron supplies the JavaScript runtime and the backend source/dependencies are included. Some pinned upstream DLLs download directly on first use. Game files and Hamachi are separate. Settings and runtime data live under `%APPDATA%/FortniteLauncher`, so the install directory can remain read-only. The portable EXE also uses this per-user data directory.

The release executables are **unsigned**. See [release checks and known limits](RELEASE_QA.md) before distributing them. The 0.4.2 update feature verifies the download size and SHA-256 against the GitHub release; it is not a publisher signature. The launcher does not modify the firewall.

## Launcher updates — available from 0.4.2

Open **Launcher updates** in the sidebar to check whenever you want. The launcher also checks at startup; switch off **Check when the launcher starts** if you prefer manual checks. An available update appears above Play. Choose **Download update**, then **Update and restart** when ready, or **Later** to keep playing. Downloads can be cancelled and a completed, verified package can be installed later.

Both the Windows installer and portable edition update in place. Settings, the selected Fortnite folder and game files are retained. Installation waits for you to stop any active game session or game download. The portable update keeps a backup of the previous EXE beside the launcher. The updater downloads the full launcher package; it does not download Fortnite again.

Version 0.4.1 and older need one manual upgrade to an updater-enabled build. Future versions still need to be built and published as regular GitHub releases, with both EXEs and **SHA256SUMS.txt**. Only newer regular releases from this repository are offered; prereleases are excluded. No background update service is installed. Source and unpacked development builds do not replace themselves.

Version 0.4.4 rechecks the current release and checksum before installing a cached update, so a withdrawn or replaced offer cannot be installed from stale metadata. That final check needs an internet connection; a failed check keeps the current launcher and cached download. The updater never silently downgrades an installation.

## Installation & downloads

For the **source/CMD launchers**, use a **Windows 10/11 x64** PC with internet access for the first setup. Install the requirements below once; skip anything already installed. Desktop EXE users do not need Node.js or Git.

| Download | What to choose / install |
| --- | --- |
| **[Node.js](https://nodejs.org/en/download)** | Windows **x64 Installer (.msi)**, version **22 or newer**. Keep npm and Add to PATH enabled. The launcher is tested with Node.js 22. |
| **[Git for Windows](https://git-scm.com/install/windows)** | **x64 Setup**. Keep Git available from the command line; the launcher uses it to download the backend. |
| **[Microsoft Visual C++ Runtime — x64](https://aka.ms/vc14/vc_redist.x64.exe)** | Run the installer and choose Install or Repair if needed. [Microsoft download information](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist). |
| **[Fortnite 4.2 — Google Drive](https://drive.google.com/file/d/1m8VEUcKnxA0UYHt5-txPbRhfbn0OVhEm/view?usp=sharing)** | Download and fully extract the game. Link supplied by the project owner. |
| **[Launcher 0.4.4 — Download source ZIP](https://github.com/UniverseMan12/Nova_launcher_4.2/archive/refs/tags/v0.4.4.zip)** | Extract the tagged stable source, then open the folder containing **START.cmd**. |
| [Hamachi](https://vpn.net/) — for multiplayer over the internet | Install on every player's PC and join the same private network. An existing Radmin VPN connection or the same LAN also works with the launcher. |
| [7-Zip](https://www.7-zip.org/download.html) — optional | Choose **64-bit Windows x64** if you need an extractor for the game archive. |
| [DirectX legacy runtime](https://www.microsoft.com/en-us/download/details.aspx?id=35) — if needed | Install if the game reports missing legacy DirectX files such as **XINPUT1_3.dll** or **D3DX9_43.dll**. |

**First-time setup:** install Node.js, Git and the Visual C++ runtime, then extract both downloads into separate folders. Close any old launcher window after installing the requirements. Open **START.cmd** from the extracted launcher folder and follow the steps below.

The backend and Reboot components are downloaded automatically on first launch. Windows PowerShell is used by the launcher and is included with Windows. Keep enough free disk space for the game archive and its extracted files, and enough RAM to run the host and client together.

## Start

1. Open **START.cmd**.
2. Paste the folder containing **FortniteGame** and **Engine**, then press **Enter**.
3. In **Project Reboot**, choose **Solo** or **Thanos (experimental)** and click **Start server**. There is no countdown.
4. Wait for Fortnite to open, then press **Play** in the lobby. Keep the launcher and Reboot windows open.

The command prompt asks only for the folder, without showing a saved personal path. Green checkmarks mean a step completed, yellow dots mean startup is in progress, and red crosses indicate errors. The launcher detects the build, prepares components and opens Fortnite after you start the host. Press **Ctrl+C** in the launcher to stop the session.

The host runs a separate Fortnite process. Its unused Unreal game window is hidden. Reboot's playlist selection remains open until you click **Start server**, even if you take several minutes. Restart the launcher to change the playlist after the server has started.

**Thanos is experimental:** the preset selects the Carmine playlist and checks that the asset exists. It does not guarantee that the Infinity Gauntlet, abilities or complete match rules work in this server implementation.

```text
Folder you select/
├── Engine/
└── FortniteGame/
    ├── Binaries/Win64/FortniteClient-Win64-Shipping.exe
    └── Content/Paks/*.pak
```

Selecting either subfolder also works: the launcher finds the common parent automatically. No Epic credentials or player-name entry are needed.

**Compatibility:** Automatic startup is currently limited to Fortnite **4.2**. Login, the lobby and F8 were tested with **CL-4072250**; the project owner also reports successful local gameplay. This launcher does not support every Fortnite version.

## Multiplayer with friends

Use the same **Fortnite 4.2 CL-4072250** build and the latest launcher on every PC.

1. Install **[Hamachi](https://vpn.net/)** on each PC. The host creates a private network; friends join it with its network ID and password. Keep Hamachi connected. On the same LAN, skip this step.
2. **Host:** open **HOST.cmd** and enter the game folder.
3. In Reboot, choose the playlist and click **Start server**. Players can load onto the island immediately, even when only the host has joined.
4. Wait for **Server listening** and **Joinable: true** in Reboot. Give friends your Hamachi **IPv4** address, also listed next to the Hamachi adapter in the launcher.
5. **Friends:** open **JOIN.cmd**, enter their own game folder, then the host's VPN IPv4 address. No port or `http://` prefix is needed. Guests do not start another game server.
6. Everyone presses **Play** in their lobby. Keep the launchers and VPN open. The host must stay connected for the match to continue.

Wait for your friends on the island, then click **Start Bus Countdown** in Reboot to begin the round. The old minimum-player setting was removed: in Fortnite 4.2 it could block creation of the first player's character and leave them behind the loading screen.

Each installation gets a persistent, distinct player name automatically. Download a fresh launcher ZIP for friends; do not copy your config.local.json to their PC. If it was copied, remove just the `multiplayerName` field from their config.local.json before restarting to generate a new identity.

If Play returns to the lobby, check that the host is still joinable and the round has not already started or ended. In the guest's **F8** console you can also enter `open HOST_IP:7777`, replacing `HOST_IP` with the host's VPN address. The host uses `open 127.0.0.1:7777`.

**Connection troubleshooting:** the host's Windows firewall must allow the game EXE to receive **UDP 7777** from your friends' VPN addresses, on the network profile used by the VPN adapter. In Windows Defender Firewall with Advanced Security, create an inbound Custom rule for `FortniteClient-Win64-Shipping.exe`, UDP local port 7777, scoped to those remote addresses. Do not disable the firewall. No router port forwarding is needed for peers already connected through the VPN. The launcher does not change firewall rules automatically.

The HTTP login backend and XMPP stay on each player's own PC; only game traffic goes to the host. Inventory/profile changes remain local. This provides a shared game server, without shared Epic friends lists, lobby parties or public matchmaking. Guests need their own launcher requirements but only run one Fortnite process.

The host's **Local tools** continue to target the host player. Practice respawn starts **off** in HOST.cmd so normal eliminations can finish a multiplayer match; you can enable it in Reboot for practice. Guests do not receive automatic operator permissions. Keep **Private IPs are operator** off unless you deliberately want to grant those permissions.

Automated checks cover separate player identities, VPN matchmaking addresses, guest startup/cleanup and switching back to local play. The owner reported successful two-player Hamachi gameplay on an earlier build; remote cosmetics and Showdown's death/reselection flow have not been retested with two players in 0.4.4. **START.cmd** still starts local play.

## Local tools

After the server starts, open **Local tools** at the top of the Reboot window. Join your match before using the buttons. Controls are grouped into **Player**, **Items** and **Building & ammo** tabs. The connection indicator shows whether your player is available.

| Control | Effect |
| --- | --- |
| Respawn me | Creates a new pawn at your saved spot, or near your previous position, with full health and shield. |
| Heal + shield | Restores health and shield to at least 100 while alive, without reducing higher values. |
| Auto-heal | Restores health and shield every half second; does not prevent instant death. |
| Save my spot / Return to spot | Saves one position for this session, then teleports back when the location is clear. Also sets your respawn point. |
| Clear spot | Returns respawning to your previous position. |
| Infinity Gauntlet | Spawns the 4.2 Carmine gadget for you to pick up. Requires Enable AGIDs; transformation remains experimental. |
| Item selection | Choose from ten items, including SCAR, pump shotgun, sniper, rocket launcher, shields, medkits and bandages. Consumable stack sizes are bounded. |
| Spawn chest loot | Drops a random chest's loot in front of you. |
| Give starter kit | Adds an assault rifle, shotgun, ammunition and materials. |
| Refill materials / ammo | Replenishes supplies once. |
| Clear player builds | Removes player-built structures; keeps map buildings. |
| Clear spawned loot | Removes only pickups created by these local tools; keeps map loot and items already collected. |
| Infinite ammo / materials | Replenishes supplies every half second, including the equipped weapon's magazine. |

**Practice respawn** is enabled by default in START.cmd (disabled by default in HOST.cmd). It keeps your inventory and prevents your local death from ending the round, so you can click **Respawn me** after dying. Turn it off for normal elimination behavior. It cannot reopen a match that has already ended. Respawning as Thanos or preserving special transformations is not guaranteed.

These controls require exactly one loopback-connected player. Spawned pickups are limited to 100 outstanding items, and actions are rate-limited to avoid accidental click spam. Saved positions reset when you leave. You can also press F8 and enter:

```text
cheat local reset
cheat local clearinventory
cheat local respawn
cheat local heal
cheat local loot
cheat local kit
cheat local gauntlet
cheat local save
cheat local return
cheat local forget
cheat local clearloot
cheat local status
cheat local materials
cheat local ammo
cheat local clearbuilds
cheat local infiniteammo on
cheat local infinitematerials on
cheat local practice on
cheat local autoheal on
```

Use `off` instead of `on` to disable a toggle. The message under the buttons reports the result or explains why an action is unavailable. These are local practice tools; they do not add support for other game versions.

Validation on 4.2: server startup, joining through Play, the new tabs, Gauntlet spawning, chest loot, cleanup of tool-spawned pickups, saving/returning to a position and pawn replacement were exercised in a local session. The starter-kit action also returned both weapons and supplies. Full respawn after a real elimination and complete Thanos transformation/abilities still need verification.

**Full reset (exit Thanos)** removes the Gauntlet, restores your normal character and spawns a fresh pawn with 100 health and 100 shield. It clears weapons, supplies and materials while keeping the pickaxe and building tools, and turns automatic refills off. **Clear inventory** clears the same items; if transformed, it also exits Thanos through a fresh respawn. **Respawn me** keeps ordinary equipment but removes the transformation. These tools target your loopback-connected player in Classic/ordinary Thanos; Infinity Showdown retains its own respawn rules. A match that has already ended must be restarted. Enable **Practice respawn** before dying in a sandbox session.

Resets and teleports keep characters upright and restore compatible body parts. The owner confirmed two consecutive transformations and full resets with the chosen skin, normal body posture and movement, and no remaining Gauntlet.

## Setup details

Download links and installation requirements are listed [above](#installation--downloads). Game files are separate from this repository.

First-time setup needs internet and may take a few minutes. Pinned components are downloaded automatically, with size limits, checksum verification and retries for temporary network failures. Interrupted or invalid downloads keep existing files intact. Server replacement is atomic and saves the previous DLL as runtime/reboot.previous.dll. Later starts reuse installed components. The host and client run as two game processes, so allow enough RAM for both. Local matches do not automatically contain other players or bots.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Missing FortniteGame or Engine | Select the folder containing both folders. |
| Version cannot be detected or is unsupported | Use a complete 4.2 installation. Detection reads the EXE, not the folder name. |
| Node.js is missing | Install Node.js 22 or newer and reopen START.cmd. |
| Git is missing | Install [Git for Windows](https://git-scm.com/install/windows) with command-line support, then reopen START.cmd. |
| VCRUNTIME140.dll or MSVCP140.dll is missing | Install or repair the [Visual C++ x64 runtime](https://aka.ms/vc14/vc_redist.x64.exe). |
| Port 80, 3551 or 7777 is occupied | Close your other backend or host instance. Unrelated services are not stopped automatically. |
| Setup fails | Read logs/setup.log and the error shown in the launcher. |
| Server update fails | Close the running Fortnite session, then reopen START.cmd. |
| Item or Gauntlet does not spawn | Read the message under Local tools. For the Gauntlet, keep Enable AGIDs checked. |
| Respawn cannot continue an ended match | Start a fresh round with Practice respawn enabled before dying. |
| Server does not start | Read logs/server-helper.log. The client will not open if host startup fails. |
| Fortnite does not open | Read logs/client-helper.log and logs/backend.log. |
| Play returns to the lobby | Check the Reboot window for Joinable: true and check the helper logs for a host failure. |
| A download has expired | Review a replacement build and update dependencies.lock.json with its checksum. |

If the host shows **Joinable: true**, you can also press **F8** in Fortnite and enter **open 127.0.0.1:7777**. This connects to the existing host; it cannot start a missing server. If Medal also uses F8, its clip notification may appear.

Detailed output is saved in logs/ instead of filling the launcher. Game-log paths are recorded in the helper logs. Fortnite 4.2 uses the shared `%LOCALAPPDATA%\FortniteGame\Saved` directory. Before launch, the launcher backs up and repairs a mismatched borderless startup resolution in the actual settings file. It asks you to close other Fortnite windows if that repair is needed. Shared logs are accepted only when their command line matches the current launch. HUD Scale → Apply succeeded in the latest owner test; the earlier crash's exact cause remains unproven.

## Developer commands

```powershell
npm start                  # Launcher
node src/cli.js --host      # Host a VPN/LAN match
node src/cli.js --join      # Join a VPN/LAN host
node src/cli.js --check     # Check a selected folder without starting services
node src/cli.js --help      # Short help
npm run doctor             # Check saved installation and DLL hashes
npm run setup              # Install components with detailed output
npm run backend            # Backend only; Ctrl+C stops it
npm test                   # Validation, startup coordination and backend tests
```

Settings are stored in config.local.json. The player name defaults to Player; an existing valid name is preserved. Build identification uses embedded release strings rather than a manually entered version.

The coordinator waits for backend HTTP/XMPP readiness, the user's Start server action, and then UDP port 7777 owned by its host process. Private per-session marker files connect the Reboot settings UI to the launcher. There is no timeout while choosing a playlist; login and server startup still have time limits. It closes its processes on startup failure, client exit or Ctrl+C. Automated orchestration tests cover readiness, failure and cancellation.

GitHub Actions runs launcher and backend tests on Windows for code changes. Download tests cover interrupted transfers, HTTP errors, checksum mismatches, size limits and cancellation. Installer tests verify that invalid archives preserve the old DLL and successful replacement creates its backup.

HTTP backend: http://127.0.0.1:3551. XMPP/matchmaker: 127.0.0.1:80. Both bind only to loopback on every PC. The game target is 127.0.0.1:7777 for the host and the entered VPN/LAN IPv4:7777 for guests, over UDP. Reboot listens on all interfaces; use Windows firewall scope to control access. No firewall rules, hosts-file entries or system certificates are changed. The guest target is passed to the backend for that process only; a later local launch returns to loopback automatically.

The launcher loads Reboot components into its own game processes. Windows job objects close those game and companion processes when their helper exits. Existing game EXEs are not patched or replaced. Legacy companion processes remain suspended.

LawinServer V1 remains a local single-user emulator on each PC. Multiplayer shares the Reboot game server, not backend profiles. Items, levels and V-Bucks are local test data.

## Project files

- src/: launcher, validation and process management.
- scripts/: setup, backend adaptations and Windows game startup.
- server/: game-thread actions and Reboot UI for local practice tools.
- tests/: installation, orchestration and backend integration checks.
- dependencies.lock.json: pinned sources and DLL hashes.
- [THIRD_PARTY.md](THIRD_PARTY.md): upstream sources, licenses and references.

vendor/, runtime/, logs/, data/, personal settings and game files are excluded from GitHub. Backend profiles remain in vendor/LawinServer or %LOCALAPPDATA%\LawinServer. Upstream licenses remain in downloaded source.

## Contributors and credits

- **[UniverseMan12](https://github.com/UniverseMan12)** — project owner, requirements and local testing.
- **OpenAI Codex (AI assistant)** — assisted implementation, debugging, tests.
- **LawinServer and Project Reboot contributors** — upstream backend, game server and runtime components. See [THIRD_PARTY.md](THIRD_PARTY.md).
