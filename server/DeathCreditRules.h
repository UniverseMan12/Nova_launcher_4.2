#pragma once
#include <cstdint>
#include <unordered_set>

namespace DeathCreditRules {
    // A life token includes the UObject slot and its serial number. Keep all
    // claims for this player/session so delayed duplicate events cannot score.
    struct HandledDeaths {
        std::unordered_set<uint64_t> lives;
        bool Claim(uint64_t life) {
            return life != 0 && lives.insert(life).second;
        }
    };
}
