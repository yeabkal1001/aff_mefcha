"use client";

import { motion } from "motion/react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunicationProfile } from "@/hooks/queries";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { fromQuery } from "@/lib/api/async";
import type { Dimension } from "@/lib/api/schemas";

import type { StepProps } from "./types";

/**
 * The profile, revealed.
 *
 * Two honesty rules from the docs are load-bearing here. Every value rests on
 * `evidence_count = 1`, so each bar is drawn with an uncertainty band rather
 * than as a verdict. And a dimension with no attempted members reads "not yet
 * assessed" — never 0%, which would be a claim we have not earned.
 *
 * The four are fixed for every learner — Grammar, Vocabulary, Fluency and
 * Sentence Structure. See CONTEXT.md and ADR 0006.
 */
export function StepProfile({ index, count, onNext }: StepProps) {
  const { name } = useOnboardingDraft();
  const profile = fromQuery(useCommunicationProfile());
  const cefr = profile.status === "ready" ? profile.data.cefr : null;

  return (
    <OnboardingShell
      stepKey="profile"
      stepIndex={index}
      stepCount={count}
      question={`Here's where you're starting, ${name || "friend"}.`}
      hint={
        cefr
          ? `Measured from four minutes of speech — you were never asked to guess. Level ${cefr}.`
          : "Measured from four minutes of speech — you were never asked to guess."
      }
      onNext={onNext}
      nextLabel="Start Today's Mission"
      wide
    >
      {profile.status === "ready" ? (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {profile.data.dimensions.map((dimension, i) => (
            <DimensionRow key={dimension.skill} dimension={dimension} order={i} />
          ))}
        </div>
      ) : profile.status === "error" ? (
        <p className="text-center text-body leading-relaxed text-muted-foreground">
          We couldn&apos;t draw your profile just now — but the assessment was
          recorded, and Today&apos;s Mission is built from it either way.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      )}

      <p className="mt-7 text-center text-caption leading-relaxed text-muted-foreground">
        These are estimates, and the coach knows it. They will move a long way
        in your first week, because every session adds evidence.
      </p>
    </OnboardingShell>
  );
}

function DimensionRow({
  dimension,
  order,
}: {
  dimension: Dimension;
  order: number;
}) {
  const assessed = dimension.percent !== null;
  // The wire carries a percentage; the bars are drawn from a 0..1 fraction.
  const value = (dimension.percent ?? 0) / 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ui text-foreground/80">{dimension.label}</span>
        <span
          className={
            assessed
              ? "text-ui font-semibold tabular-nums text-foreground"
              : "text-mini text-muted-foreground/70"
          }
        >
          {assessed ? `${Math.round(value * 100)}%` : "Not yet assessed"}
        </span>
      </div>

      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
        {assessed && (
          <>
            {/* The band: how far this could move once there is more evidence. */}
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/15"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(1, value + 0.12) * 100}%` }}
              transition={{
                duration: 0.9,
                delay: 0.1 + order * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
              initial={{ width: 0 }}
              animate={{ width: `${value * 100}%` }}
              transition={{
                duration: 0.9,
                delay: 0.1 + order * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
