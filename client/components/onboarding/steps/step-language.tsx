"use client";

import { Globe } from "lucide-react";

import { ChoiceStep } from "@/components/onboarding/choice-step";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { nativeLanguages } from "@/lib/onboarding";

import type { StepProps } from "./types";

/**
 * L1 is not a courtesy question. It feeds `l1_risk`, which is 10% of
 * competency priority, and it decides which sound contrasts get promoted.
 */
export function StepLanguage({ index, count, onNext, onBack }: StepProps) {
  const { l1, name } = useOnboardingDraft();

  return (
    <ChoiceStep
      stepKey="language"
      stepIndex={index}
      stepCount={count}
      question={`Nice to meet you, ${name || "there"}. What language do you think in?`}
      hint="It tells your coach which English sounds will trip you up, so it can work on those first."
      groupLabel="Native language"
      requirement="Choose the language you think in to continue."
      options={nativeLanguages.map((language) => ({
        value: language.id,
        label: language.name,
        detail:
          language.interference.length > 0
            ? `We'll watch for ${language.interference.slice(0, 2).join(" and ")}`
            : "We'll learn your patterns as you speak",
        leading: (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-ui font-medium text-foreground/70">
            {language.endonym ? (
              language.endonym.slice(0, 2)
            ) : (
              <Globe className="size-4" strokeWidth={1.75} aria-hidden />
            )}
          </span>
        ),
      }))}
      value={l1}
      onChange={(value) => {
        // "Another language" has no Amharic or Tigrinya TTS behind it, so the
        // bilingual feedback option disappears with it. Leaving `both`
        // selected would carry an answer the next screen no longer offers.
        const loses = value === "other";
        updateDraft({ l1: value, ...(loses ? { feedbackLanguage: null } : {}) });
      }}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
