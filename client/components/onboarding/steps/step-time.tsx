"use client";

import { ChoiceStep } from "@/components/onboarding/choice-step";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { dailyBudgets } from "@/lib/onboarding";

import type { StepProps } from "./types";

/** Selects the LOAD_TABLE row: how many activities Today's Mission holds. */
export function StepTime({ index, count, onNext, onBack }: StepProps) {
  const { dailyMinutes } = useOnboardingDraft();

  return (
    <ChoiceStep
      stepKey="time"
      stepIndex={index}
      stepCount={count}
      question="How long can you speak each day?"
      hint="Be honest rather than ambitious. Finishing a short Today's Mission beats abandoning a long one."
      groupLabel="Daily practice time"
      requirement="Choose how long you can practise to continue."
      options={dailyBudgets.map((budget) => ({
        value: budget.minutes,
        label: budget.label,
        detail: budget.detail,
      }))}
      value={dailyMinutes}
      onChange={(value) => updateDraft({ dailyMinutes: value })}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
