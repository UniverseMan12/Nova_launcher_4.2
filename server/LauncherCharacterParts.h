#pragma once
#include "CharacterAppearanceRules.h"
#include "LauncherGameplayLog.h"

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
    const auto body = LauncherAppearanceRules::ChooseBody(bodies, oldBody);
    if (!gender || !body) return false;
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
