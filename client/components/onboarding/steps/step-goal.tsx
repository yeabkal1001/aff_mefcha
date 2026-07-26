"use client";

import { ChoiceStep } from "@/components/onboarding/choice-step";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { goalHorizons } from "@/lib/onboarding";

import type { StepProps } from "./types";

/** The only optional question, so it carries the only skip link. */
export function StepGoal({ index, count, onNext, onBack }: StepProps) {
  const { goalHorizon } = useOnboardingDraft();

  return (
    <ChoiceStep
      stepKey="goal"
      stepIndex={index}
      stepCount={count}
      question="Is anything waiting for you?"
      hint="A date changes what we practise first. Skip it if there isn't one."
      groupLabel="Goal horizon"
      requirement="Choose a timeframe, or skip this question."
      options={goalHorizons.map((horizon) => ({
        value: horizon.id,
        label: horizon.label,
        detail: horizon.detail,
      }))}
      value={goalHorizon}
      onChange={(value) => updateDraft({ goalHorizon: value })}
      onNext={onNext}
      onBack={onBack}
      secondary={
        <button
          type="button"
          onClick={() => {
            // Skipping is an answer of "no deadline", not a way past the
            // question. Advancing without clearing would keep a horizon the
            // learner picked, went back on, and then explicitly skipped.
            updateDraft({ goalHorizon: null });
            onNext();
          }}
          className="text-ui text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Skip this
        </button>
      }
    />
  );
}
