"use client";

import { X } from "lucide-react";
import { motion } from "motion/react";

import type { Correction } from "@/lib/mock-data";

interface CorrectionCardProps {
  correction: Correction;
  onDismiss: () => void;
}

/**
 * The payoff of the whole product: what you said, what you should have said,
 * and one sentence of why. It replaces the greeting in the centre column.
 */
export function CorrectionCard({ correction, onDismiss }: CorrectionCardProps) {
  const [before, after] = splitOnce(correction.said, correction.errorSpan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="surface-panel relative w-full max-w-[20rem] rounded-2xl px-5 py-4 shadow-[0_18px_50px_-28px_oklch(0.4_0.06_280/35%)]"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss correction"
        className="absolute right-3 top-3 rounded-md p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>

      <p className="label-eyebrow">You said:</p>

      <p className="mt-2 text-[0.8125rem] leading-relaxed text-foreground/80">
        {before}
        <span className="text-coach-error underline decoration-coach-error decoration-from-font underline-offset-2">
          {correction.errorSpan}
        </span>
        {after}
      </p>

      <p className="mt-1.5 text-[0.8125rem] leading-relaxed font-medium text-coach-correct">
        {correction.corrected}
      </p>

      <p className="label-eyebrow mt-4">Why?</p>

      <p className="mt-2 text-[0.8125rem] leading-relaxed text-foreground/80">
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
