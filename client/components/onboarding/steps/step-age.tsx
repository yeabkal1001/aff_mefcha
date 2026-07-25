"use client";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
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
    <OnboardingShell
      stepKey="age"
      stepIndex={index}
      stepCount={count}
      question="How old are you?"
      hint="It decides the situations your coach puts you in — a classroom or a meeting room."
      onBack={onBack}
      onNext={onNext}
      canAdvance={ageBand !== null}
    >
      <div role="radiogroup" aria-label="Age range" className="space-y-2">
        {ageBands.map((band) => (
          <ChoiceButton
            key={band.id}
            selected={ageBand === band.id}
            onSelect={() => updateDraft({ ageBand: band.id })}
            label={band.label}
            detail={band.detail}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
