#include <filesystem>
#include <fstream>
#include <json.hpp>

static UObject* LauncherLoadCosmetic42(const std::string& id, const char* prefix, const char* folder, const char* className) {
    const std::string start = std::string(prefix) + ":";
    if (id.rfind(start, 0) != 0) return nullptr;
    const auto name = id.substr(start.size());
    if (name.empty() || name.size() > 128 || name.find_first_not_of("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_") != std::string::npos) return nullptr;
    auto type = FindObject<UClass>(std::string("/Script/FortniteGame.") + className);
    if (!type) return nullptr;
    const auto asset = std::string("/Game/Athena/Items/Cosmetics/") + folder + "/" + name + "." + name;
    auto object = LoadObject<UObject>(asset, type);
    return object && object->IsValidLowLevel() && object->IsA(type) ? object : nullptr;
}

// No-MCP hosts cannot reconstruct the local player's Athena loadout from the
// stock server RPC. The local backend already persisted that player's choices.
// This fallback MUST NOT assign the host's outfit to a remote/VPN player.
static bool LauncherReadLocalLocker42(AFortPlayerController* controller, FFortAthenaLoadout* loadout) {
    if (!LocalTools::IsLocal(controller) || !loadout || FFortAthenaLoadout::GetStructSize() != 0x88) return false;
    wchar_t directory[32768]{};
    const auto length = GetEnvironmentVariableW(L"LAUNCHER_PROFILE_DIR", directory, 32768);
    if (!length || length >= 32768) return false;
    try {
        const auto file = std::filesystem::path(directory) / L"locker.json";
        const auto size = std::filesystem::file_size(file);
        if (size < 2 || size > 32768) return false;
        std::ifstream input(file, std::ios::binary);
        const auto saved = nlohmann::json::parse(input, nullptr, false);
        if (saved.is_discarded() || saved.value("version", 0) != 1 || !saved.contains("selected") || !saved["selected"].is_object()) return false;
        const auto& selected = saved["selected"];
        struct Slot { const char* key; const char* field; const char* prefix; const char* folder; const char* type; };
        const Slot slots[] = {
            {"favorite_character", "Character", "AthenaCharacter", "Characters", "AthenaCharacterItemDefinition"},
            {"favorite_backpack", "Backpack", "AthenaBackpack", "Backpacks", "AthenaBackpackItemDefinition"},
            {"favorite_pickaxe", "Pickaxe", "AthenaPickaxe", "Pickaxes", "AthenaPickaxeItemDefinition"},
            {"favorite_glider", "Glider", "AthenaGlider", "Gliders", "AthenaGliderItemDefinition"},
            {"favorite_skydivecontrail", "SkyDiveContrail", "AthenaSkyDiveContrail", "Contrails", "AthenaSkyDiveContrailItemDefinition"},
            {"favorite_loadingscreen", "LoadingScreen", "AthenaLoadingScreen", "LoadingScreens", "AthenaLoadingScreenItemDefinition"}
        };
        bool characterLoaded = false;
        for (const auto& slot : slots) {
            if (!selected.contains(slot.key) || !selected[slot.key].is_string()) continue;
            const auto id = selected[slot.key].get<std::string>();
            const int offset = FindOffsetStruct("/Script/FortniteGame.FortAthenaLoadout", slot.field, false);
            if (offset < 0 || offset + sizeof(UObject*) > 0x88) continue;
            auto& destination = *reinterpret_cast<UObject**>(reinterpret_cast<uint8_t*>(loadout) + offset);
            if (id.empty()) {
                if (std::string(slot.field) == "Backpack" || std::string(slot.field) == "SkyDiveContrail") destination = nullptr;
                continue;
            }
            auto asset = LauncherLoadCosmetic42(id, slot.prefix, slot.folder, slot.type);
            if (!asset) { LOG_WARN(LogDev, "Launcher locker: asset unavailable in 4.2: {}", id); LauncherGameplayLog("unavailable=" + id); continue; }
            destination = asset;
            if (std::string(slot.field) == "Character") characterLoaded = true;
        }
        if (selected.contains("favorite_dance") && selected["favorite_dance"].is_array() && selected["favorite_dance"].size() <= 6) {
            const int offset = FindOffsetStruct("/Script/FortniteGame.FortAthenaLoadout", "Dances", false);
            if (offset >= 0 && offset + sizeof(TArray<UObject*>) <= 0x88) {
                TArray<UObject*> dances;
                for (const auto& entry : selected["favorite_dance"]) {
                    dances.Add(entry.is_string() ? LauncherLoadCosmetic42(entry.get<std::string>(), "AthenaDance", "Dances", "AthenaDanceItemDefinition") : nullptr);
                }
                auto& destination = *reinterpret_cast<TArray<UObject*>*>(reinterpret_cast<uint8_t*>(loadout) + offset);
                destination.Free(); destination = dances;
            }
        }
        return characterLoaded;
    } catch (...) {
        LOG_WARN(LogDev, "Launcher locker: local profile is not readable yet.");
        return false;
    }
}
