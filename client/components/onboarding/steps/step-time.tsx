"use client";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { dailyBudgets } from "@/lib/onboarding";

import type { StepProps } from "./types";

/** Selects the LOAD_TABLE row: how many activities a mission holds. */
export function StepTime({ index, count, onNext, onBack }: StepProps) {
  const { dailyMinutes } = useOnboardingDraft();

  return (
    <OnboardingShell
      stepKey="time"
      stepIndex={index}
      stepCount={count}
      question="How long can you speak each day?"
      hint="Be honest rather than ambitious — a mission you finish beats one you abandon."
      onBack={onBack}
      onNext={onNext}
      canAdvance={dailyMinutes !== null}
    >
      <div role="radiogroup" aria-label="Daily practice time" className="space-y-2">
        {dailyBudgets.map((budget) => (
          <ChoiceButton
            key={budget.minutes}
            selected={dailyMinutes === budget.minutes}
            onSelect={() => updateDraft({ dailyMinutes: budget.minutes })}
            label={budget.label}
            detail={budget.detail}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
