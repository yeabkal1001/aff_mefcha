"use client";

import { ChoiceStep } from "@/components/onboarding/choice-step";
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
    <ChoiceStep
      stepKey="gender"
      stepIndex={index}
      stepCount={count}
      question="How should your coach refer to you?"
      hint="This changes how the coach speaks about you, and nothing else."
      groupLabel="How to refer to you"
      requirement="Choose an option to continue. “Prefer not to say” is one of them."
      options={genders.map((option) => ({
        value: option.id,
        label: option.label,
      }))}
      value={gender}
      onChange={(value) => updateDraft({ gender: value })}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
