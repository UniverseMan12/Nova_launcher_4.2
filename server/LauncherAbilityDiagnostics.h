#pragma once
#include <atomic>
#include <cctype>
#include <string>
#include "Class.h"
#include "reboot.h"
#include "LauncherGameplayLog.h"

// Diagnostic-only limits keep repeated sprint requests from hiding gauntlet
// events or filling the profile log. No ability state is changed here.
inline void LauncherAbilityInvalid(const char* reason, int handle, bool pressed, int keySize, int key) noexcept {
    try {
        if (Fortnite_Version != 4.2) return;
        static std::atomic<unsigned> count{0};
        if (count.fetch_add(1, std::memory_order_relaxed) >= 8) return;
        LauncherGameplayLog(std::string("ability ") + reason + " handle=" + std::to_string(handle) +
            " input=" + (pressed ? "1" : "0") + " key-size=" + std::to_string(keySize) + " key=" + std::to_string(key));
    } catch (...) {}
}

class LauncherAbilityTrace {
    bool enabled = false;
    std::string identity;
public:
    LauncherAbilityTrace(UObject* ability, int handle, bool pressed, int keySize, int key) noexcept {
        try {
            if (Fortnite_Version != 4.2) return;
            if (!ability) {
                LauncherAbilityInvalid("unconfigured", handle, pressed, keySize, key);
                return;
            }
            const auto name = ability->GetName();
            auto lower = name;
            for (char& ch : lower) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
            const bool sprint = lower.find("sprint") != std::string::npos;
            const bool gauntlet = lower.find("carmine") != std::string::npos || lower.find("gauntlet") != std::string::npos || lower.find("thanos") != std::string::npos;
            if (!sprint && !gauntlet) return;
            static std::atomic<unsigned> sprintCount{0};
            static std::atomic<unsigned> gauntletCount{0};
            if ((sprint ? sprintCount : gauntletCount).fetch_add(1, std::memory_order_relaxed) >= (sprint ? 12u : 20u)) return;
            identity = " name=" + name + " handle=" + std::to_string(handle) +
                " input=" + (pressed ? "1" : "0") + " key-size=" + std::to_string(keySize) + " key=" + std::to_string(key);
            LauncherGameplayLog("ability received" + identity);
            enabled = true;
        } catch (...) {}
    }
    void Result(bool activated) noexcept {
        try {
            if (enabled) LauncherGameplayLog(std::string("ability result=") + (activated ? "activated" : "rejected") + identity);
        } catch (...) {}
    }
};
