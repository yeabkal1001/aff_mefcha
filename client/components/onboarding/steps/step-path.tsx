"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { lifePaths } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import type { StepProps } from "./types";

/**
 * The product's central question, and the largest single lever in the
 * generator: it sets domain priority, the context every scene is skinned with,
 * the vocabulary overlay, template preference, and three of the eight Profile
 * Dimensions.
 *
 * Planned paths are shown disabled rather than hidden. Hiding them understates
 * the roadmap; enabling them would generate sessions with no overlay behind
 * them.
 */
export function StepPath({ index, count, onNext, onBack }: StepProps) {
  const { lifePath } = useOnboardingDraft();
  const chosen = lifePaths.find((path) => path.id === lifePath);

  return (
    <OnboardingShell
      stepKey="path"
      stepIndex={index}
      stepCount={count}
      question="Why do you want to speak better English?"
      hint="Not a topic — a destination. Every conversation you practise will be set in the world you pick."
      onBack={onBack}
      onNext={onNext}
      canAdvance={Boolean(lifePath)}
      wide
    >
      <div
        role="radiogroup"
        aria-label="Life Path"
        className="grid gap-2 sm:grid-cols-2"
      >
        {lifePaths.map((path) => {
          const Icon = path.icon;
          const selected = lifePath === path.id;

          return (
            <button
              key={path.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!path.live}
              onClick={() => updateDraft({ lifePath: path.id })}
              className={cn(
                "surface-panel relative flex items-start gap-3 rounded-xl p-3 text-left",
                "transition-[border-color,transform,box-shadow] duration-200",
                "hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected &&
                  "border-foreground/70 shadow-[0_14px_36px_-20px_oklch(0.3_0.05_280/55%)]",
                !path.live && "pointer-events-none opacity-40",
              )}
            >
              {!path.live ? (
                <span className="absolute right-3 top-3 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              ) : path.isDefault ? (
                <span className="absolute right-3 top-3 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Default
                </span>
              ) : null}

              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                  selected
                    ? "bg-foreground text-background"
                    : "bg-foreground/[0.05] text-foreground/70",
                )}
              >
                <Icon className="size-[1.125rem]" strokeWidth={1.75} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block pr-8 text-[0.875rem] font-semibold leading-tight text-foreground">
                  {path.name}
                </span>
                <span className="mt-1 block text-[0.75rem] leading-snug text-muted-foreground">
                  {path.tagline}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Held outside the grid so choosing a path cannot reflow it. */}
      <div className="mt-3 flex min-h-[1.75rem] flex-wrap items-center justify-center gap-1.5">
        {chosen && (
          <>
            <span className="text-[0.75rem] text-muted-foreground">
              You&apos;ll be measured on
            </span>
            {chosen.dimensions.map((dimension) => (
              <span
                key={dimension}
                className="rounded-full bg-foreground/[0.055] px-2 py-0.5 text-[0.6875rem] text-foreground/75"
              >
                {dimension}
              </span>
            ))}
          </>
        )}
      </div>
    </OnboardingShell>
  );
}
