"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Input } from "@/components/ui/input";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";

import type { StepProps } from "./types";

export function StepName({ index, count, onNext, onBack }: StepProps) {
  const { name } = useOnboardingDraft();
  const ready = name.trim().length > 0;

  return (
    <OnboardingShell
      stepKey="name"
      stepIndex={index}
      stepCount={count}
      question="First — what should I call you?"
      hint="Your coach greets you by name from the very first line."
      onBack={onBack}
      onNext={onNext}
      canAdvance={ready}
      requirement="Tell your coach what to call you to continue."
      focusHeading={false}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onNext();
        }}
      >
        <Input
          autoFocus
          value={name}
          onChange={(event) => updateDraft({ name: event.target.value })}
          placeholder="Hana"
          aria-label="Your name"
          className="h-12 rounded-xl border-panel-border bg-panel text-center text-base backdrop-blur-xl"
        />
      </form>
    </OnboardingShell>
  );
}
