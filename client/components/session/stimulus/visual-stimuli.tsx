"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { SceneSvg } from "./scenes";
import { StimulusLabel, StimulusPanel } from "./stimulus-panel";
import type {
  ImagePairStimulus,
  ImageSequenceStimulus,
  ImageStimulus,
} from "./types";

/**
 * `EX001` — one picture, described.
 */
export function ImageStimulusView({
  spec,
  compact,
}: {
  spec: ImageStimulus;
  compact?: boolean;
}) {
  return (
    <StimulusPanel compact={compact}>
      <SceneSvg id={spec.scene} className="block h-auto w-full rounded-[0.875rem]" />
    </StimulusPanel>
  );
}

/**
 * `EX002` — two pictures side by side.
 *
 * They stay side by side at every size rather than stacking, because the
 * template exists to elicit comparatives and a learner who has to scroll
 * between the two is comparing from memory instead of from the screen. The
 * scenes are SVG and the stage caps the row at the column width, so on a
 * 360px phone they shrink to about 160px each rather than overflowing.
 */
export function ImagePairStimulusView({
  spec,
  compact,
}: {
  spec: ImagePairStimulus;
  compact?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2">
      {[spec.left, spec.right].map((side, i) => (
        <figure key={i} className="flex flex-1 flex-col gap-1.5">
          <StimulusPanel compact={compact}>
            <SceneSvg id={side.scene} className="block h-auto w-full rounded-[0.875rem]" />
          </StimulusPanel>
          {!compact && (
            <figcaption className="text-center text-caption font-medium text-muted-foreground">
              {side.label}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

/**
 * `EX003` and the visual form of `EX011` — an ordered strip.
 *
 * Numbered, because the whole point is sequence markers: the learner needs to
 * know which picture is first before they can say "first" about it.
 *
 * Below `sm` the strip wraps to two columns rather than stacking into a
 * column, for the same reason it is numbered: four panels down a phone screen
 * puts the last one below the fold, and a learner who has to scroll to find
 * step four narrates three steps and stops. Two rows of two keeps the whole
 * sequence in one glance, and the numbers carry the order either way.
 */
export function ImageSequenceStimulusView({
  spec,
  compact,
}: {
  spec: ImageSequenceStimulus;
  compact?: boolean;
}) {
  return (
    <ol className="grid grid-cols-2 items-stretch gap-2 sm:flex">
      {spec.steps.map((step, i) => (
        <li key={i} className="relative flex flex-1 flex-col gap-1.5">
          <StimulusPanel compact={compact}>
            <SceneSvg id={step.scene} className="block h-auto w-full rounded-[0.875rem]" />
          </StimulusPanel>
          <span
            className={cn(
              "absolute left-2 top-2 grid size-5 place-items-center rounded-full",
              "bg-foreground/80 text-micro font-semibold text-background",
            )}
          >
            {i + 1}
          </span>
          {!compact && (
            <p className="text-center text-caption text-muted-foreground">{step.caption}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A prompt with no asset behind it — `EX009`, `EX012`, and any template that
 * degraded to text on a Stimulus Pool miss.
 *
 * Hints are the one piece of optional scaffolding shown up front rather than
 * through the retry ladder, because a learner staring at a blank prompt with
 * nothing to say produces no evidence at all.
 */
export function TextStimulusView({
  prompt,
  hints,
  compact,
}: {
  prompt: string;
  hints?: string[];
  compact?: boolean;
}) {
  return (
    <StimulusPanel className="px-5 py-4">
      <p
        className={cn(
          "text-center font-medium leading-snug tracking-tight text-foreground",
          compact ? "text-body" : "text-lead",
        )}
      >
        {prompt}
      </p>

      {!compact && hints && hints.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {hints.map((hint) => (
            <motion.span
              key={hint}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full bg-foreground/[0.055] px-2 py-0.5 text-mini text-foreground/70"
            >
              {hint}
            </motion.span>
          ))}
        </div>
      )}
    </StimulusPanel>
  );
}

/**
 * `EX016` and `EX015` — a proposition to react to.
 *
 * When a side is assigned it is stated loudly, because debate practice fails
 * quietly if the learner argues the position they actually hold.
 */
export function StatementStimulusView({
  statement,
  assignedSide,
  compact,
}: {
  statement: string;
  assignedSide?: "for" | "against";
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {!compact && <StimulusLabel>The statement</StimulusLabel>}
      <StimulusPanel className="px-5 py-4">
        <p
          className={cn(
            "text-balance text-center font-medium leading-snug tracking-tight",
            compact ? "text-body" : "text-lead",
          )}
        >
          &ldquo;{statement}&rdquo;
        </p>
      </StimulusPanel>

      {assignedSide && !compact && (
        <p className="mt-2.5 text-ui text-muted-foreground">
          You are arguing{" "}
          <span className="font-semibold text-foreground">{assignedSide}</span> — whatever you
          actually think.
        </p>
      )}
    </div>
  );
}
