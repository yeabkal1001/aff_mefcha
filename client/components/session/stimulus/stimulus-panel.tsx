"use client";

import { cn } from "@/lib/utils";

/**
 * The frame every stimulus sits in.
 *
 * Templates differ in what they show — a picture, a proposition, a roleplay
 * brief — but not in how it is presented, and keeping the surface in one place
 * is what stops eighteen templates becoming eighteen visual languages. It also
 * means the collapse-on-correction behaviour in `ExerciseStage` has exactly one
 * thing to animate.
 */
export function StimulusPanel({
  children,
  className,
  compact = false,
}: {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-panel overflow-hidden rounded-2xl shadow-[0_18px_50px_-28px_oklch(0.4_0.06_280/45%)]",
        compact ? "p-1" : "p-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The label above a stimulus, naming what kind of thing it is.
 *
 * Worth the pixels: "the situation" and "the statement" set completely
 * different expectations about what the learner is about to be asked for, and
 * an A2 learner should not have to infer that from layout.
 */
export function StimulusLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-eyebrow mb-2 text-center">{children}</p>;
}
