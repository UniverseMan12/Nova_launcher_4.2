#pragma once
#include "CharacterAppearanceRules.h"
#include "LauncherGameplayLog.h"
#include "SoftObjectPtr.h"

static bool LauncherValidAppearance42(UObject* const* parts, uint8_t gender, uint8_t body) {
    if (!LauncherAppearanceRules::IsSkeletonSelector(gender, body)) return false;
    auto partClass = FindObject<UClass>(L"/Script/FortniteGame.CustomCharacterPart");
    if (!partClass) return false;
    for (int i = 0; i < 6; ++i) {
        auto part = parts[i];
        if (!part) { if (i < 2) return false; continue; }
        if (!part->IsValidLowLevel() || !part->IsA(partClass)) return false;
        const int type = part->GetOffset("CharacterPartType", false);
        if (type < 0 || part->Get<uint8_t>(type) != i) return false;
        if (i < 2) {
            const int genders = part->GetOffset("GenderPermitted", false), bodies = part->GetOffset("BodyTypesPermitted", false);
            if (genders < 0 || bodies < 0 || !(part->Get<uint8_t>(genders) & gender) || !(part->Get<uint8_t>(bodies) & body)) return false;
        }
    }
    return true;
}

// Resolve a complete hero before changing any slots. Some hero definitions
// put the head and body in separate specializations; applying them separately
// against the previous Thanos body can reject both intermediate combinations.
static bool LauncherCollectHeroParts42(UObject* hero, UObject* backpack, TArray<UObject*>& parts) {
    if (!hero || !hero->IsValidLowLevel()) return false;
    const int offset = hero->GetOffset("Specializations", false);
    if (offset < 0) return false;
    auto& specializations = hero->Get<TArray<TSoftObjectPtr<UObject>>>(offset);
    if (specializations.Num() < 1 || specializations.Num() > 32) return false;
    auto specializationClass = FindObject<UClass>(L"/Script/FortniteGame.FortHeroSpecialization");
    auto partClass = FindObject<UClass>(L"/Script/FortniteGame.CustomCharacterPart");
    if (!specializationClass || !partClass) return false;
    for (int i = 0; i < specializations.Num(); ++i) {
        auto specialization = specializations.at(i, GetSoftObjectSize()).Get(specializationClass, true);
        if (!specialization || !specialization->IsValidLowLevel()) return false;
        const int sourceOffset = specialization->GetOffset("CharacterParts", false);
        if (sourceOffset < 0) return false;
        auto& source = specialization->Get<TArray<TSoftObjectPtr<UObject>>>(sourceOffset);
        if (source.Num() < 0 || source.Num() > 32 || parts.Num() + source.Num() > 58) return false;
        for (int z = 0; z < source.Num(); ++z) {
            auto part = source.at(z, GetSoftObjectSize()).Get(partClass, true);
            if (!part) return false;
            parts.Add(part);
        }
    }
    if (backpack) {
        if (!backpack->IsValidLowLevel()) return false;
        const int sourceOffset = backpack->GetOffset("CharacterParts", false);
        if (sourceOffset < 0) return false;
        auto& source = backpack->Get<TArray<UObject*>>(sourceOffset);
        if (source.Num() < 0 || source.Num() > 6) return false;
        for (int i = 0; i < source.Num(); ++i) if (auto part = source.at(i)) parts.Add(part);
    }
    return parts.Num() >= 2;
}

// Fortnite 4.2 stores six pointers directly on PlayerState. It does not have
// the later CustomCharacterParts wrapper. Resolve everything before writing.
static bool LauncherApplyParts42(UObject* state, const TArray<UObject*>& selected, bool replace = false, bool notify = true) {
    if (Fortnite_Version != 4.2 || !state || selected.Num() < 1 || selected.Num() > 64) return false;
    const int partsOffset = state->GetOffset("CharacterParts", false);
    const int genderOffset = state->GetOffset("CharacterGender", false);
    const int bodyOffset = state->GetOffset("CharacterBodyType", false);
    if (partsOffset < 0 || genderOffset < 0 || bodyOffset < 0 ||
        state->GetOffset("CharacterColorSwatches", false) - partsOffset != 6 * sizeof(UObject*)) return false;
    auto partClass = FindObject<UClass>(L"/Script/FortniteGame.CustomCharacterPart");
    if (!partClass) return false;
    auto current = state->GetPtr<UObject*>(partsOffset);
    UObject* resolved[6]{};
    if (!replace) for (int i = 0; i < 6; ++i) resolved[i] = current[i];
    for (int i = 0; i < selected.Num(); ++i) {
        auto part = selected.at(i);
        if (!part || !part->IsValidLowLevel() || !part->IsA(partClass)) return false;
        const int typeOffset = part->GetOffset("CharacterPartType", false);
        if (typeOffset < 0) return false;
        const auto type = part->Get<uint8_t>(typeOffset);
        if (type >= 6) return false;
        resolved[type] = part;
    }
    uint8_t genders = 3, bodies = 7;
    for (int i = 0; i < 2; ++i) {
        auto part = resolved[i];
        if (!part || !part->IsValidLowLevel() || !part->IsA(partClass)) return false;
        const int gender = part->GetOffset("GenderPermitted", false), body = part->GetOffset("BodyTypesPermitted", false);
        if (gender < 0 || body < 0) return false;
        genders &= part->Get<uint8_t>(gender); bodies &= part->Get<uint8_t>(body);
    }
    const auto oldGender = state->Get<uint8_t>(genderOffset), oldBody = state->Get<uint8_t>(bodyOffset);
    const auto gender = LauncherAppearanceRules::ChooseGender(genders, oldGender);
    // A full normal outfit must select its own skeleton, not inherit the large
    // skeleton from a prior gadget merely because the part permits several sizes.
    const auto body = LauncherAppearanceRules::ChooseBody(bodies, replace ? 0 : oldBody);
    if (!LauncherValidAppearance42(resolved, gender, body)) return false;
    bool changed = oldGender != gender || oldBody != body;
    for (int i = 0; i < 6; ++i) changed |= current[i] != resolved[i];
    state->Get<uint8_t>(genderOffset) = gender; state->Get<uint8_t>(bodyOffset) = body;
    for (int i = 0; i < 6; ++i) current[i] = resolved[i];
    if (notify) {
        if (oldGender != gender) if (auto fn = state->FindFunction("OnRep_CharacterGender")) state->ProcessEvent(fn);
        if (oldBody != body) if (auto fn = state->FindFunction("OnRep_CharacterBodyType")) state->ProcessEvent(fn);
        if (auto fn = state->FindFunction("OnRep_CharacterParts")) state->ProcessEvent(fn);
    }
    if (changed) LOG_INFO(LogDev, "Launcher appearance: {} / {}, gender {} -> {}, body {} -> {}.",
        resolved[0]->GetName(), resolved[1]->GetName(), int(oldGender), int(gender), int(oldBody), int(body));
    if (changed) LauncherGameplayLog("parts=" + resolved[0]->GetName() + "/" + resolved[1]->GetName() +
        " gender=" + std::to_string(oldGender) + "->" + std::to_string(gender) + " body=" + std::to_string(oldBody) + "->" + std::to_string(body));
    return true;
}

// A gauntlet is inserted in the inventory before its native transformation is
// applied, so inventory presence cannot identify the appearance being captured.
// Compare the actual body/head and animation against the original gadget asset.
static bool LauncherIsGauntletAppearance42(UObject* state, UObject* pawn) {
    if (Fortnite_Version != 4.2 || !state || !pawn) return false;
    const int pawnAnimation = pawn->GetOffset("AnimBPOverride", false);
    auto gauntlet = FindObject<UObject>("AGID_CarminePack", nullptr, ANY_PACKAGE);
    if (!gauntlet || !gauntlet->IsValidLowLevel())
        return pawnAnimation >= 0 && pawn->Get<UObject*>(pawnAnimation) != nullptr;
    const int sourceOffset = gauntlet->GetOffset("CharacterParts", false);
    const int stateOffset = state->GetOffset("CharacterParts", false);
    if (sourceOffset >= 0 && stateOffset >= 0 &&
        state->GetOffset("CharacterColorSwatches", false) - stateOffset == 6 * sizeof(UObject*)) {
        auto& parts = gauntlet->Get<TArray<UObject*>>(sourceOffset);
        if (parts.Num() >= 0 && parts.Num() <= 6) for (int i = 0; i < parts.Num(); ++i) {
            auto part = parts.at(i);
            if (!part || !part->IsValidLowLevel()) continue;
            const int typeOffset = part->GetOffset("CharacterPartType", false);
            if (typeOffset < 0) continue;
            const auto type = part->Get<uint8_t>(typeOffset);
            if (type < 2 && state->GetPtr<UObject*>(stateOffset)[type] == part) return true;
        }
    }
    const int gadgetAnimation = gauntlet->GetOffset("AnimBPOverride", false);
    if (gadgetAnimation >= 0 && pawnAnimation >= 0) {
        auto animation = gauntlet->Get<UObject*>(gadgetAnimation);
        if (animation && pawn->Get<UObject*>(pawnAnimation) == animation) return true;
    }
    return false;
}
