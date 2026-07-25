"use client";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { genders } from "@/lib/onboarding";

import type { StepProps } from "./types";

/**
 * The narrowest question in the flow. It changes how the coach refers to the
 * learner and nothing else — not the curriculum, not the scenes, not the
 * scoring. "Prefer not to say" is a real answer, not a fallback.
 */
export function StepGender({ index, count, onNext, onBack }: StepProps) {
  const { gender } = useOnboardingDraft();

  return (
    <OnboardingShell
      stepKey="gender"
      stepIndex={index}
      stepCount={count}
      question="How should your coach refer to you?"
      hint="This changes how the coach speaks about you, and nothing else."
      onBack={onBack}
      onNext={onNext}
      canAdvance={gender !== null}
    >
      <div role="radiogroup" aria-label="How to refer to you" className="space-y-2">
        {genders.map((option) => (
          <ChoiceButton
            key={option.id}
            selected={gender === option.id}
            onSelect={() => updateDraft({ gender: option.id })}
            label={option.label}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
