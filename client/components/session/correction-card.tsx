"use client";

import { ArrowRight, X } from "lucide-react";
import { motion } from "motion/react";

import type { Correction } from "@/lib/api/schemas";

interface CorrectionCardProps {
  correction: Correction;
  onDismiss: () => void;
}

/**
 * The payoff of the whole product: what you said, what you should have said,
 * and one sentence of why. It replaces the greeting in the centre column.
 *
 * The two sentences are stacked rather than shown side by side so the eye
 * lands on the same words in the same place and only the difference moves.
 */
export function CorrectionCard({ correction, onDismiss }: CorrectionCardProps) {
  const [before, after] = splitOnce(correction.said, correction.errorSpan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="surface-panel relative w-full max-w-[25rem] rounded-[1.25rem] px-6 py-5 shadow-panel"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss correction"
        className="absolute right-3.5 top-3.5 grid size-6 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>

      <p className="label-eyebrow">You said</p>

      <p className="mt-2.5 pr-6 text-body leading-relaxed text-foreground/75">
        {before}
        <span className="mark-error">{correction.errorSpan}</span>
        {after}
      </p>

      <p className="mt-2.5 flex items-start gap-2 text-body leading-relaxed">
        <ArrowRight
          className="mt-[0.3rem] size-3.5 shrink-0 text-coach-correct/70"
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="mark-correct">{correction.corrected}</span>
      </p>

      <hr className="mt-4 border-border/70" />

      <p className="label-eyebrow mt-4">Why</p>

      <p className="mt-2 text-body leading-relaxed text-foreground/70">
        {correction.why}
      </p>
    </motion.div>
  );
}

/** Split a sentence around the first occurrence of the error span. */
function splitOnce(sentence: string, span: string): [string, string] {
  const at = sentence.indexOf(span);
  if (at === -1) return [sentence, ""];
  return [sentence.slice(0, at), sentence.slice(at + span.length)];
}
