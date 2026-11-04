#include "hooking.h"
#include "LauncherCharacterParts.h"
#include "LauncherLocalLocker.inl"

static bool LauncherCollectOutfit42(UObject* character, UObject* backpack, TArray<UObject*>& parts) {
    if (!character || !character->IsValidLowLevel()) return false;
    const int heroOffset = character->GetOffset("HeroDefinition", false);
    auto hero = heroOffset >= 0 ? character->Get<UObject*>(heroOffset) : nullptr;
    return LauncherCollectHeroParts42(hero, backpack, parts);
}

static void LauncherRefreshPickaxe42(AFortPlayerController* controller, FFortAthenaLoadout* loadout) {
    auto inventory = controller->GetWorldInventory();
    auto selected = loadout->GetPickaxe();
    if (!inventory || !selected || !selected->IsValidLowLevel()) return;
    const int offset = selected->GetOffset("WeaponDefinition", false);
    auto definition = offset >= 0 ? selected->Get<UFortItemDefinition*>(offset) : nullptr;
    if (!definition || !definition->IsValidLowLevel()) return;
    auto previous = inventory->GetPickaxeInstance();
    if (previous && previous->GetItemEntry()->GetItemDefinition() == definition) return;
    auto pawn = controller->GetMyFortPawn();
    auto weapon = pawn ? pawn->GetCurrentWeapon() : nullptr;
    const bool equip = !weapon || (previous && weapon->GetWeaponData() == previous->GetItemEntry()->GetItemDefinition());
    if (previous) {
        const auto guid = previous->GetItemEntry()->GetItemGuid();
        if (!inventory->RemoveItem(guid, nullptr, previous->GetItemEntry()->GetCount(), true, true)) return;
    }
    controller->AddPickaxeToInventory(); inventory->Update();
    if (equip) if (auto item = inventory->GetPickaxeInstance()) {
        auto athena = Cast<AFortPlayerControllerAthena>(controller);
        const auto guid = item->GetItemEntry()->GetItemGuid();
        if (athena) { athena->ServerExecuteInventoryItemHook(athena, guid); athena->ClientEquipItem(guid, true); }
    }
}

// Included by FortPlayerController.cpp. Use this player's native network loadout;
// the local-file fallback is restricted to the one loopback player.
static bool LauncherApplyCosmetics(AFortPlayerController* controller) {
    if (Fortnite_Version != 4.2) return false;
    auto pawn = Cast<AFortPlayerPawn>(controller->GetMyFortPawn());
    auto state = controller->GetPlayerState();
    auto loadout = controller->GetCosmeticLoadout();
    if (!pawn || pawn->IsActorBeingDestroyed() || !state || !loadout) return false;
    auto inventory = controller->GetWorldInventory();
    auto gauntlet = FindObject<UFortItemDefinition>("AGID_CarminePack", nullptr, ANY_PACKAGE);
    if (inventory && gauntlet && inventory->FindItemInstance(gauntlet)) return true;
    const bool localLocker = LauncherReadLocalLocker42(controller, loadout);
    auto character = loadout->GetCharacter();
    if (!character || !character->IsValidLowLevel()) return false;
    TArray<UObject*> parts;
    const bool collected = LauncherCollectOutfit42(character, loadout->GetBackpack(), parts);
    const bool applied = collected && LauncherApplyParts42(state, parts, true);
    parts.Free();
    if (!applied) { LOG_WARN(LogDev, "Launcher cosmetics: could not resolve complete parts for {}.", character->GetName()); LauncherGameplayLog("parts unresolved=" + character->GetName()); return false; }
    // Copy object references individually. memcpy of the complete loadout would
    // alias its FString/TArray allocations and risk double frees on respawn.
    const int pawnOffset = pawn->GetOffset("CustomizationLoadout", false);
    if (pawnOffset >= 0) {
        auto destination = pawn->GetPtr<uint8_t>(pawnOffset);
        auto source = reinterpret_cast<uint8_t*>(loadout);
        for (auto name : {"SkyDiveContrail", "Glider", "Pickaxe", "Character", "Hat", "Backpack", "LoadingScreen", "BattleBus", "VictoryPose"}) {
            const int offset = FindOffsetStruct("/Script/FortniteGame.FortAthenaLoadout", name, false);
            if (offset >= 0) *reinterpret_cast<UObject**>(destination + offset) = *reinterpret_cast<UObject**>(source + offset);
        }
        if (auto notify = pawn->FindFunction("OnRep_CustomizationLoadout")) pawn->ProcessEvent(notify);
    }
    state->ForceNetUpdate(); pawn->ForceNetUpdate(); controller->ForceNetUpdate();
    LauncherRefreshPickaxe42(controller, loadout);
    LocalTools::RememberAppearance(controller, true);
    LOG_INFO(LogDev, "Launcher cosmetics: applied {} from {}.", character->GetName(), localLocker ? "local locker" : "player loadout");
    LauncherGameplayLog("applied=" + character->GetName() + (localLocker ? " source=local-locker" : " source=native-loadout"));
    return true;
}

static void (*LauncherLoadoutOriginal)(UObject*, FFrame*, void*);
static void LauncherLoadoutReceived(UObject* context, FFrame* stack, void* result) {
    LauncherLoadoutOriginal(context, stack, result);
    auto controller = Cast<AFortPlayerController>(context);
    if (controller) controller->ApplyCosmeticLoadout();
}
