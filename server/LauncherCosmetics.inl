#include "hooking.h"
// Included by FortPlayerController.cpp. Use this player's native network loadout;
// never read the host's locker for a remote player.
static bool LauncherApplyCosmetics(AFortPlayerController* controller) {
    if (Fortnite_Version != 4.2) return false;
    auto pawn = Cast<AFortPlayerPawn>(controller->GetMyFortPawn());
    auto state = controller->GetPlayerState();
    auto loadout = controller->GetCosmeticLoadout();
    if (!pawn || pawn->IsActorBeingDestroyed() || !state || !loadout) return false;
    auto inventory = controller->GetWorldInventory();
    auto gauntlet = FindObject<UFortItemDefinition>("AGID_CarminePack", nullptr, ANY_PACKAGE);
    if (inventory && gauntlet && inventory->FindItemInstance(gauntlet)) return true;
    auto character = loadout->GetCharacter();
    if (!character || !character->IsValidLowLevel()) return false;
    if (!ApplyCID(pawn, character)) return false;
    auto backpack = loadout->GetBackpack();
    auto noBackpack = LoadObject<UObject>(L"/Game/Characters/CharacterParts/Backpacks/NoBackpack.NoBackpack");
    pawn->ServerChoosePart(EFortCustomPartType::Backpack, noBackpack);
    if (backpack && backpack->IsValidLowLevel()) {
        const int offset = backpack->GetOffset("CharacterParts", false);
        if (offset >= 0) {
            auto& parts = backpack->Get<TArray<UObject*>>(offset);
            for (int i = 0; i < parts.Num(); ++i)
                if (auto part = parts.at(i)) pawn->ServerChoosePart(EFortCustomPartType::Backpack, part);
        }
    }
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
    LocalTools::RememberAppearance(controller, true);
    return true;
}

static void (*LauncherLoadoutOriginal)(UObject*, FFrame*, void*);
static void LauncherLoadoutReceived(UObject* context, FFrame* stack, void* result) {
    LauncherLoadoutOriginal(context, stack, result);
    auto controller = Cast<AFortPlayerController>(context);
    if (controller) controller->ApplyCosmeticLoadout();
}
