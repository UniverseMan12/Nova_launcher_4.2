#include "CharacterAppearanceRules.h"
#include <cassert>

int main() {
    using namespace LauncherAppearanceRules;
    // Default female body must not retain the male player-state default.
    assert(ChooseGender(2, 1) == 2);
    // Black Knight must not inherit the female fallback's skeleton.
    assert(ChooseGender(1, 2) == 1);
    assert(ChooseGender(3, 2) == 2);
    assert(ChooseGender(3, 0) == 1);
    assert(ChooseGender(3, 3) == 1);
    // Incompatible head/body definitions must fail before any state is changed.
    assert(ChooseGender(1 & 2, 2) == 0);
    assert(ChooseBody(1 & 4, 2) == 0);
    // After Thanos (large), a medium outfit must select a medium master mesh.
    assert(ChooseBody(2, 4) == 2);
    assert(ChooseBody(7, 4) == 4);
    assert(ChooseBody(7, 0) == 2);
    assert(ChooseBody(3, 7) == 2);
    assert(ChooseBody(4, 2) == 4);
    assert(ChooseBody(1, 2) == 1);
    for (int allowed = 0; allowed < 8; ++allowed) {
        for (int previous = 0; previous < 10; ++previous) {
            const auto body = ChooseBody(allowed, previous);
            assert(body == 0 || body == 1 || body == 2 || body == 4);
            assert(!body || (allowed & body));
        }
    }
}
