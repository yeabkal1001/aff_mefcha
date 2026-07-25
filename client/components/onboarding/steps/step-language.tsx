"use client";

import { Globe } from "lucide-react";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
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
    <OnboardingShell
      stepKey="language"
      stepIndex={index}
      stepCount={count}
      question={`Nice to meet you, ${name || "there"}. What language do you think in?`}
      hint="It tells your coach which English sounds will trip you up, so it can work on those first."
      onBack={onBack}
      onNext={onNext}
      canAdvance={Boolean(l1)}
    >
      <div role="radiogroup" aria-label="Native language" className="space-y-2">
        {nativeLanguages.map((language) => (
          <ChoiceButton
            key={language.id}
            selected={l1 === language.id}
            onSelect={() => updateDraft({ l1: language.id })}
            label={language.name}
            detail={
              language.interference.length > 0
                ? `We'll watch for ${language.interference.slice(0, 2).join(" and ")}`
                : "We'll learn your patterns as you speak"
            }
            leading={
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-[0.8125rem] font-medium text-foreground/70">
                {language.endonym ? (
                  language.endonym.slice(0, 2)
                ) : (
                  <Globe className="size-4" strokeWidth={1.75} aria-hidden />
                )}
              </span>
            }
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
