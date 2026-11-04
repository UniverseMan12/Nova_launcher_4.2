// Included inside LocalTools; captures normal parts before native gadget equip.
struct Appearance { bool saved = false; TrackedObject parts[6], animation; uint8_t gender = 0, body = 0; };
struct AppearanceState { Appearance appearance; };
static AppearanceState OriginalAppearance;
    static bool AppearanceOffsets(UObject* state, int& parts, int& gender, int& body) {
        if (!state || Fortnite_Version != 4.2) return false;
        parts = state->GetOffset("CharacterParts", false);
        gender = state->GetOffset("CharacterGender", false);
        body = state->GetOffset("CharacterBodyType", false);
        // Reject a different layout instead of treating a newer struct as the
        // fixed pointer array used by the supported 4.2 SDK.
        return parts >= 0 && gender >= 0 && body >= 0 &&
            state->GetOffset("CharacterColorSwatches", false) - parts == 6 * sizeof(UObject*);
    }
    static bool SaveAppearance(AFortPlayerControllerAthena* controller, AppearanceState& player, bool refresh = false) {
        if (player.appearance.saved && !refresh) return true;
        auto state = controller->GetPlayerState(); auto pawn = controller->GetMyFortPawn();
        int parts, gender, body;
        if (!pawn || !AppearanceOffsets(state, parts, gender, body) || LauncherIsGauntletAppearance42(state, pawn)) return false;
        const int animation = pawn->GetOffset("AnimBPOverride", false);
        if (animation < 0) return false;
        auto source = state->GetPtr<UObject*>(parts);
        if (!source[0] || !source[1]) return false;
        Appearance saved;
        for (int i = 0; i < 6; ++i) {
            if (source[i] && !source[i]->IsValidLowLevel()) return false;
            saved.parts[i] = TrackedObject(source[i]);
        }
        saved.gender = state->Get<uint8_t>(gender); saved.body = state->Get<uint8_t>(body);
        if (!LauncherValidAppearance42(source, saved.gender, saved.body)) return false;
        saved.animation = TrackedObject(pawn->Get<UObject*>(animation)); saved.saved = true;
        player.appearance = saved;
        LOG_INFO(LogDev, "Local tools: saved original appearance (gender {}, body {}).", int(saved.gender), int(saved.body));
        return true;
    }
    static bool RestoreAppearance(AFortPlayerControllerAthena* controller, const AppearanceState& player, bool notify, bool validateOnly = false) {
        const auto& saved = player.appearance;
        if (!saved.saved) return false;
        auto state = controller->GetPlayerState(); int parts, gender, body;
        if (!AppearanceOffsets(state, parts, gender, body)) return false;
        UObject* resolved[6]{};
        for (int i = 0; i < 6; ++i) {
            resolved[i] = saved.parts[i].Get();
            if (saved.parts[i].index >= 0 && !resolved[i]) return false;
        }
        auto originalAnimation = saved.animation.Get();
        if (saved.animation.index >= 0 && !originalAnimation) return false;
        if (validateOnly) return true;
        const auto previousGender = state->Get<uint8_t>(gender), previousBody = state->Get<uint8_t>(body);
        state->Get<uint8_t>(gender) = saved.gender; state->Get<uint8_t>(body) = saved.body;
        auto destination = state->GetPtr<UObject*>(parts);
        for (int i = 0; i < 6; ++i) destination[i] = resolved[i];
        if (!notify) {
            LOG_INFO(LogDev, "Local tools: restoring appearance before spawn (gender {} -> {}, body {} -> {}).",
                int(previousGender), int(saved.gender), int(previousBody), int(saved.body));
            return true;
        }
        // Only notify after Possess: gadget removal can have cleared the old
        // pawn, and the new pawn must initialize its skeleton from normal data.
        auto pawn = controller->GetMyFortPawn(); if (!pawn) return false;
        for (auto name : {"OnRep_CharacterGender", "OnRep_CharacterBodyType", "OnRep_CharacterParts"})
            if (auto fn = state->FindFunction(name)) state->ProcessEvent(fn);
        const int animation = pawn->GetOffset("AnimBPOverride", false);
        if (animation < 0) return false;
        auto currentAnimation = pawn->Get<UObject*>(animation);
        if (currentAnimation != originalAnimation) {
            if (currentAnimation) {
                auto clear = pawn->FindFunction("ClearAnimBPOverride"); if (!clear) return false;
                pawn->ProcessEvent(clear, &currentAnimation);
            }
            if (originalAnimation) {
                auto set = pawn->FindFunction("SetAnimBPOverride"); if (!set) return false;
                pawn->ProcessEvent(set, &originalAnimation);
            }
        }
        state->ForceNetUpdate(); pawn->ForceNetUpdate();
        return true;
    }

    void RememberAppearance(AFortPlayerController* controller, bool refresh) {
        if (InfinityShowdown::Enabled.load() || !IsLocal(controller)) return;
        if (SessionPlayer.Get() != controller) {
            SessionPlayer = TrackedObject(controller); DeadController = {};
            HasDeathLocation = false; HasSavedSpot.store(false); OriginalAppearance = {};
        }
        // Keep the previous valid snapshot if a new loadout is incomplete or a
        // repeated gadget equip is still displaying Thanos. Publish only after
        // all replacement parts, selectors and animation references validate.
        SaveAppearance(static_cast<AFortPlayerControllerAthena*>(controller), OriginalAppearance, refresh);
    }
