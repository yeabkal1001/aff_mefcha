"use client";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { lifePaths, type LifePathId } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import type { StepProps } from "./types";

/**
 * The product's central question, and the largest single lever in the
 * generator: it sets domain priority, the context every scene is skinned with,
 * the vocabulary overlay, template preference, and two of the six Profile
 * Dimensions — the other four are fixed for every learner.
 *
 * Planned paths are shown disabled rather than hidden. Hiding them understates
 * the roadmap; enabling them would generate sessions with no overlay behind
 * them.
 */
export function StepPath({ index, count, onNext, onBack }: StepProps) {
  const { lifePath } = useOnboardingDraft();
  const chosen = lifePaths.find((path) => path.id === lifePath);

  const choose = (id: LifePathId) => {
    // The field question belongs to the path — "What are you studying?"
    // becomes "What role are you aiming for?". Carrying the old answer over
    // would put "Medicine" under a question about hotel work.
    const changed = id !== lifePath;
    updateDraft({ lifePath: id, ...(changed ? { studyField: "" } : {}) });
  };

  const { groupProps, getRadioProps } = useRovingRadioGroup<LifePathId>({
    values: lifePaths.map((path) => path.id),
    value: lifePath,
    onChange: choose,
    isDisabled: (id) => !lifePaths.find((path) => path.id === id)?.live,
  });

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
      requirement="Choose a Life Path to continue. You can change it later."
      wide
    >
      <div {...groupProps} aria-label="Life Path" className="grid gap-2 sm:grid-cols-2">
        {lifePaths.map((path) => {
          const Icon = path.icon;
          const selected = lifePath === path.id;

          return (
            <button
              key={path.id}
              type="button"
              {...getRadioProps(path.id)}
              disabled={!path.live}
              className={cn(
                "surface-panel relative flex items-start gap-3 rounded-xl p-3 text-left",
                "transition-[border-color,transform,box-shadow] duration-200",
                "hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected && "border-foreground/70 shadow-selected",
                !path.live && "pointer-events-none opacity-40",
              )}
            >
              {!path.live ? (
                <span className="absolute right-3 top-3 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              ) : path.isDefault ? (
                <span className="absolute right-3 top-3 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
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
                <Icon className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block pr-14 text-body font-semibold leading-tight text-foreground">
                  {path.name}
                </span>
                <span className="mt-1 block text-caption leading-snug text-muted-foreground">
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
            <span className="text-caption text-muted-foreground">
              You&apos;ll be measured on
            </span>
            {chosen.dimensions.map((dimension) => (
              <span
                key={dimension}
                className="rounded-full bg-foreground/[0.055] px-2 py-0.5 text-mini text-foreground/75"
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
