#pragma once
#include <filesystem>
#include <fstream>
#include <mutex>

inline void LauncherGameplayLog(const std::string& message) {
    static std::mutex mutex;
    static int lines = 0;
    std::lock_guard<std::mutex> lock(mutex);
    if (++lines > 500) return;
    wchar_t directory[32768]{};
    const auto length = GetEnvironmentVariableW(L"LAUNCHER_PROFILE_DIR", directory, 32768);
    if (!length || length >= 32768) return;
    try {
        std::ofstream file(std::filesystem::path(directory) / L"gameplay-044.log", std::ios::app);
        file << GetTickCount64() << " " << message << '\n';
    } catch (...) {}
}
