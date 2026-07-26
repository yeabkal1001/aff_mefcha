"use client";

import { ChoiceStep } from "@/components/onboarding/choice-step";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { ageBands } from "@/lib/onboarding";

import type { StepProps } from "./types";

/**
 * Age decides the register and the rooms the generator writes scenes in. A
 * band is enough for that, and asking for a birthday would collect more than
 * the product can use.
 */
export function StepAge({ index, count, onNext, onBack }: StepProps) {
  const { ageBand } = useOnboardingDraft();

  return (
    <ChoiceStep
      stepKey="age"
      stepIndex={index}
      stepCount={count}
      question="How old are you?"
      hint="It decides the situations your coach puts you in — a classroom or a meeting room."
      groupLabel="Age range"
      requirement="Choose an age range to continue."
      options={ageBands.map((band) => ({
        value: band.id,
        label: band.label,
        detail: band.detail,
      }))}
      value={ageBand}
      onChange={(value) => updateDraft({ ageBand: value })}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
