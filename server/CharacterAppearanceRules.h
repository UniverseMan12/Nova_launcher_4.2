#pragma once
#include <cstdint>
#include <cmath>

namespace LauncherAppearanceRules {
    // Camera pitch/roll describe where the player is looking, not the capsule
    // orientation. A reset/teleport must not turn a grounded pawn on its side.
    template<class Rotation> inline Rotation Upright(Rotation rotation) {
        rotation.Pitch = 0;
        rotation.Roll = 0;
        rotation.Yaw = std::isfinite(rotation.Yaw) ? std::remainder(rotation.Yaw, 360.0) : 0;
        return rotation;
    }
    inline bool IsSkeletonSelector(uint8_t gender, uint8_t body) {
        return (gender == 1 || gender == 2) && (body == 1 || body == 2 || body == 4);
    }
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
