"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

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
  /** Whether the step has an answer yet. */
  canAdvance?: boolean;
  /**
   * What is missing, said out loud, when the learner tries to continue
   * without answering. Steps that can always advance leave it unset.
   */
  requirement?: string;
  /** Rendered instead of the primary button — used by the skippable step. */
  secondary?: ReactNode;
  /** Wider column for the Life Path grid and the profile reveal. */
  wide?: boolean;
  /**
   * Steps whose answer is typed focus their own input instead, which is both
   * a better place to land and still inside the new step.
   */
  focusHeading?: boolean;
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
  requirement,
  secondary,
  wide = false,
  focusHeading = true,
}: OnboardingShellProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Which step the learner last tried to leave without answering. Storing the
  // step rather than a boolean is what makes this self-clearing: the next step
  // has a different key, so its error starts hidden with no effect to reset it.
  const [attempted, setAttempted] = useState<string | null>(null);

  // Only a real attempt earns an error. Nobody should be told they got
  // something wrong before they have had a chance to answer it.
  const showError = attempted === stepKey && !canAdvance && Boolean(requirement);

  // Each step is a new question, and the whole page changes underneath the
  // learner. Without this, a keyboard user's focus stays on the Continue
  // button of a screen that no longer exists and a screen reader reads
  // nothing — the flow becomes twelve silent page swaps.
  useEffect(() => {
    if (focusHeading) heading.current?.focus();
  }, [stepKey, focusHeading]);

  const advance = () => {
    if (!canAdvance) {
      setAttempted(stepKey);
      return;
    }
    onNext?.();
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground state="idle" />

      {/* Announced on every step change. Separate from the heading because a
          heading move is announced by some screen readers and not others. */}
      <p aria-live="polite" className="sr-only">
        {`Step ${stepIndex + 1} of ${stepCount}. ${question}`}
      </p>

      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-5 sm:gap-4 sm:px-6 sm:pt-6">
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

        <span className="shrink-0 text-mini tabular-nums text-muted-foreground">
          {stepIndex + 1} / {stepCount}
        </span>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <AskingOrb
          key={stepKey}
          className="shrink-0 [--orb-size:clamp(3.25rem,12vw,4rem)]"
        />

        <motion.div
          key={`${stepKey}-body`}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={
            wide
              ? "mt-7 flex w-full max-w-[42rem] flex-col items-center sm:mt-9"
              : "mt-7 flex w-full max-w-[24rem] flex-col items-center sm:mt-9"
          }
        >
          {/* `tabIndex={-1}` makes the heading focusable by script without
              adding it to the tab order. */}
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-balance text-center text-title font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {question}
          </h1>

          {hint && (
            <p className="mt-2 max-w-[26rem] text-center text-ui leading-relaxed text-muted-foreground">
              {hint}
            </p>
          )}

          <div className="mt-6 w-full sm:mt-7">{children}</div>
        </motion.div>
      </main>

      <footer className="relative z-10 flex shrink-0 flex-col items-center gap-3 px-4 pb-8 sm:px-6 sm:pb-10">
        {showError && (
          <p
            id={`${stepKey}-requirement`}
            role="alert"
            className="text-center text-ui text-coach-error"
          >
            {requirement}
          </p>
        )}

        {onNext && (
          <Button
            size="lg"
            onClick={advance}
            // Deliberately not `disabled`. A disabled button gives a learner no
            // way to find out what it wants: it is skipped by the tab order,
            // announces nothing, and on touch it simply does not respond.
            aria-disabled={!canAdvance}
            aria-describedby={showError ? `${stepKey}-requirement` : undefined}
            className="h-11 rounded-full px-7 text-body aria-disabled:opacity-50"
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
