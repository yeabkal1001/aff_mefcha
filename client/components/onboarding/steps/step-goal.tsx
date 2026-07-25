"use client";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { goalHorizons } from "@/lib/onboarding";

import type { StepProps } from "./types";

/** The only optional question, so it carries the only skip link. */
export function StepGoal({ index, count, onNext, onBack }: StepProps) {
  const { goalHorizon } = useOnboardingDraft();

  return (
    <OnboardingShell
      stepKey="goal"
      stepIndex={index}
      stepCount={count}
      question="Is anything waiting for you?"
      hint="A date changes what we practise first. Skip it if there isn't one."
      onBack={onBack}
      onNext={onNext}
      canAdvance={goalHorizon !== null}
      secondary={
        <button
          type="button"
          onClick={onNext}
          className="text-[0.8125rem] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Skip this
        </button>
      }
    >
      <div role="radiogroup" aria-label="Goal horizon" className="space-y-2">
        {goalHorizons.map((horizon) => (
          <ChoiceButton
            key={horizon.id}
            selected={goalHorizon === horizon.id}
            onSelect={() => updateDraft({ goalHorizon: horizon.id })}
            label={horizon.label}
            detail={horizon.detail}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
