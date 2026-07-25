"use client";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { nativeLanguageById, type FeedbackLanguage } from "@/lib/onboarding";

import type { StepProps } from "./types";

/**
 * Decides whether corrections are spoken in English only or also in the
 * learner's own language through Addis AI TTS.
 */
export function StepFeedback({ index, count, onNext, onBack }: StepProps) {
  const { feedbackLanguage, l1 } = useOnboardingDraft();
  const language = nativeLanguageById(l1 ?? "");
  const hasL1 = Boolean(language && language.id !== "other");
  const l1Name = language?.name ?? "your language";

  const options: { id: FeedbackLanguage; label: string; detail: string }[] = [
    {
      id: "both",
      label: `English, explained in ${l1Name}`,
      detail: "You hear the fix in English and why it's wrong in your own words.",
    },
    {
      id: "l1",
      label: `${l1Name} only`,
      detail: "Corrections explained entirely in your language.",
    },
    {
      id: "english",
      label: "English only",
      detail: "Full immersion. Harder at first, faster later.",
    },
  ];

  const visible = hasL1 ? options : options.filter((o) => o.id === "english");

  return (
    <OnboardingShell
      stepKey="feedback"
      stepIndex={index}
      stepCount={count}
      question="When I correct you, which language should I use?"
      hint="Understanding why something was wrong matters more than hearing it in English."
      onBack={onBack}
      onNext={onNext}
      canAdvance={feedbackLanguage !== null}
    >
      <div role="radiogroup" aria-label="Feedback language" className="space-y-2">
        {visible.map((option) => (
          <ChoiceButton
            key={option.id}
            selected={feedbackLanguage === option.id}
            onSelect={() => updateDraft({ feedbackLanguage: option.id })}
            label={option.label}
            detail={option.detail}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
