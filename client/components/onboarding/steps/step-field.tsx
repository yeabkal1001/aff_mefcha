"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Input } from "@/components/ui/input";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { lifePathById } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import type { StepProps } from "./types";

/** The question itself is conditioned on the Life Path chosen a step earlier. */
export function StepField({ index, count, onNext, onBack }: StepProps) {
  const { lifePath, studyField } = useOnboardingDraft();
  const path = lifePathById(lifePath);
  const ready = studyField.trim().length > 0;

  return (
    <OnboardingShell
      stepKey="field"
      stepIndex={index}
      stepCount={count}
      question={path?.fieldQuestion ?? "What are you working towards?"}
      hint={path?.fieldHint}
      onBack={onBack}
      onNext={onNext}
      canAdvance={ready}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onNext();
        }}
      >
        <Input
          autoFocus
          value={studyField}
          onChange={(event) => updateDraft({ studyField: event.target.value })}
          placeholder="Software Engineering"
          aria-label={path?.fieldQuestion ?? "Your field"}
          className="h-12 rounded-xl border-panel-border bg-panel text-center text-[1rem] backdrop-blur-xl"
        />
      </form>

      {path && path.fieldSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {path.fieldSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => updateDraft({ studyField: suggestion })}
              className={cn(
                "rounded-full border border-panel-border bg-panel px-3 py-1.5 text-[0.75rem] backdrop-blur-xl",
                "transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                studyField === suggestion
                  ? "border-foreground/60 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </OnboardingShell>
  );
}
