#pragma once
#include <cstdint>

namespace LauncherAppearanceRules {
    // 4.2 uses bit masks for permitted genders/body sizes, but a single value
    // for the player. Never put Both/All into the player's skeleton selector.
    inline uint8_t ChooseGender(uint8_t allowed, uint8_t previous) {
        if ((previous == 1 || previous == 2) && (allowed & previous)) return previous;
        return (allowed & 1) ? 1 : (allowed & 2) ? 2 : 0;
    }
    inline uint8_t ChooseBody(uint8_t allowed, uint8_t previous) {
        if ((previous == 1 || previous == 2 || previous == 4) && (allowed & previous)) return previous;
        return (allowed & 2) ? 2 : (allowed & 1) ? 1 : (allowed & 4) ? 4 : 0;
    }
}
