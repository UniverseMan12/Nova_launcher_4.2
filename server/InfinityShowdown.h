#pragma once
#include <atomic>
#include <mutex>
#include <string>
class AFortPlayerController;
class UFortItemDefinition;
class UNetDriver;
class AFortGameModeAthena;
class UObject;
namespace InfinityShowdown {
    inline std::atomic<bool> Enabled(false);
    inline std::atomic<bool> BusRequested(false);
    inline std::mutex InfoMutex;
    inline std::string Info = "Waiting for the Battle Bus. Every player has 10 respawns.";
    inline void Report(const std::string& value) { std::lock_guard<std::mutex> lock(InfoMutex); Info = value; }
    inline std::string ReadInfo() { std::lock_guard<std::mutex> lock(InfoMutex); return Info; }
    bool OnDeath(AFortPlayerController* controller, bool& newHandledDeath);
    bool CanJumpFromBus(AFortPlayerController* controller);
    void Tick(UNetDriver* driver);
    void GadgetApplied(AFortPlayerController* controller, UFortItemDefinition* definition, bool success);
    bool BeginZone(AFortGameModeAthena* mode);
    void HoldZone(AFortGameModeAthena* mode);
    void ConfigurePlaylist(UObject* playlist);
}
