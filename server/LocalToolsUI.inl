#include "LocalToolsCatalog.h"
static inline void LauncherLocalToolsUI()
{
    if (InfinityShowdown::Enabled.load()) {
        ImGui::TextColored(ImVec4(0.82f, 0.65f, 1.f, 1.f), "INFINITY SHOWDOWN - EXPERIMENTAL");
        ImGui::TextWrapped("%s", InfinityShowdown::ReadInfo().c_str());
        ImGui::TextWrapped("10 respawns each. Loot is retained. After Thanos dies, random selection waits 20 seconds. Practice tools are disabled.");
        ImGui::Separator(); return;
    }
    if (!ImGui::CollapsingHeader("Local tools", ImGuiTreeNodeFlags_DefaultOpen)) return;
    const int players = LocalTools::LocalPlayerCount.load();
    const bool ready = LocalTools::PlayerReady.load();
    ImGui::TextColored(ready ? ImVec4(0.35f, 0.9f, 0.55f, 1) : ImVec4(1, 0.75f, 0.3f, 1),
        "%s", players == 0 ? "Join your match to use the tools" : players > 1 ? "One local player required" : ready ? "Player connected" : "Player connected - waiting or dead");
    if (ImGui::BeginTabBar("LocalToolsTabs")) {
        if (ImGui::BeginTabItem("Player")) {
            bool practice = LocalTools::PracticeRespawn.load();
            bool healing = LocalTools::AutoHeal.load();
            if (ImGui::Checkbox("Practice respawn", &practice)) LocalTools::PracticeRespawn.store(practice);
            if (ImGui::IsItemHovered()) ImGui::SetTooltip("Keeps your inventory and the round open after death.");
            ImGui::SameLine();
            if (ImGui::Checkbox("Auto-heal", &healing)) LocalTools::AutoHeal.store(healing);
            if (ImGui::IsItemHovered()) ImGui::SetTooltip("Restores health and shield every half second. Does not prevent instant death.");
            if (ImGui::Button("Respawn me")) LocalTools::Queue(LocalTools::Respawn);
            ImGui::SameLine();
            if (ImGui::Button("Heal + shield")) LocalTools::Queue(LocalTools::Heal);
            if (ImGui::Button("Full reset (exit Thanos)")) LocalTools::Queue(LocalTools::FullReset);
            if (ImGui::IsItemHovered()) ImGui::SetTooltip("Returns to your outfit, clears items, restores 100 health/shield and disables automatic refills.");
            ImGui::TextDisabled("Console: cheat local reset  |  cheat local respawn");
            if (ImGui::Button("Save my spot")) LocalTools::Queue(LocalTools::SaveSpot);
            ImGui::SameLine();
            if (ImGui::Button("Return to spot")) LocalTools::Queue(LocalTools::ReturnSpot);
            ImGui::SameLine();
            if (ImGui::Button("Clear spot")) LocalTools::Queue(LocalTools::ForgetSpot);
            ImGui::TextDisabled("%s", LocalTools::HasSavedSpot.load() ? "Saved spot also becomes your respawn point." : "No spot saved for this session.");
            ImGui::EndTabItem();
        }
        if (ImGui::BeginTabItem("Items")) {
            static int selected = 0, stack = 1;
            ImGui::SetNextItemWidth(330);
            if (ImGui::BeginCombo("Item", LocalTools::Catalog[selected].label)) {
                for (int i = 0; i < LocalTools::CatalogSize; ++i) {
                    if (ImGui::Selectable(LocalTools::Catalog[i].label, i == selected)) { selected = i; stack = 1; }
                }
                ImGui::EndCombo();
            }
            if (LocalTools::Catalog[selected].maxStack > 1) {
                ImGui::SetNextItemWidth(200);
                ImGui::SliderInt("Stack", &stack, 1, LocalTools::Catalog[selected].maxStack);
            }
            if (ImGui::Button("Spawn selected")) LocalTools::Queue(LocalTools::SpawnItem, selected, stack);
            ImGui::SameLine();
            if (ImGui::Button("Infinity Gauntlet")) LocalTools::Queue(LocalTools::Gauntlet);
            if (ImGui::Button("Spawn chest loot")) LocalTools::Queue(LocalTools::Loot);
            ImGui::SameLine();
            if (ImGui::Button("Give starter kit")) LocalTools::Queue(LocalTools::Kit);
            if (ImGui::Button("Clear inventory")) LocalTools::Queue(LocalTools::ClearInventory);
            ImGui::TextDisabled("Console: cheat local clearinventory");
            if (ImGui::Button("Clear spawned loot")) LocalTools::Queue(LocalTools::ClearLoot);
            ImGui::SameLine();
            ImGui::TextDisabled("%d / %d pickups", LocalTools::SpawnedLootCount.load(), LocalTools::LootLimit);
            ImGui::EndTabItem();
        }
        if (ImGui::BeginTabItem("Building & ammo")) {
            bool ammo = LocalTools::InfiniteAmmo.load(), materials = LocalTools::InfiniteMaterials.load();
            if (ImGui::Checkbox("Infinite ammo", &ammo)) LocalTools::InfiniteAmmo.store(ammo);
            ImGui::SameLine();
            if (ImGui::Checkbox("Infinite materials", &materials)) LocalTools::InfiniteMaterials.store(materials);
            if (ImGui::Button("Refill ammo")) LocalTools::Queue(LocalTools::Ammo);
            ImGui::SameLine();
            if (ImGui::Button("Refill materials")) LocalTools::Queue(LocalTools::Materials);
            if (ImGui::Button("Clear player builds")) LocalTools::Queue(LocalTools::ClearBuilds);
            ImGui::TextDisabled("Map buildings are kept. Supplies refill every half second.");
            ImGui::EndTabItem();
        }
        ImGui::EndTabBar();
    }
    ImGui::TextWrapped("%s", LocalTools::ReadStatus().c_str());
    ImGui::Separator();
}
