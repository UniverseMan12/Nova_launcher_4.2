import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { patchLocalTools } from './patch-local-tools.js';
import { patchInfinity } from './patch-infinity.js';
import { patchGameplay } from './patch-gameplay.js';

export function fixWarmupAdmission(source) {
  // In 4.2 this gates initial pawn creation, not just the bus countdown.
  source = source.replace('WarmupRequiredPlayerCount = 2;', 'WarmupRequiredPlayerCount = 1;');
  return source.replaceAll('ImGui::SliderInt("Players required to start the match", &WarmupRequiredPlayerCount, 1, 100);',
    'ImGui::TextUnformatted("Players load in immediately. Start Bus Countdown when everyone is ready.");');
}

export function patchReboot(root) {
  const dir = path.join(root, 'Project Reboot 3.0');
  const update = (file, transform) => {
    const target = path.join(dir, file);
    const old = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (old.includes('// Launcher manual startup')) return;
    fs.writeFileSync(target, '// Launcher manual startup\n' + transform(old));
  };
  const replace = (source, before, after) => {
    if (source.split(before).length !== 2) throw new Error('Pinned Reboot source does not match: ' + before.slice(0, 60));
    return source.replace(before, after);
  };
  update('gui.h', source => {
    source = replace(source, 'extern inline int SecondsUntilTravel = 5;',
      'extern inline std::atomic<bool> LauncherStartRequested(false);\n' +
      'static inline void LauncherSignal(const char* name) {\n' +
      '    char directory[32768];\n' +
      '    DWORD length = GetEnvironmentVariableA("FORTNITE_LAUNCHER_SIGNALS", directory, sizeof(directory));\n' +
      '    if (length > 0 && length < sizeof(directory)) std::ofstream(std::string(directory) + "/" + name) << "ready";\n' +
      '}');
    source = replace(source,
      '\t\tImGui::SliderInt("Seconds until load into map", &SecondsUntilTravel, 1, 100);',
      '\t\tImGui::TextUnformatted("Choose a playlist, then click Start server. No countdown.");');
    source = replace(source,
      '\tif (!Globals::bCreative)\n\t\tImGui::InputText("Playlist", &PlaylistName);',
      '\tif (!LauncherStartRequested.load()) {\n' +
      '\t\tif (ImGui::Button("Solo")) PlaylistName = "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo";\n' +
      '\t\tImGui::SameLine();\n' +
      '\t\tif (ImGui::Button("Thanos (experimental)")) PlaylistName = "/Game/Athena/Playlists/Carmine/Playlist_Carmine.Playlist_Carmine";\n' +
      '\t\tImGui::InputText("Playlist", &PlaylistName);\n' +
      '\t\tstatic bool missingPlaylist = false;\n' +
      '\t\tif (ImGui::Button("Start server")) {\n' +
      '\t\t\tmissingPlaylist = FindObject<UObject>(PlaylistName) == nullptr;\n' +
      '\t\t\tif (!missingPlaylist) { LauncherSignal("server-started.flag"); LauncherStartRequested.store(true); }\n' +
      '\t\t}\n' +
      '\t\tif (missingPlaylist) ImGui::TextUnformatted("Playlist is not loaded in this build. Select another playlist.");\n' +
      '\t} else { ImGui::TextUnformatted("Starting server..."); }');
    return replace(source, '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);',
      '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);\n\tLauncherSignal("server-settings.flag");');
  });
  update('dllmain.cpp', source => replace(source,
    '    while (SecondsUntilTravel > 0)\n    {\n        SecondsUntilTravel -= 1;\n\n        Sleep(1000);\n    }',
    '    while (!LauncherStartRequested.load()) Sleep(100);'));
  patchLocalTools(root);
  // Multiplayer defaults are applied once before the user configures the server.
  const multiplayerUpdate = (file, before, after) => {
    const target = path.join(dir, file);
    const source = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (source.includes(after)) return;
    fs.writeFileSync(target, replace(source, before, after));
  };
  // Run before creating the settings window, so the editable player count is visible.
  const guiPath = path.join(dir, 'gui.h');
  // The environment block was already installed by the previous launcher build.
  if (!fs.readFileSync(guiPath, 'utf8').includes('char multiplayerMode[2]')) multiplayerUpdate('gui.h', '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);',
    '\tchar multiplayerMode[2] = {};\n' +
    '\tif (GetEnvironmentVariableA("FORTNITE_LAUNCHER_MULTIPLAYER", multiplayerMode, sizeof(multiplayerMode)) == 1 && multiplayerMode[0] == \'1\') {\n' +
    '\t\tWarmupRequiredPlayerCount = 1;\n' +
    '\t\tLocalTools::PracticeRespawn.store(false);\n' +
    '\t}\n' +
    '\t::ShowWindow(hwnd, SW_SHOWDEFAULT);');
  fs.writeFileSync(guiPath, fixWarmupAdmission(fs.readFileSync(guiPath, 'utf8')));
  multiplayerUpdate('globals.h', 'bPrivateIPsAreOperator = true;', 'bPrivateIPsAreOperator = false;');
  multiplayerUpdate('commands.h',
    'IPStr == "127.0.0.1" || IPStr == "68.134.74.228" || IPStr == "26.66.97.190" || IsOp(PlayerController)',
    'IPStr == "127.0.0.1" || IPStr.rfind("127.0.0.1:", 0) == 0 || IsOp(PlayerController)');
  patchInfinity(root);
  patchGameplay(root);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw new Error('Pass the pinned Reboot source directory.');
  patchReboot(path.resolve(process.argv[2]));
}
