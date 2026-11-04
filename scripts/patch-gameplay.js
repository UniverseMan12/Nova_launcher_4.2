import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const activationMarker = '// Launcher ability activation v1';
const upstreamActivationGuard = '    if (Addresses::InternalTryActivateAbility)\n';
const disabledActivationGuard = `    // 4.2 has the native activation implementation. Keep its prediction/input
    // cache cleanup and press/release lifecycle, which the replacement omits.
    if (Addresses::InternalTryActivateAbility && Fortnite_Version != 4.2)
`;
const restoredActivationGuard = `    // Shipping clients may omit the native server activation body. Keep
    // Reboot's server hook, which calls the game's inner activation function.
${upstreamActivationGuard}`;
const activationSwap = '        VirtualSwap(FortAbilitySystemComponentAthenaDefault->VFTable, InternalServerTryActivateAbilityIndex, UAbilitySystemComponent::InternalServerTryActivateAbilityHook);';
const activationConfigured = '        if (Fortnite_Version == 4.2) LauncherGameplayLog("0.4.4 test: Reboot server ability activation hook configured");';
const occurrences = (text, value) => text.split(value).length - 1;

function replaceUnique(text, before, after, file) {
  if (occurrences(text, before) !== 1) throw new Error(`Ability activation patch mismatch in ${file}: ${before.slice(0, 90)}`);
  return text.replace(before, after);
}

export function patchAbilityActivationInstall(source) {
  let text = source.replaceAll('\r\n', '\n');
  const file = 'dllmain.cpp';
  const include = '#include "LauncherGameplayLog.h"';
  if (text.includes(activationMarker)) {
    for (const value of [activationMarker, restoredActivationGuard, upstreamActivationGuard, activationSwap, activationConfigured, include]) {
      if (occurrences(text, value) !== 1) throw new Error(`Ability activation patch mismatch in ${file}: invalid patched source`);
    }
    if (text.includes(disabledActivationGuard) || text.includes('Addresses::InternalTryActivateAbility &&')) throw new Error(`Ability activation patch mismatch in ${file}: disabled hook remains`);
    return text;
  }
  const original = occurrences(text, upstreamActivationGuard);
  const disabled = occurrences(text, disabledActivationGuard);
  if (original + disabled !== 1 || text.includes(include) || text.includes(activationConfigured)) throw new Error(`Ability activation patch mismatch in ${file}: ambiguous source`);
  text = replaceUnique(text, disabled ? disabledActivationGuard : upstreamActivationGuard, restoredActivationGuard, file);
  if (text.includes('Addresses::InternalTryActivateAbility &&')) throw new Error(`Ability activation patch mismatch in ${file}: unexpected activation guard`);
  text = replaceUnique(text, '#include <Windows.h>', '#include <Windows.h>\n' + include, file);
  text = replaceUnique(text, activationSwap, activationSwap + '\n' + activationConfigured, file);
  return activationMarker + '\n' + text;
}

export function patchAbilityActivationDiagnostics(source) {
  let text = source.replaceAll('\r\n', '\n');
  const file = 'AbilitySystemComponent_Abilities.cpp';
  const include = '#include "LauncherAbilityDiagnostics.h"';
  const invalidLog = '\t\tLOG_INFO(LogAbilities, "InternalServerTryActivateAbility. Rejecting ClientActivation of ability with invalid SpecHandle!");';
  const invalidTrace = '\t\tLauncherAbilityInvalid("invalid-handle", Handle.Handle, InputPressed, PredictionKeySize, PredictionKey && CurrentOffset >= 0 ? *(int16_t*)(__int64(PredictionKey) + CurrentOffset) : 0);';
  const ability = '\t/* const */ UGameplayAbility * AbilityToActivate = Spec->GetAbility();';
  const receivedTrace = '\tLauncherAbilityTrace activationTrace(AbilityToActivate, Handle.Handle, InputPressed, PredictionKeySize, PredictionKey && CurrentOffset >= 0 ? *(int16_t*)(__int64(PredictionKey) + CurrentOffset) : 0);';
  const resultTrace = '\tactivationTrace.Result(res);';
  if (text.includes(activationMarker)) {
    for (const value of [activationMarker, include, invalidLog, invalidTrace, ability, receivedTrace, resultTrace]) {
      if (occurrences(text, value) !== 1) throw new Error(`Ability activation patch mismatch in ${file}: invalid patched source`);
    }
    return text;
  }
  if (text.includes(include) || text.includes('activationTrace') || text.includes('LauncherAbilityInvalid(')) throw new Error(`Ability activation patch mismatch in ${file}: ambiguous source`);
  text = replaceUnique(text, '#include "AbilitySystemComponent.h"', '#include "AbilitySystemComponent.h"\n' + include, file);
  text = replaceUnique(text, invalidLog, invalidTrace + '\n' + invalidLog, file);
  text = replaceUnique(text, ability, ability + '\n' + receivedTrace, file);
  text = replaceUnique(text, '\tif (!res)\n', resultTrace + '\n\n\tif (!res)\n', file);
  return activationMarker + '\n' + text;
}

export function patchGameplay(root) {
  const directory = path.join(root, 'Project Reboot 3.0');
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server');
  for (const name of ['LauncherCosmetics.inl', 'LauncherLocalLocker.inl', 'LauncherCharacterParts.h', 'CharacterAppearanceRules.h', 'LauncherGameplayLog.h', 'LauncherAbilityDiagnostics.h'])
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
    LauncherGameplayLog(std::string("0.4.4 test: loadout hook=") + (hooked ? "ready" : "unavailable"));
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
  for (const [file, patch] of [['dllmain.cpp', patchAbilityActivationInstall], ['AbilitySystemComponent_Abilities.cpp', patchAbilityActivationDiagnostics]]) {
    const target = path.join(directory, file);
    fs.writeFileSync(target, patch(fs.readFileSync(target, 'utf8')));
  }
  edit('FortPlayerControllerAthena.cpp', [
    ['\tif (Globals::bNoMCP)\n', '\tif (Fortnite_Version == 4.2) { ControllerAsFort->ApplyCosmeticLoadout(); return; }\n\tif (Globals::bNoMCP)\n']
  ], marker);

  // A reset can receive a delayed acknowledgment for its old pawn. Validate
  // ownership before dereferencing it or changing the acknowledged pawn.
  edit('FortPlayerControllerAthena.cpp', [
    ['void AFortPlayerControllerAthena::ServerAcknowledgePossessionHook(APlayerController* Controller, APawn* Pawn)\n{', `void AFortPlayerControllerAthena::ServerAcknowledgePossessionHook(APlayerController* Controller, APawn* Pawn)
{
    if (Fortnite_Version == 4.2) {
        if (!Controller || !Controller->IsValidLowLevel() || !Pawn || !Pawn->IsValidLowLevel() || Pawn->IsActorBeingDestroyed()) return;
        auto fort = Cast<AFortPlayerController>(Controller);
        auto playerPawn = Cast<AFortPlayerPawn>(Pawn);
        if (!fort || !playerPawn || fort->GetMyFortPawn() != Pawn || Pawn->GetController() != Controller) return;
        const int acknowledged = Controller->GetOffset("AcknowledgedPawn", false);
        if (acknowledged < 0) return;
        Controller->Get<APawn*>(acknowledged) = Pawn;
        // Spawning/transformation owns health and shield. A delayed ACK must
        // not reset those values or restore a normal outfit over a gauntlet.
        fort->ApplyCosmeticLoadout();
        return;
    }`],
    ['\tif (Fortnite_Version == 4.2) { ControllerAsFort->ApplyCosmeticLoadout(); return; }\n', '']
  ], '// Launcher gameplay fixes v3');
  edit('FortPlayerControllerAthena.h', [
    ['#include "FortKismetLibrary.h"', '#include "FortKismetLibrary.h"\n#include "LauncherCharacterParts.h"'],
    ['\tif (!Pawn || !HeroDefinition || !HeroDefinition->IsValidLowLevel()) return;\n', `\tif (!Pawn || !HeroDefinition || !HeroDefinition->IsValidLowLevel()) return;
    if (Fortnite_Version == 4.2) {
        auto controller = Cast<AFortPlayerController>(Pawn->GetController());
        auto loadout = controller ? controller->GetCosmeticLoadout() : nullptr;
        TArray<UObject*> parts;
        if (LauncherCollectHeroParts42(HeroDefinition, loadout ? loadout->GetBackpack() : nullptr, parts))
            LauncherApplyParts42(Pawn->GetPlayerState(), parts, true);
        parts.Free();
        return;
    }
`]
  ], '// Launcher gameplay fixes v3');
}
