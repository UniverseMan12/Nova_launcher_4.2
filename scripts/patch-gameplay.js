import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchGameplay(root) {
  const directory = path.join(root, 'Project Reboot 3.0');
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
  fs.copyFileSync(path.join(source, 'LauncherCosmetics.inl'), path.join(directory, 'LauncherCosmetics.inl'));
  const edit = (file, pairs) => {
    const target = path.join(directory, file);
    let text = fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n');
    if (text.includes('// Launcher gameplay fixes v1')) return;
    for (const [before, after] of pairs) {
      if (text.split(before).length !== 2) throw new Error(`Gameplay patch mismatch in ${file}: ${before.slice(0, 90)}`);
      text = text.replace(before, after);
    }
    fs.writeFileSync(target, '// Launcher gameplay fixes v1\n' + text);
  };
  edit('FortInventory.cpp', [
    ['#include "FortInventory.h"', '#include "FortInventory.h"\n#include "LocalTools.h"'],
    ['bool DidApplyingGadgetSucceed = ApplyGadgetData(', 'LocalTools::RememberAppearance(FortPlayerController, true);\n\t\t\t\t\tbool DidApplyingGadgetSucceed = ApplyGadgetData(']
  ]);
  edit('FortPlayerController.cpp', [
    ['void AFortPlayerController::ApplyCosmeticLoadout()\n{', '#include "LauncherCosmetics.inl"\n\nvoid AFortPlayerController::ApplyCosmeticLoadout()\n{\n\tif (LauncherApplyCosmetics(this)) return;'],
    ['\tPlayerController->ApplyCosmeticLoadout();\n\n\treturn ServerLoadingScreenDroppedOriginal', `\tPlayerController->ApplyCosmeticLoadout();
    if (Fortnite_Version == 4.2) if (auto request = PlayerController->FindFunction("ClientResendLoadoutConfig")) {
        struct { bool prepare; bool players; } params{true, false};
        PlayerController->ProcessEvent(request, &params);
    }
\n\treturn ServerLoadingScreenDroppedOriginal`]
  ]);
  // Hook code lives in the same translation unit as the cosmetics helper.
  edit('FortPlayerController.h', [
    ['\tvoid ApplyCosmeticLoadout();', '\tvoid ApplyCosmeticLoadout();\n\tstatic void InstallLauncherLoadoutHook(UObject* controller);']
  ]);
  const helper = path.join(directory, 'LauncherCosmetics.inl');
  fs.appendFileSync(helper, `
void AFortPlayerController::InstallLauncherLoadoutHook(UObject* controller) {
    if (Fortnite_Version != 4.2) return;
    auto fn = FindObject<UFunction>(L"/Script/FortniteGame.FortPlayerControllerZone.ServerSendLoadoutConfig");
    if (fn) Hooking::MinHook::Hook(controller, fn, LauncherLoadoutReceived, (PVOID*)&LauncherLoadoutOriginal, false, true);
}
`);
  edit('dllmain.cpp', [
    ['    Hooking::MinHook::Hook(FortPlayerControllerAthenaDefault, FindObject<UFunction>(L"/Script/FortniteGame.FortPlayerController.ServerLoadingScreenDropped"),', '    AFortPlayerController::InstallLauncherLoadoutHook(FortPlayerControllerAthenaDefault);\n    Hooking::MinHook::Hook(FortPlayerControllerAthenaDefault, FindObject<UFunction>(L"/Script/FortniteGame.FortPlayerController.ServerLoadingScreenDropped"),']
  ]);
  edit('FortGameModeAthena.cpp', [
    ['auto CharacterParts = PlayerStateAthena->GetPtr<__int64>(CharacterPartsOffset);', 'auto CharacterParts = CharacterPartsOffset >= 0 ? PlayerStateAthena->GetPtr<__int64>(CharacterPartsOffset) : nullptr;'],
    ['auto Parts = (UObject**)(__int64(CharacterParts) + PartsOffset);', 'auto Parts = CharacterParts ? (UObject**)(__int64(CharacterParts) + (CustomCharacterPartsStruct && PartsOffset >= 0 ? PartsOffset : 0)) : nullptr;'],
    ['if (CharacterPartsOffset != -1) // && CustomCharacterPartsStruct)', 'if (Parts && !Parts[(int)EFortCustomPartType::Head] && !Parts[(int)EFortCustomPartType::Body])']
  ]);
  edit('FortPlayerControllerAthena.h', [
    ['\tusing UFortHeroSpecialization = UObject;', '\tif (!Pawn || !HeroDefinition || !HeroDefinition->IsValidLowLevel()) return;\n\tusing UFortHeroSpecialization = UObject;'],
    ['auto HeroDefinition = CID->Get(HeroDefinitionOffset);', 'if (HeroDefinitionOffset < 0) return false;\n\tauto HeroDefinition = CID->Get(HeroDefinitionOffset);\n\tif (!HeroDefinition || !HeroDefinition->IsValidLowLevel()) return false;']
  ]);
}
