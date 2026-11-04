// Included once by NetDriver.cpp: all Unreal mutations run on its game thread.
#include "LocalTools.h"
#include "InfinityShowdown.h"
#include "LocalToolsCatalog.h"
#include "FortWeapon.h"
#include "FortInventory.h"
#include "FortPickup.h"
#include "GameModeBase.h"
#include "KismetStringLibrary.h"
#include "LauncherCharacterParts.h"
#include <chrono>

namespace LocalTools {
    static FVector DeathLocation;
    static bool HasDeathLocation = false;
    static FVector SavedLocation;
    static FRotator SavedRotation;
    struct TrackedObject {
        int index = -1, serial = -1;
        UObject* address = nullptr;
        FName name;
        TrackedObject() = default;
        explicit TrackedObject(UObject* object) {
            if (!object) return;
            index = object->InternalIndex; address = object; name = object->NamePrivate;
            auto slot = GetItemByIndex(index); serial = slot ? slot->SerialNumber : -1;
        }
        UObject* Get() const {
            if (index < 0 || !address) return nullptr;
            auto slot = GetItemByIndex(index);
            return slot && !slot->IsPendingKill() && slot->SerialNumber == serial && slot->Object == address &&
                slot->Object && slot->Object->NamePrivate == name ? slot->Object : nullptr;
        }
    };
    static TrackedObject SessionPlayer, DeadController;
    static std::vector<TrackedObject> SpawnedLoot;
    static auto LastAction = std::chrono::steady_clock::time_point{};

    static void PruneLoot() {
        SpawnedLoot.erase(std::remove_if(SpawnedLoot.begin(), SpawnedLoot.end(), [](const TrackedObject& ref) {
            auto actor = Cast<AFortPickup>(ref.Get());
            return !actor || actor->IsActorBeingDestroyed();
        }), SpawnedLoot.end());
        SpawnedLootCount.store(static_cast<int>(SpawnedLoot.size()));
    }
    static bool TrackPickup(PickupCreateData& data) {
        if (SpawnedLoot.size() >= LootLimit) return false;
        auto pickup = AFortPickup::SpawnPickup(data);
        if (!pickup) return false;
        SpawnedLoot.emplace_back(pickup);
        SpawnedLootCount.store(static_cast<int>(SpawnedLoot.size()));
        return true;
    }
    static bool RestoreShield(AFortPawn* pawn) {
        if (pawn->GetShield() >= 100) return true;
        if (auto setter = pawn->FindFunction("SetShield")) {
            float shield = 100; pawn->ProcessEvent(setter, &shield);
        } else {
            // 4.2 has GetShield/SetMaxShield but no SetShield UFunction.
            // Use its reflected health attribute set and replication notification.
            auto offset = pawn->GetOffset("AbilitySystemComponent", false);
            auto asc = offset == -1 ? nullptr : pawn->Get<UAbilitySystemComponent*>(offset);
            auto healthClass = FindObject<UClass>(L"/Script/FortniteGame.FortHealthSet");
            if (!asc || !healthClass) return false;
            auto& attributes = asc->GetSpawnedAttributes();
            for (int i = 0; i < attributes.Num(); ++i) {
                auto attribute = attributes.at(i);
                if (!attribute || !attribute->IsA(healthClass)) continue;
                auto currentOffset = attribute->GetOffset("CurrentShield", false);
                if (currentOffset == -1) continue;
                auto shield = attribute->GetPtr<FGameplayAttributeData>(currentOffset);
                shield->GetBaseValue() = 100; shield->GetCurrentValue() = 100;
                if (auto notify = attribute->FindFunction("OnRep_CurrentShield")) attribute->ProcessEvent(notify);
                break;
            }
        }
        pawn->ForceNetUpdate();
        return pawn->GetShield() >= 99.9f;
    }
    static bool RestoreHealth(AFortPawn* pawn) {
        if (pawn->GetHealth() < 100) pawn->SetHealth(100);
        bool shield = RestoreShield(pawn);
        pawn->ForceNetUpdate();
        return shield && pawn->GetHealth() >= 99.9f;
    }

    bool IsLocal(AFortPlayerController* controller) {
        if (!controller || !controller->IsValidLowLevel()) return false;
        auto state = controller->GetPlayerState();
        if (!state || !state->IsValidLowLevel()) return false;
        auto ip = state->GetSavedNetworkAddress().ToString();
        return ip == "127.0.0.1" || ip.rfind("127.0.0.1:", 0) == 0;
    }

    #include "LocalToolsAppearance.inl"

    bool OnDeath(AFortPlayerController* controller) {
        if (InfinityShowdown::Enabled.load()) return InfinityShowdown::OnDeath(controller);
        if (!PracticeRespawn.load() || !IsLocal(controller)) return false;
        auto pawn = controller->GetMyFortPawn();
        if (!pawn || !pawn->IsValidLowLevel()) return false;
        if (pawn->IsDBNO()) return false; // Let normal teammate revival handle knockdowns.
        DeadController = TrackedObject(controller);
        DeathLocation = pawn->GetActorLocation();
        HasDeathLocation = true;
        Report("You died. Click Respawn me. Practice mode keeps your inventory and round.");
        // Do not remove this practice player from AlivePlayers or end the local round.
        return true;
    }

    static int TopUp(AFortPlayerControllerAthena* controller, bool materials) {
        auto inventory = controller->GetWorldInventory();
        if (!inventory) return 0;
        const char* mats[] = { "WoodItemData", "StoneItemData", "MetalItemData" };
        const char* ammo[] = { "AthenaAmmoDataBulletsLight", "AthenaAmmoDataBulletsMedium", "AthenaAmmoDataBulletsHeavy", "AthenaAmmoDataShells", "AmmoDataRockets" };
        int available = 0;
        for (int i = 0; i < (materials ? 3 : 5); ++i) {
            auto definition = FindObject<UFortItemDefinition>(materials ? mats[i] : ammo[i], nullptr, ANY_PACKAGE);
            if (!definition) continue;
            const int limit = static_cast<int>(definition->GetMaxStackSize());
            if (limit < 1) continue;
            const int target = (std::min)(materials ? 999 : 200, limit);
            ++available;
            auto instance = inventory->FindItemInstance(definition);
            int count = instance ? instance->GetItemEntry()->GetCount() : 0;
            if (count < target) {
                bool update = false;
                inventory->AddItem(definition, &update, target - count);
                if (update) inventory->Update();
            }
        }
        return available;
    }

    static void RefillMagazine(AFortPlayerControllerAthena* controller) {
        auto pawn = controller->GetMyFortPawn();
        auto inventory = controller->GetWorldInventory();
        if (!pawn || !inventory) return;
        auto weapon = pawn->GetCurrentWeapon();
        if (!weapon || !weapon->IsValidLowLevel()) return;
        auto definition = weapon->GetWeaponData();
        if (!definition) return;
        int clip = definition->GetClipSize();
        int previous = weapon->GetAmmoCount();
        if (clip <= 0 || clip > 500 || previous >= clip) return;
        weapon->GetAmmoCount() = clip;
        inventory->CorrectLoadedAmmo(weapon->GetItemEntryGuid(), clip);
        if (auto notify = weapon->FindFunction("OnRep_AmmoCount")) weapon->ProcessEvent(notify, &previous);
        weapon->ForceNetUpdate();
    }

    static bool HasGauntlet(AFortInventory* inventory) {
        auto gauntlet = FindObject<UFortItemDefinition>("AGID_CarminePack", nullptr, ANY_PACKAGE);
        return gauntlet && inventory && inventory->FindItemInstance(gauntlet);
    }
    static bool ClearPlayerItems(AFortPlayerControllerAthena* controller, bool all) {
        auto inventory = controller->GetWorldInventory();
        auto gauntlet = FindObject<UFortItemDefinition>("AGID_CarminePack", nullptr, ANY_PACKAGE);
        if (!inventory) return false;
        // Native unequip removes its granted abilities/effects and may replace the pawn.
        if (gauntlet) if (auto item = inventory->FindItemInstance(gauntlet)) {
            const auto guid = item->GetItemEntry()->GetItemGuid();
            const int count = item->GetItemEntry()->GetCount();
            const bool previousGadgets = Globals::bEnableAGIDs;
            Globals::bEnableAGIDs = true;
            const bool removed = inventory->RemoveItem(guid, nullptr, count, true, true);
            Globals::bEnableAGIDs = previousGadgets;
            if (!removed || inventory->FindItemInstance(guid)) return false;
        }
        if (all) {
            std::vector<std::pair<FGuid,int>> remove;
            const auto pickaxe = inventory->GetPickaxeInstance();
            auto& items = inventory->GetItemList().GetItemInstances();
            for (int i = 0; i < items.Num(); ++i) {
                auto item = items.at(i); if (!item || item == pickaxe) continue;
                auto entry = item->GetItemEntry(); auto def = entry->GetItemDefinition();
                // Keep the building/edit tools required by the controller.
                if (def && (def->GetName().rfind("BuildingItemData", 0) == 0 || def->GetName() == "EditTool")) continue;
                remove.push_back({entry->GetItemGuid(), entry->GetCount()});
            }
            for (const auto& item : remove) {
                if (!inventory->RemoveItem(item.first, nullptr, item.second, true, true)) { inventory->Update(); return false; }
            }
        }
        inventory->Update();
        return true;
    }

    static void EquipPickaxe(AFortPlayerControllerAthena* controller) {
        auto inventory = controller->GetWorldInventory();
        if (!inventory || !controller->GetMyFortPawn()) return;
        if (auto pickaxe = inventory->GetPickaxeInstance()) {
            const auto guid = pickaxe->GetItemEntry()->GetItemGuid();
            controller->ServerExecuteInventoryItemHook(controller, guid);
            controller->ClientEquipItem(guid, true);
        }
    }
    static bool RespawnPlayer(AFortPlayerControllerAthena* controller, bool clear = false) {
        auto mode = Cast<AFortGameModeAthena>(GetWorld()->GetGameMode());
        auto state = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        if (!mode || !state || !controller->GetWorldInventory()) { Report("Player inventory or match is not ready."); return false; }
        if (state->IsInAircraft()) { Report("Jump from the bus before respawning."); return false; }
        auto gameState = mode->GetGameStateAthena();
        if (!gameState || gameState->GetGamePhase() == EAthenaGamePhase::EndGame) {
            Report("The match has ended. Restart with Practice respawn enabled."); return false;
        }
        auto oldPawn = controller->GetMyFortPawn();
        if (oldPawn && (!oldPawn->IsValidLowLevel() || oldPawn->IsActorBeingDestroyed())) oldPawn = nullptr;
        const TrackedObject oldPawnRef(oldPawn);
        bool dead = DeadController.Get() == controller;
        if (!oldPawn && !(dead && HasDeathLocation) && !HasSavedSpot.load()) { Report("No spawn position is available yet."); return false; }
        FVector location = HasSavedSpot.load() ? SavedLocation : dead && HasDeathLocation ? DeathLocation : oldPawn->GetActorLocation();
        location.Z += 150;
        auto spawn = FindObject<UFunction>(L"/Script/Engine.GameModeBase.SpawnDefaultPawnAtTransform");
        if (!spawn) { Report("This build does not expose pawn spawning."); return false; }
        const bool transformed = HasGauntlet(controller->GetWorldInventory());
        if (transformed && (!Addresses::RemoveGadgetData || !Addresses::ApplyGadgetData)) {
            Report("This build cannot safely remove the transformation."); return false;
        }
        if (transformed && !OriginalAppearance.appearance.saved) {
            Report("Normal appearance is not ready. Rejoin the match before resetting."); return false;
        }
        if (!transformed) RememberAppearance(controller);
        // Validate restoration before removing a gadget or any other items.
        if (OriginalAppearance.appearance.saved && !RestoreAppearance(controller, OriginalAppearance, false, true)) {
            Report("Waiting for your original outfit to load. Please try again."); return false;
        }
        if (!ClearPlayerItems(controller, clear)) { Report("Inventory removal failed. Try again once the player is ready."); return false; }
        // Native gadget removal may replace the pawn. Keep that intermediate
        // pawn too, otherwise a successful reset can leave an unpossessed body.
        const TrackedObject unequippedPawnRef(controller->GetMyFortPawn());
        if (OriginalAppearance.appearance.saved && !RestoreAppearance(controller, OriginalAppearance, false)) {
            Report("The original appearance is unavailable after unequipping. Rejoin before resetting."); return false;
        }
        FTransform transform{};
        transform.Translation = location;
        transform.Rotation = LauncherAppearanceRules::Upright(controller->GetControlRotation()).Quaternion();
        transform.Scale3D = FVector(1, 1, 1);
        struct { AController* Player; FTransform Transform; APawn* Result; } params{ controller, transform, nullptr };
        mode->ProcessEvent(spawn, &params);
        auto pawn = Cast<AFortPlayerPawn>(params.Result);
        if (!pawn) { Report("Respawn failed: the game did not create a pawn."); return false; }
        state->EndDBNOAbilities();
        state->ClearDeathInfo();
        pawn->SetOwner(controller);
        controller->Possess(pawn);
        const bool appearanceRestored = !OriginalAppearance.appearance.saved || RestoreAppearance(controller, OriginalAppearance, true);
        controller->ApplyCosmeticLoadout();
        pawn->SetMaxHealth(100); pawn->SetHealth(100);
        pawn->SetMaxShield(100); bool shieldRestored = RestoreShield(pawn);
        controller->SetPlayerIsWaiting(false);
        controller->ClientClearDeathNotification();
        controller->RespawnPlayerAfterDeath(false);
        if (auto restart = controller->FindFunction("ClientRestart")) controller->ProcessEvent(restart, &pawn);
        EquipPickaxe(controller);
        pawn->ForceNetUpdate();
        oldPawn = Cast<AFortPawn>(oldPawnRef.Get());
        if (oldPawn && oldPawn != pawn && oldPawn->IsValidLowLevel() && !oldPawn->IsActorBeingDestroyed()) oldPawn->K2_DestroyActor();
        auto unequippedPawn = Cast<AFortPawn>(unequippedPawnRef.Get());
        if (unequippedPawn && unequippedPawn != pawn && !unequippedPawn->IsActorBeingDestroyed()) unequippedPawn->K2_DestroyActor();
        DeadController = {}; HasDeathLocation = false;
        const auto rotation = pawn->GetActorRotation();
        LauncherGameplayLog("local reset: pitch=" + std::to_string(rotation.Pitch) + " roll=" + std::to_string(rotation.Roll) +
            " appearance=" + (appearanceRestored ? "restored" : "failed"));
        if (!appearanceRestored) { Report("Respawned, but restoring the normal animation failed. Rejoin before using Thanos again."); return false; }
        Report(shieldRestored ? "Respawned with 100 health and shield." : "Respawned. Shield restoration is unavailable in this build.");
        return true;
    }

    void Execute(AFortPlayerControllerAthena* controller, Action action, int item, int stack) {
        if (InfinityShowdown::Enabled.load()) { Report("Practice tools are disabled during Infinity Showdown."); return; }
        if (!IsLocal(controller)) { Report("No local player. Join your match first."); return; }
        if (SessionPlayer.Get() != controller) {
            SessionPlayer = TrackedObject(controller);
            DeadController = {}; HasDeathLocation = false; HasSavedSpot.store(false); OriginalAppearance = {};
        }
        auto now = std::chrono::steady_clock::now();
        if (now - LastAction < std::chrono::milliseconds(250)) { Report("Please wait a moment before the next action."); return; }
        LastAction = now;
        PruneLoot();
        if (action == ForgetSpot) { HasSavedSpot.store(false); Report("Saved spot cleared."); return; }
        if (action == Respawn || action == FullReset || action == ClearInventory) {
            if (action != Respawn) {
                InfiniteAmmo.store(false); InfiniteMaterials.store(false); AutoHeal.store(false);
            }
            if (action != ClearInventory || HasGauntlet(controller->GetWorldInventory())) {
                if (RespawnPlayer(controller, action != Respawn) && action == FullReset) {
                    HasSavedSpot.store(false);
                    Report("Fully reset: normal outfit, 100 health/shield, empty inventory. Pickaxe and building tools kept.");
                }
                return;
            }
        }
        auto pawn = controller->GetMyFortPawn();
        if (!pawn || !pawn->IsValidLowLevel() || pawn->IsActorBeingDestroyed() || pawn->GetHealth() <= 0 || DeadController.Get() == controller) {
            Report("Respawn or join the match first."); return;
        }
        if (pawn->IsDBNO()) { Report("Get revived or use Respawn me first."); return; }
        auto playerState = Cast<AFortPlayerStateAthena>(controller->GetPlayerState());
        if (!playerState || playerState->IsInAircraft()) { Report("Jump from the bus before using this tool."); return; }
        if (action == ClearInventory) {
            if (!ClearPlayerItems(controller, true)) { Report("Inventory is not ready to be cleared. Try again."); return; }
            EquipPickaxe(controller);
            Report("Inventory cleared. Pickaxe and building tools kept; automatic refills disabled.");
        } else if (action == SaveSpot) {
            SavedLocation = pawn->GetActorLocation(); SavedRotation = LauncherAppearanceRules::Upright(controller->GetControlRotation());
            HasSavedSpot.store(true); Report("Spot saved. Return here or use it as your respawn point.");
        } else if (action == ReturnSpot) {
            if (!HasSavedSpot.load()) { Report("Click Save my spot first."); return; }
            auto destination = SavedLocation; destination.Z += 100;
            Report(pawn->TeleportTo(destination, LauncherAppearanceRules::Upright(SavedRotation)) ? "Returned to your saved spot." : "The saved spot is blocked. Move the obstacle or save a new spot.");
        } else if (action == ClearLoot) {
            int removed = 0;
            for (const auto& ref : SpawnedLoot) {
                auto pickup = Cast<AFortPickup>(ref.Get());
                if (pickup && !pickup->IsActorBeingDestroyed()) { pickup->K2_DestroyActor(); ++removed; }
            }
            PruneLoot(); Report("Removed " + std::to_string(removed) + " tool-spawned pickups. Map loot kept.");
        } else if (action == Gauntlet || action == SpawnItem) {
            if (action == Gauntlet) item = 0;
            if (item < 0 || item >= CatalogSize || stack < 1 || stack > Catalog[item].maxStack) {
                Report("Select a valid item and stack size."); return;
            }
            if (SpawnedLoot.size() >= LootLimit) { Report("Loot limit reached. Pick items up or click Clear spawned loot."); return; }
            if (item == 0 && (!Globals::bEnableAGIDs || !Addresses::ApplyGadgetData || !Addresses::RemoveGadgetData)) {
                Report("Gauntlet needs Enable AGIDs and gadget support in this build."); return;
            }
            auto definition = FindObject<UFortWorldItemDefinition>(Catalog[item].asset, nullptr, ANY_PACKAGE);
            if (!definition) { Report("This item is not loaded in your game build."); return; }
            PickupCreateData data;
            auto weapon = Cast<UFortWeaponItemDefinition>(definition);
            data.ItemEntry = FFortItemEntry::MakeItemEntry(definition, stack, weapon ? weapon->GetClipSize() : -1);
            data.bShouldFreeItemEntryWhenDeconstructed = true;
            data.SpawnLocation = pawn->GetActorLocation() + pawn->GetActorForwardVector() * 200;
            data.SpawnLocation.Z += 100; data.bToss = true; data.bRandomRotation = true;
            Report(TrackPickup(data) ? std::string("Spawned ") + Catalog[item].label + ". Pick it up in front of you." : "The game could not spawn this pickup.");
        } else if (action == ClearBuilds) {
            auto buildings = UGameplayStatics::GetAllActorsOfClass(GetWorld(), ABuildingSMActor::StaticClass());
            int count = 0;
            for (int i = 0; i < buildings.Num(); ++i) {
                auto building = Cast<ABuildingSMActor>(buildings.at(i));
                if (!building || !building->IsValidLowLevel() || building->IsDestroyed() ||
                    building->IsActorBeingDestroyed() || !building->IsPlayerPlaced()) continue;
                building->SilentDie(); ++count;
            }
            buildings.Free();
            Report("Removed " + std::to_string(count) + " player builds. Map structures kept.");
        } else if (action == Heal) {
            if (pawn->IsDBNO()) { Report("Respawn or get revived before healing."); return; }
            Report(RestoreHealth(pawn) ? "Health and shield restored." : "Health restored; shield restoration is unavailable in this build.");
        } else if (action == Materials || action == Ammo) {
            int count = TopUp(controller, action == Materials);
            if (action == Ammo) RefillMagazine(controller);
            Report(count ? "Supplies refilled." : "Required item definitions were not found.");
        } else if (action == Kit) {
            auto inventory = controller->GetWorldInventory();
            if (!inventory) { Report("Inventory is not ready."); return; }
            const char* weapons[] = { "WID_Assault_Auto_Athena_R_Ore_T03", "WID_Shotgun_Standard_Athena_C_Ore_T03" };
            int count = 0;
            for (auto name : weapons) {
                auto definition = FindObject<UFortWeaponItemDefinition>(name, nullptr, ANY_PACKAGE);
                if (!definition) continue;
                if (!inventory->FindItemInstance(definition)) {
                    bool update = false;
                    inventory->AddItem(definition, &update, 1, definition->GetClipSize());
                    if (update) inventory->Update();
                }
                ++count;
            }
            TopUp(controller, false); TopUp(controller, true);
            Report("Starter kit: " + std::to_string(count) + "/2 weapons available, ammo and materials refilled.");
        } else if (action == Loot) {
            if (SpawnedLoot.size() >= LootLimit) { Report("Loot limit reached. Clear spawned loot first."); return; }
            auto gameState = Cast<AFortGameStateAthena>(GetWorld()->GetGameState());
            if (!gameState) { Report("Match is not ready."); return; }
            auto mode = Cast<AFortGameModeAthena>(GetWorld()->GetGameMode());
            auto tier = UKismetStringLibrary::Conv_StringToName(L"Loot_AthenaTreasure");
            if (mode) tier = mode->RedirectLootTier(tier);
            auto drops = PickLootDrops(tier, gameState->GetWorldLevel(), -1, false);
            int count = 0;
            for (auto& drop : drops) {
                PickupCreateData data;
                data.ItemEntry = drop.ItemEntry;
                data.bShouldFreeItemEntryWhenDeconstructed = true;
                data.SpawnLocation = pawn->GetActorLocation() + pawn->GetActorForwardVector() * 200;
                data.SpawnLocation.Z += 100;
                data.bToss = true; data.bRandomRotation = true;
                data.SourceType = EFortPickupSourceTypeFlag::GetContainerValue();
                if (TrackPickup(data)) ++count;
            }
            Report(count ? "Spawned " + std::to_string(count) + " loot pickups in front of you." : "This playlist returned no chest loot.");
        }
    }

    void Tick(UNetDriver* driver) {
        if (InfinityShowdown::Enabled.load()) { TakeRequest(); return; }
        if (!Globals::bStartedListening || !driver) return;
        using Clock = std::chrono::steady_clock;
        static auto lastRefill = Clock::now();
        bool refill = Clock::now() - lastRefill >= std::chrono::milliseconds(500);
        auto request = TakeRequest();
        int action = request.action;
        if (!refill && action == None) return;
        if (refill) lastRefill = Clock::now();
        AFortPlayerControllerAthena* local = nullptr;
        int localCount = 0;
        auto& connections = driver->GetClientConnections();
        for (int i = 0; i < connections.Num(); ++i) {
            auto connection = connections.at(i);
            if (!connection) continue;
            auto controller = Cast<AFortPlayerControllerAthena>(connection->GetPlayerController());
            if (!IsLocal(controller)) continue;
            ++localCount;
            local = controller;
        }
        LocalPlayerCount.store(localCount);
        if (localCount != 1) {
            PlayerReady.store(false);
            if (!localCount) { SessionPlayer = {}; OriginalAppearance = {}; DeadController = {}; HasDeathLocation = false; HasSavedSpot.store(false); }
            if (action != None) Report(localCount ? "Local tools require exactly one local player." : "Join your local match first.");
            return;
        }
        if (SessionPlayer.Get() != local) {
            SessionPlayer = TrackedObject(local); OriginalAppearance = {}; DeadController = {}; HasDeathLocation = false; HasSavedSpot.store(false);
        }
        auto pawn = local->GetMyFortPawn();
        bool alive = pawn && pawn->IsValidLowLevel() && !pawn->IsActorBeingDestroyed() && pawn->GetHealth() > 0 && !pawn->IsDBNO() && DeadController.Get() != local;
        PlayerReady.store(alive);
        if (alive && !HasGauntlet(local->GetWorldInventory())) RememberAppearance(local);
        if (action != None) Execute(local, request.action, request.item, request.count);
        if (refill) PruneLoot();
        if (refill && alive && action == None) {
            if (InfiniteMaterials.load()) TopUp(local, true);
            if (InfiniteAmmo.load()) { TopUp(local, false); RefillMagazine(local); }
            if (AutoHeal.load()) RestoreHealth(pawn);
        }
    }
}
#include "LocalToolsCommands.inl"
