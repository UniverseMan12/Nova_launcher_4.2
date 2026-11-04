import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function patchLocalTools(root) {
  const dir = path.join(root, 'Project Reboot 3.0');
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
  for (const name of ['LocalTools.h', 'LocalToolsAppearance.inl', 'LocalTools.inl', 'LocalToolsUI.inl', 'LocalToolsCatalog.h', 'LocalToolsCommands.inl', 'InfinityRules.h', 'InfinityShowdown.h', 'InfinityShowdown.inl', 'DeathCreditRules.h']) {
    fs.copyFileSync(path.join(source, name), path.join(dir, name));
  }
  const edit = (name, replacements) => {
    const file = path.join(dir, name);
    let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (text.includes('// Launcher local tools v1')) return;
    for (const [before, after] of replacements) {
      if (text.split(before).length !== 2) throw new Error('Pinned source does not match local-tools patch: ' + name);
      text = text.replace(before, after);
    }
    fs.writeFileSync(file, '// Launcher local tools v1\n' + text);
  };
  edit('gui.h', [
    ['#include "globals.h"', '#include "globals.h"\n#include "LocalTools.h"'],
    ['static inline void MainUI()\n{', '#include "LocalToolsUI.inl"\n\nstatic inline void MainUI()\n{\n\tLauncherLocalToolsUI();'],
    ['\tImGui::Checkbox("Infinite Ammo", &Globals::bInfiniteAmmo);', '\t// Local tools supply ammo as well as preserving it.'],
    ['\tImGui::Checkbox("Infinite Materials", &Globals::bInfiniteMaterials);', '\t// Local tools refill the client-visible material stacks.']
  ]);
  edit('NetDriver.cpp', [
    ['#include "gui.h"', '#include "gui.h"\n#include "LocalTools.inl"'],
    ['void UNetDriver::TickFlushHook(UNetDriver* NetDriver)\n{',
     'void UNetDriver::TickFlushHook(UNetDriver* NetDriver)\n{\n\tLocalTools::Tick(NetDriver);']
  ]);
  edit('FortPlayerController.cpp', [
    ['#include "gui.h"', '#include "gui.h"\n#include "LocalTools.h"'],
    ['void AFortPlayerController::ClientOnPawnDiedHook(AFortPlayerController* PlayerController, void* DeathReport)\n{',
     'void AFortPlayerController::ClientOnPawnDiedHook(AFortPlayerController* PlayerController, void* DeathReport)\n{\n\tif (LocalTools::OnDeath(PlayerController)) return;']
  ]);
  // Respawn handling bypasses native final-elimination bookkeeping. Preserve
  // the native kill credit separately, only for the first handled death event.
  const controllerFile = path.join(dir, 'FortPlayerController.cpp');
  let controller = fs.readFileSync(controllerFile, 'utf8').replace(/\r\n/g, '\n');
  if (!controller.includes('// Launcher handled-death credit v1')) {
    const before = '\tif (LocalTools::OnDeath(PlayerController)) return;';
    if (controller.split(before).length !== 2) throw new Error('Cannot upgrade local death credit handler.');
    controller = controller.replace(before, `\t// Launcher handled-death credit v1
\tbool newHandledDeath = false;
\tif (LocalTools::OnDeath(PlayerController, newHandledDeath)) {
\t\tif (newHandledDeath && DeathReport && MemberOffsets::DeathReport::KillerPlayerState >= 0) {
\t\t\tauto victim = Cast<AFortPlayerStateAthena>(PlayerController->GetPlayerState());
\t\t\tauto rawKiller = *(AFortPlayerState**)(__int64(DeathReport) + MemberOffsets::DeathReport::KillerPlayerState);
\t\t\tauto killer = rawKiller && rawKiller->IsValidLowLevel() ? Cast<AFortPlayerStateAthena>(rawKiller) : nullptr;
\t\t\t// Match upstream: no suicide credit; team kills use its same score path.
\t\t\tif (victim && killer && killer != victim) {
\t\t\t\tif (MemberOffsets::FortPlayerStateAthena::KillScore >= 0)
\t\t\t\t\tkiller->Get<int>(MemberOffsets::FortPlayerStateAthena::KillScore)++;
\t\t\t\tif (MemberOffsets::FortPlayerStateAthena::TeamKillScore >= 0)
\t\t\t\t\tkiller->Get<int>(MemberOffsets::FortPlayerStateAthena::TeamKillScore)++;
\t\t\t\tkiller->ClientReportKill(victim);
\t\t\t}
\t\t}
\t\treturn;
\t}`);
    fs.writeFileSync(controllerFile, controller);
  }
  edit('commands.cpp', [
    ['#include "commands.h"', '#include "commands.h"\n#include "LocalTools.h"'],
    ['\t\tif (Command == "giveitem")',
     '\t\tif (Command == "local") {\n' +
     '\t\t\tif (!LocalTools::IsLocal(PlayerController)) { SendMessageToConsole(PlayerController, L"Local tools require a loopback connection."); return; }\n' +
     '\t\t\tstd::string action = NumArgs ? Arguments[1] : "";\n' +
     '\t\t\tLocalTools::Action selected = LocalTools::None;\n' +
     '\t\t\tif (action == "respawn") selected = LocalTools::Respawn;\n' +
     '\t\t\telse if (action == "heal") selected = LocalTools::Heal;\n' +
     '\t\t\telse if (action == "loot") selected = LocalTools::Loot;\n' +
     '\t\t\telse if (action == "kit") selected = LocalTools::Kit;\n' +
     '\t\t\telse if (action == "materials") selected = LocalTools::Materials;\n' +
     '\t\t\telse if (action == "ammo") selected = LocalTools::Ammo;\n' +
     '\t\t\telse if (action == "clearbuilds") selected = LocalTools::ClearBuilds;\n' +
     '\t\t\tif (selected != LocalTools::None) LocalTools::Execute(PlayerController, selected);\n' +
     '\t\t\telse if ((action == "infiniteammo" || action == "infinitematerials" || action == "practice") && NumArgs == 2 && (Arguments[2] == "on" || Arguments[2] == "off")) {\n' +
     '\t\t\t\tbool enabled = Arguments[2] == "on";\n' +
     '\t\t\t\tif (action == "infiniteammo") LocalTools::InfiniteAmmo.store(enabled);\n' +
     '\t\t\t\telse if (action == "infinitematerials") LocalTools::InfiniteMaterials.store(enabled);\n' +
     '\t\t\t\telse LocalTools::PracticeRespawn.store(enabled);\n' +
     '\t\t\t\tLocalTools::Report(enabled ? "Enabled." : "Disabled.");\n' +
     '\t\t\t} else { SendMessageToConsole(PlayerController, L"cheat local respawn/heal/loot/kit/materials/ammo/clearbuilds, or infiniteammo/infinitematerials/practice on/off"); return; }\n' +
     '\t\t\tauto result = LocalTools::ReadStatus();\n' +
     '\t\t\tSendMessageToConsole(PlayerController, std::wstring(result.begin(), result.end()).c_str());\n' +
     '\t\t\treturn;\n' +
     '\t\t}\n' +
     '\t\tif (Command == "giveitem")']
  ]);
  // Upgrade the first local-tools patch without rewriting unrelated upstream code.
  const commandFile = path.join(dir, 'commands.cpp');
  let commands = fs.readFileSync(commandFile, 'utf8').replace(/\r\n/g, '\n');
  if (!commands.includes('LocalTools::Command(PlayerController, Arguments)')) {
    const start = commands.indexOf('\t\tif (Command == "local") {');
    const end = commands.indexOf('\t\tif (Command == "giveitem")', start);
    if (start < 0 || end < start) throw new Error('Cannot upgrade local command handler.');
    commands = commands.slice(0, start) + '\t\tif (Command == "local") { LocalTools::Command(PlayerController, Arguments); return; }\n' + commands.slice(end);
    fs.writeFileSync(commandFile, commands);
  }
}
