#pragma once
#include <atomic>
#include <mutex>
#include <string>
#include <vector>
class UNetDriver;
class AFortPlayerController;
class AFortPlayerControllerAthena;

namespace LocalTools {
    enum Action { None, Respawn, Heal, Loot, Kit, Materials, Ammo, ClearBuilds, Gauntlet, SpawnItem, ClearLoot, SaveSpot, ReturnSpot, ForgetSpot, ClearInventory, FullReset };
    struct Request { Action action = None; int item = 0; int count = 1; };
    inline std::mutex QueueMutex;
    inline Request Pending;
    inline std::atomic<bool> PracticeRespawn(true), InfiniteAmmo(false), InfiniteMaterials(false);
    inline std::atomic<bool> AutoHeal(false), HasSavedSpot(false), PlayerReady(false);
    inline std::atomic<int> SpawnedLootCount(0), LocalPlayerCount(0);
    inline std::mutex StatusMutex;
    inline std::string Status = "Join your local match to use these tools.";
    inline void Report(const std::string& message) {
        std::lock_guard<std::mutex> guard(StatusMutex); Status = message;
    }
    inline std::string ReadStatus() {
        std::lock_guard<std::mutex> guard(StatusMutex); return Status;
    }
    inline void Queue(Action action, int item = 0, int count = 1) {
        std::lock_guard<std::mutex> guard(QueueMutex);
        if (Pending.action != None) { Report("An action is already waiting."); return; }
        Pending = { action, item, count }; Report("Waiting for the game...");
    }
    inline Request TakeRequest() {
        std::lock_guard<std::mutex> guard(QueueMutex);
        auto request = Pending; Pending = {}; return request;
    }
    void RememberAppearance(AFortPlayerController* controller, bool refresh = false);
    bool IsLocal(AFortPlayerController* controller);
    bool OnDeath(AFortPlayerController* controller, bool& newHandledDeath);
    void Tick(UNetDriver* driver);
    void Execute(AFortPlayerControllerAthena* controller, Action action, int item = 0, int count = 1);
    void Command(AFortPlayerControllerAthena* controller, const std::vector<std::string>& arguments);
}
