"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface ActivityStep {
  /** The template running, for the tooltip and for our own debugging. */
  templateId: string;
  /** What the learner would call it. Never "EX001". */
  label: string;
}

/**
 * Where the learner is inside Today's Mission.
 *
 * A Day Plan is four to six activities, and without this the day reads as
 * one conversation that will not end — which is exactly the complaint that
 * open-ended chat practice attracts. The rail is the smallest thing that
 * answers "how much longer".
 *
 * Deliberately not a progress bar: the activities are discrete, differently
 * shaped, and a learner who sees five dots knows the shape of their next ten
 * minutes in a way that 40% does not tell them.
 */
export function ActivityRail({
  steps,
  current,
}: {
  steps: ActivityStep[];
  current: number;
}) {
  return (
    <ol
      className="flex items-center gap-1.5"
      aria-label={`Activity ${current + 1} of ${steps.length}`}
    >
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;

        return (
          <li key={`${step.templateId}-${i}`} className="flex items-center gap-1.5">
            <motion.div
              layout
              title={step.label}
              className={cn(
                "flex h-6 items-center gap-1.5 rounded-full px-2 transition-colors",
                active && "bg-foreground/[0.06]",
              )}
            >
              <span
                className={cn(
                  "grid size-3.5 shrink-0 place-items-center rounded-full",
                  done && "bg-coach-correct text-background",
                  active && "bg-foreground text-background",
                  !done && !active && "border border-border",
                )}
              >
                {done && <Check className="size-2.5" strokeWidth={3.5} />}
              </span>

              {/* Only the current activity is named — five labels in a row is a
                  table of contents, and the learner is meant to be talking. */}
              {active && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  className="whitespace-nowrap text-mini font-medium text-foreground/70"
                >
                  {step.label}
                </motion.span>
              )}
            </motion.div>

            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn("h-px w-3", done ? "bg-coach-correct/50" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
