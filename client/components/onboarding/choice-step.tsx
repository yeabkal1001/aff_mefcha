"use client";

import type { ReactNode } from "react";

import { ChoiceButton } from "@/components/onboarding/choice-button";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useRovingRadioGroup } from "@/hooks/use-roving-radio-group";
import { cn } from "@/lib/utils";

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  detail?: string;
  /** An icon tile, shown left of the label. */
  leading?: ReactNode;
  /** Shown but not selectable — the planned Life Paths. */
  disabled?: boolean;
  /** Replaces the tick, for options that are not available yet. */
  badge?: string;
}

interface ChoiceStepProps<T extends string | number> {
  stepKey: string;
  stepIndex: number;
  stepCount: number;
  question: string;
  hint?: string;
  /** Names the radiogroup. Shorter than the question — "Age range". */
  groupLabel: string;
  /** Said out loud if the learner tries to continue without answering. */
  requirement: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  secondary?: ReactNode;
  wide?: boolean;
  /** Grid instead of a stack, for the Life Path cards. */
  layout?: "stack" | "grid";
}

/**
 * A step that asks one question and takes one answer.
 *
 * Eight of the twelve onboarding steps are this, and they were eight copies of
 * the same forty lines. Sharing them is not only less code: keyboard support,
 * the roving tabindex and the validation message are the sort of thing that
 * gets added to one screen and forgotten on the other seven.
 *
 * What is deliberately not shared is the question itself. Each step file still
 * says what it asks and why, because those decisions are documented in
 * `docs/product/onboarding.md` and belong next to the screen they describe.
 */
export function ChoiceStep<T extends string | number>({
  stepKey,
  stepIndex,
  stepCount,
  question,
  hint,
  groupLabel,
  requirement,
  options,
  value,
  onChange,
  onNext,
  onBack,
  nextLabel,
  secondary,
  wide,
  layout = "stack",
}: ChoiceStepProps<T>) {
  const { groupProps, getRadioProps } = useRovingRadioGroup<T>({
    values: options.map((option) => option.value),
    value,
    onChange,
    isDisabled: (candidate) =>
      options.find((option) => option.value === candidate)?.disabled ?? false,
  });

  return (
    <OnboardingShell
      stepKey={stepKey}
      stepIndex={stepIndex}
      stepCount={stepCount}
      question={question}
      hint={hint}
      onBack={onBack}
      onNext={onNext}
      nextLabel={nextLabel}
      canAdvance={value !== null}
      requirement={requirement}
      secondary={secondary}
      wide={wide}
    >
      <div
        {...groupProps}
        aria-label={groupLabel}
        className={cn(
          layout === "grid"
            ? "grid gap-2 sm:grid-cols-2"
            : "flex flex-col gap-2",
        )}
      >
        {options.map((option) => (
          <ChoiceButton
            key={option.value}
            {...getRadioProps(option.value)}
            selected={option.value === value}
            label={option.label}
            detail={option.detail}
            leading={option.leading}
            disabled={option.disabled}
            badge={option.badge}
          />
        ))}
      </div>
    </OnboardingShell>
  );
}
