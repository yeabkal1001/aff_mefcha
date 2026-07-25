"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { AmbientBackground } from "@/components/session/ambient-background";
import { Stimulus } from "@/components/session/stimulus";
import { VoiceOrb } from "@/components/session/voice-orb";
import { Button } from "@/components/ui/button";
import { updateDraft } from "@/hooks/use-onboarding-draft";
import { assessmentPrompts, type SessionState } from "@/lib/mock-data";

import type { StepProps } from "./types";

/** How long the coach appears to read the prompt before the learner's turn. */
const PROMPT_MS = 2600;

/**
 * The four minutes that place the learner.
 *
 * Deliberately not framed as a test: no score, no right answer, nothing to
 * fail. Placement runs off a global complexity read of the speech, so there is
 * genuinely nothing to pass — see session-engine.md §9.
 */
export function StepAssessment({ onNext }: StepProps) {
  const [index, setIndex] = useState(0);

  const advance = () => {
    if (index < assessmentPrompts.length - 1) {
      setIndex(index + 1);
      return;
    }
    // Placement would run here. Only A2 content is authored, so the MVP places
    // everyone at A2 — by a mechanism that will place higher once B1 exists.
    updateDraft({ assessmentComplete: true, cefr: "A2" });
    onNext();
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground state="idle" />

      <header className="relative z-10 flex shrink-0 items-center justify-center gap-2 px-6 pt-6">
        {assessmentPrompts.map((prompt, i) => (
          <span
            key={prompt.template}
            className={
              "h-[3px] w-12 rounded-full transition-colors duration-500 " +
              (i <= index ? "bg-foreground/45" : "bg-foreground/[0.07]")
            }
          />
        ))}
      </header>

      <AnimatePresence mode="wait">
        <AssessmentTurn
          key={assessmentPrompts[index].template}
          index={index}
          onComplete={advance}
        />
      </AnimatePresence>
    </div>
  );
}

function AssessmentTurn({
  index,
  onComplete,
}: {
  index: number;
  onComplete: () => void;
}) {
  const prompt = assessmentPrompts[index];
  const [recording, setRecording] = useState(false);
  const [remaining, setRemaining] = useState(prompt.seconds);

  // The coach reads the prompt, then hands over.
  useEffect(() => {
    const timer = setTimeout(() => setRecording(true), PROMPT_MS);
    return () => clearTimeout(timer);
  }, []);

  // The learner's turn runs on a clock so nobody has to decide when to stop.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRemaining((left) => left - 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (remaining > 0) return;
    onComplete();
  }, [remaining, onComplete]);

  const state: SessionState = recording ? "listening" : "speaking";
  const elapsed = 1 - remaining / prompt.seconds;

  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8"
    >
      <p className="label-eyebrow">
        Part {index + 1} of {assessmentPrompts.length}
      </p>

      <VoiceOrb state={state} className="mt-6 [--orb-size:7rem]" />

      <p className="mt-9 max-w-[26rem] text-center text-[1.0625rem] font-medium leading-relaxed text-foreground/80">
        {prompt.instruction}
      </p>

      {/* The assessment runs real templates, so it renders through the same
          dispatcher the practice screen uses — a prompt with no stimulus
          simply has none. */}
      {prompt.stimulus && (
        <div className="mt-6 w-full max-w-[19rem]">
          <Stimulus spec={prompt.stimulus} />
        </div>
      )}

      <div className="mt-9 flex h-16 flex-col items-center justify-center gap-3">
        {recording ? (
          <>
            <div className="h-[3px] w-44 overflow-hidden rounded-full bg-foreground/[0.08]">
              <motion.div
                className="h-full rounded-full bg-foreground/40"
                initial={false}
                animate={{ width: `${elapsed * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onComplete}
              className="h-8 rounded-full text-[0.8125rem] text-muted-foreground"
            >
              I&apos;m done
            </Button>
          </>
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">
            Listen, then take your time.
          </p>
        )}
      </div>
    </motion.main>
  );
}
