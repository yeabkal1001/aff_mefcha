"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Input } from "@/components/ui/input";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { lifePathById } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import type { StepProps } from "./types";

/**
 * The question is conditioned on the Life Path chosen a step earlier. On the
 * custom path this is where the learner writes their goal in full, since
 * there is no authored field list to offer them.
 */
export function StepField({ index, count, onNext, onBack }: StepProps) {
  const { lifePath, studyField } = useOnboardingDraft();
  const path = lifePathById(lifePath);
  const ready = studyField.trim().length > 0;
  const custom = path?.isCustom ?? false;

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
      requirement={
        custom
          ? "Write a sentence about what you're preparing for to continue."
          : "Tell your coach what to build conversations around to continue."
      }
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
          value={studyField}
          onChange={(event) => updateDraft({ studyField: event.target.value })}
          placeholder={
            custom
              ? "Speaking at my sister's wedding in December"
              : "Software Engineering"
          }
          aria-label={path?.fieldQuestion ?? "Your field"}
          className={
            custom
              ? "h-12 rounded-xl border-panel-border bg-panel px-4 text-body backdrop-blur-xl"
              : "h-12 rounded-xl border-panel-border bg-panel text-center text-base backdrop-blur-xl"
          }
        />
      </form>

      {custom && (
        <p className="mt-3 text-center text-caption leading-relaxed text-muted-foreground">
          A custom goal has no hand-written curriculum behind it yet, so your
          coach builds the scenes from what you wrote. The skills underneath are
          the same ones every other path practises.
        </p>
      )}

      {path && path.fieldSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {path.fieldSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              // Toggles rather than radios: they fill the field above, which
              // the learner is free to then edit into something else.
              aria-pressed={studyField === suggestion}
              onClick={() => updateDraft({ studyField: suggestion })}
              className={cn(
                "rounded-full border border-panel-border bg-panel px-3 py-1.5 text-caption backdrop-blur-xl",
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
