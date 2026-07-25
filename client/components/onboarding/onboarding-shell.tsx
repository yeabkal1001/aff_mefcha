"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { AskingOrb } from "@/components/onboarding/asking-orb";
import { AmbientBackground } from "@/components/session/ambient-background";
import { Button } from "@/components/ui/button";

interface OnboardingShellProps {
  /** Drives the progress bar and re-triggers the coach orb. */
  stepKey: string;
  stepIndex: number;
  stepCount: number;
  question: string;
  hint?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Disabled until the step has an answer. */
  canAdvance?: boolean;
  /** Rendered instead of the primary button — used by the skippable step. */
  secondary?: ReactNode;
  /** Wider column for the Life Path grid and the profile reveal. */
  wide?: boolean;
}

export function OnboardingShell({
  stepKey,
  stepIndex,
  stepCount,
  question,
  hint,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  canAdvance = true,
  secondary,
  wide = false,
}: OnboardingShellProps) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground state="idle" />

      <header className="relative z-10 flex shrink-0 items-center gap-4 px-6 pt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          aria-label="Go back"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
        </button>

        <div
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/[0.07]"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-label="Onboarding progress"
        >
          <motion.div
            className="h-full rounded-full bg-foreground/45"
            initial={false}
            animate={{ width: `${((stepIndex + 1) / stepCount) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground">
          {stepIndex + 1} / {stepCount}
        </span>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        <AskingOrb key={stepKey} className="shrink-0 [--orb-size:4rem]" />

        <motion.div
          key={`${stepKey}-body`}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={
            wide
              ? "mt-9 flex w-full max-w-[42rem] flex-col items-center"
              : "mt-9 flex w-full max-w-[24rem] flex-col items-center"
          }
        >
          <h1 className="text-center text-[1.375rem] font-semibold tracking-tight text-foreground">
            {question}
          </h1>

          {hint && (
            <p className="mt-2 max-w-[26rem] text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
              {hint}
            </p>
          )}

          <div className="mt-7 w-full">{children}</div>
        </motion.div>
      </main>

      <footer className="relative z-10 flex shrink-0 flex-col items-center gap-3 px-6 pb-10">
        {onNext && (
          <Button
            size="lg"
            onClick={onNext}
            disabled={!canAdvance}
            className="h-11 rounded-full px-7 text-[0.875rem]"
          >
            {nextLabel}
            <ArrowRight className="size-4" strokeWidth={2.25} />
          </Button>
        )}
        {secondary}
      </footer>
    </div>
  );
}
