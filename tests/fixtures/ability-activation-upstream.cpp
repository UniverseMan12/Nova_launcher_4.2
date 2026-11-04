// Relevant unchanged AbilitySystemComponent_Abilities.cpp excerpt from Reboot 10c659028ad9d6816f78226483f11a884bf81f57.
#include "AbilitySystemComponent.h"
void UAbilitySystemComponent::InternalServerTryActivateAbilityHook(UAbilitySystemComponent* AbilitySystemComponent, FGameplayAbilitySpecHandle Handle, bool InputPressed, const FPredictionKey* PredictionKey, const FGameplayEventData* TriggerEventData) // https://github.com/EpicGames/UnrealEngine/blob/4.23/Engine/Plugins/Runtime/GameplayAbilities/Source/GameplayAbilities/Private/AbilitySystemComponent_Abilities.cpp#L1445
{
	using UGameplayAbility = UObject;

	auto Spec = AbilitySystemComponent->FindAbilitySpecFromHandle(Handle);

	static auto PredictionKeyStruct = FindObject<UStruct>(L"/Script/GameplayAbilities.PredictionKey");
	static auto PredictionKeySize = PredictionKeyStruct->GetPropertiesSize();
	static auto CurrentOffset = FindOffsetStruct("/Script/GameplayAbilities.PredictionKey", "Current");

	if (!Spec)
	{
		LOG_INFO(LogAbilities, "InternalServerTryActivateAbility. Rejecting ClientActivation of ability with invalid SpecHandle!");
		AbilitySystemComponent->ClientActivateAbilityFailed(Handle, *(int16_t*)(__int64(PredictionKey) + CurrentOffset));
		return;
	}

	AbilitySystemComponent->ConsumeAllReplicatedData(Handle, (FPredictionKey*)PredictionKey);

	/* const */ UGameplayAbility * AbilityToActivate = Spec->GetAbility();

	if (!AbilityToActivate)
	{
		LOG_ERROR(LogAbilities, "InternalServerTryActiveAbility. Rejecting ClientActivation of unconfigured spec ability!");
		AbilitySystemComponent->ClientActivateAbilityFailed(Handle, *(int16_t*)(__int64(PredictionKey) + CurrentOffset));
		return;
	}

	static auto InputPressedOffset = FindOffsetStruct("/Script/GameplayAbilities.GameplayAbilitySpec", "InputPressed");

	UGameplayAbility* InstancedAbility = nullptr;
	SetBitfield((PlaceholderBitfield*)(__int64(Spec) + InputPressedOffset), 1, true); // InputPressed = true
	
	bool res = false;

	if (PredictionKeySize == 0x10)
		res = UAbilitySystemComponent::InternalTryActivateAbilityOriginal(AbilitySystemComponent, Handle, *(PadHex10*)PredictionKey, &InstancedAbility, nullptr, TriggerEventData);
	else if (PredictionKeySize == 0x18)
		res = UAbilitySystemComponent::InternalTryActivateAbilityOriginal2(AbilitySystemComponent, Handle, *(PadHex18*)PredictionKey, &InstancedAbility, nullptr, TriggerEventData);
	else
		LOG_ERROR(LogAbilities, "Prediction key size does not match with any of them!");

	if (!res)
	{
		LOG_INFO(LogAbilities, "InternalServerTryActivateAbility. Rejecting ClientActivation of {}. InternalTryActivateAbility failed: ", AbilityToActivate->GetName());

		AbilitySystemComponent->ClientActivateAbilityFailed(Handle, *(int16_t*)(__int64(PredictionKey) + CurrentOffset));
		SetBitfield((PlaceholderBitfield*)(__int64(Spec) + InputPressedOffset), 1, false); // InputPressed = false

		AbilitySystemComponent->GetActivatableAbilities()->MarkItemDirty(Spec);
	}
	else
	{
		// LOG_INFO(LogAbilities, "InternalServerTryActivateAbility. Activated {}", AbilityToActivate->GetName());
	}
}

