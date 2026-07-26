"use client";

import { ChoiceStep } from "@/components/onboarding/choice-step";
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

  // There is no "your language only" option on purpose: a correction the
  // learner never hears in English gives them nothing to repeat, and the retry
  // is the step the whole immediate-feedback loop rests on.
  const options: { value: FeedbackLanguage; label: string; detail: string }[] = [
    {
      value: "both",
      label: `English, explained in ${l1Name}`,
      detail: "You hear the fix in English and why it's wrong in your own words.",
    },
    {
      value: "english",
      label: "English only",
      detail: "Full immersion. Harder at first, faster later.",
    },
  ];

  return (
    <ChoiceStep
      stepKey="feedback"
      stepIndex={index}
      stepCount={count}
      question="When I correct you, which language should I use?"
      hint="Understanding why something was wrong matters more than hearing it in English."
      groupLabel="Feedback language"
      requirement="Choose a feedback language to continue."
      options={hasL1 ? options : options.filter((o) => o.value === "english")}
      value={feedbackLanguage}
      onChange={(value) => updateDraft({ feedbackLanguage: value })}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
