import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchGameplay(root) {
  const directory = path.join(root, 'Project Reboot 3.0');
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
  for (const name of ['LauncherCosmetics.inl', 'LauncherLocalLocker.inl', 'LauncherCharacterParts.h', 'CharacterAppearanceRules.h', 'LauncherGameplayLog.h'])
    fs.copyFileSync(path.join(source, name), path.join(directory, name));
  const edit = (file, pairs, marker = '// Launcher gameplay fixes v1') => {
    const target = path.join(directory, file);
    let text = fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n');
    if (text.includes(marker)) return;
    for (const [before, after] of pairs) {
      if (text.split(before).length !== 2) throw new Error(`Gameplay patch mismatch in ${file}: ${before.slice(0, 90)}`);
      text = text.replace(before, after);
    }
    fs.writeFileSync(target, marker + '\n' + text);
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
    const bool hooked = fn && Hooking::MinHook::Hook(controller, fn, LauncherLoadoutReceived, (PVOID*)&LauncherLoadoutOriginal, false, true);
    LauncherGameplayLog(std::string("0.4.4 test: native ability activation retained; loadout hook=") + (hooked ? "ready" : "unavailable"));
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

  const marker = '// Launcher gameplay fixes v2';
  edit('FortKismetLibrary.cpp', [
    ['#include "FortKismetLibrary.h"', '#include "FortKismetLibrary.h"\n#include "LauncherCharacterParts.h"'],
    ['void UFortKismetLibrary::ApplyCharacterCosmetics(UObject* WorldContextObject, const TArray<UObject*>& CharacterParts, UObject* PlayerState, bool* bSuccess)\n{', `void UFortKismetLibrary::ApplyCharacterCosmetics(UObject* WorldContextObject, const TArray<UObject*>& CharacterParts, UObject* PlayerState, bool* bSuccess)
{
    if (Fortnite_Version == 4.2) {
        const bool applied = LauncherApplyParts42(PlayerState, CharacterParts);
        if (bSuccess) *bSuccess = applied;
        return;
    }`]
  ], marker);
  edit('FortGameModeAthena.cpp', [
    ['#include "FortGameModeAthena.h"', '#include "FortGameModeAthena.h"\n#include "LauncherCharacterParts.h"'],
    ['\t\t\tParts[(int)EFortCustomPartType::Head] = headPart;\n\t\t\tParts[(int)EFortCustomPartType::Body] = bodyPart;\n\t\t\tParts[(int)EFortCustomPartType::Backpack] = backpackPart;', `            if (Fortnite_Version == 4.2) {
                TArray<UObject*> initial;
                initial.Add(headPart); initial.Add(bodyPart); initial.Add(backpackPart);
                LauncherApplyParts42(PlayerStateAthena, initial, true, false);
                initial.Free();
            } else {
                Parts[(int)EFortCustomPartType::Head] = headPart;
                Parts[(int)EFortCustomPartType::Body] = bodyPart;
                Parts[(int)EFortCustomPartType::Backpack] = backpackPart;
            }`]
  ], marker);
  edit('dllmain.cpp', [
    ['    if (Addresses::InternalTryActivateAbility)\n', `    // 4.2 has the native activation implementation. Keep its prediction/input
    // cache cleanup and press/release lifecycle, which the replacement omits.
    if (Addresses::InternalTryActivateAbility && Fortnite_Version != 4.2)
`]
  ], marker);
  edit('FortPlayerControllerAthena.cpp', [
    ['\tif (Globals::bNoMCP)\n', '\tif (Fortnite_Version == 4.2) { ControllerAsFort->ApplyCosmeticLoadout(); return; }\n\tif (Globals::bNoMCP)\n']
  ], marker);
}
