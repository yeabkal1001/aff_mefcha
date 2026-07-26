"use client";

import { motion } from "motion/react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useCommunicationProfile } from "@/hooks/use-communication-profile";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import type { DimensionResponse } from "@/lib/api";

import type { StepProps } from "./types";

/**
 * The profile, revealed.
 *
 * These numbers come from the server, computed from `learner_competency` rows
 * at read time. Mounting this step is what creates the learner, so it is also
 * the first screen that can fail — there is no cached shape to fall back on,
 * and inventing one would put a fabricated score on the screen the pitch rests
 * on.
 *
 * Two honesty rules from the docs are load-bearing here. Every value rests on
 * `evidence_count = 1`, so each bar is drawn with an uncertainty band rather
 * than as a verdict. And a dimension with no attempted members reads "not yet
 * assessed" — never 0%, which would be a claim we have not earned.
 */
export function StepProfile({ index, count, onNext }: StepProps) {
  const { name } = useOnboardingDraft();
  const profile = useCommunicationProfile();

  const hint =
    profile.status === "ready"
      ? `Measured from four minutes of speech — you were never asked to guess. Level ${profile.cefr}.`
      : "Measured from four minutes of speech — you were never asked to guess.";

  return (
    <OnboardingShell
      stepKey="profile"
      stepIndex={index}
      stepCount={count}
      question={`Here's where you're starting, ${name || "friend"}.`}
      hint={hint}
      onNext={onNext}
      nextLabel="Start my first mission"
      canAdvance={profile.status === "ready"}
      wide
    >
      {profile.status === "loading" && (
        <p className="text-center text-[0.8125rem] text-muted-foreground">
          Working out where you are…
        </p>
      )}

      {profile.status === "error" && (
        <p className="text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
          Your coach could not be reached, so there is nothing honest to show
          here yet.
          <span className="mt-1 block text-[0.75rem] text-muted-foreground/70">
            {profile.message}
          </span>
        </p>
      )}

      {profile.status === "ready" && (
        <>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {profile.dimensions.map((dimension, i) => (
              <DimensionRow key={dimension.id} dimension={dimension} order={i} />
            ))}
          </div>

          <p className="mt-7 text-center text-[0.75rem] leading-relaxed text-muted-foreground">
            These are estimates, and the coach knows it. They will move a long way
            in your first week, because every session adds evidence.
          </p>
        </>
      )}
    </OnboardingShell>
  );
}

/** How far a bar could still move. A single piece of evidence buys little. */
const WIDE_BAND = 0.12;
const NARROW_BAND = 0.05;

function DimensionRow({
  dimension,
  order,
}: {
  dimension: DimensionResponse;
  order: number;
}) {
  const assessed = dimension.value !== null;
  const value = dimension.value ?? 0;
  const band = dimension.wide_uncertainty ? WIDE_BAND : NARROW_BAND;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] text-foreground/80">
          {dimension.name}
        </span>
        <span
          className={
            assessed
              ? "text-[0.8125rem] font-semibold tabular-nums text-foreground"
              : "text-[0.6875rem] text-muted-foreground/70"
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
              animate={{ width: `${Math.min(1, value + band) * 100}%` }}
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
