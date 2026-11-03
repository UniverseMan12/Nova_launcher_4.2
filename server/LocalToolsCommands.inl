#include "commands.h"
namespace LocalTools {
    void Command(AFortPlayerControllerAthena* controller, const std::vector<std::string>& args) {
        auto respond = [&](const std::string& message) {
            Report(message);
            auto text = std::wstring(message.begin(), message.end());
            SendMessageToConsole(controller, text.c_str());
        };
        if (!IsLocal(controller) || LocalPlayerCount.load() != 1) {
            respond("Local tools require exactly one loopback-connected player."); return;
        }
        std::string command = args.size() > 1 ? args[1] : "help";
        std::transform(command.begin(), command.end(), command.begin(), ::tolower);
        Action action = None;
        if (command == "respawn") action = Respawn;
        else if (command == "reset" || command == "fullreset") action = FullReset;
        else if (command == "clearinventory") action = ClearInventory;
        else if (command == "heal") action = Heal;
        else if (command == "loot") action = Loot;
        else if (command == "kit") action = Kit;
        else if (command == "materials") action = Materials;
        else if (command == "ammo") action = Ammo;
        else if (command == "clearbuilds") action = ClearBuilds;
        else if (command == "gauntlet") action = Gauntlet;
        else if (command == "clearloot") action = ClearLoot;
        else if (command == "save") action = SaveSpot;
        else if (command == "return") action = ReturnSpot;
        else if (command == "forget") action = ForgetSpot;
        if (action != None && args.size() == 2) {
            Execute(controller, action); respond(ReadStatus()); return;
        }
        std::atomic<bool>* toggle = nullptr;
        if (command == "infiniteammo") toggle = &InfiniteAmmo;
        else if (command == "infinitematerials") toggle = &InfiniteMaterials;
        else if (command == "practice") toggle = &PracticeRespawn;
        else if (command == "autoheal") toggle = &AutoHeal;
        if (toggle && args.size() == 3 && (args[2] == "on" || args[2] == "off")) {
            toggle->store(args[2] == "on"); respond(command + ": " + args[2]); return;
        }
        if (command == "status" && args.size() == 2) {
            respond(std::string(PlayerReady.load() ? "Alive" : "Waiting or dead") +
                " | Saved spot: " + (HasSavedSpot.load() ? "yes" : "no") +
                " | Tool loot: " + std::to_string(SpawnedLootCount.load()) + "/100"); return;
        }
        respond("cheat local reset/clearinventory/respawn/heal/loot/kit/gauntlet/materials/ammo/clearbuilds/clearloot/save/return/forget/status; infiniteammo/infinitematerials/practice/autoheal on/off");
    }
}
