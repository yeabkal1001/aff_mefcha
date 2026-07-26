"use client";

import { AnimatePresence, motion } from "motion/react";

import { CoachGreeting } from "@/components/session/coach-greeting";
import { CorrectionCard } from "@/components/session/correction-card";
import { LiveTranscript } from "@/components/session/live-transcript";
import {
  Stimulus,
  compactStimulusWidth,
  stimulusWidth,
  type StimulusSpec,
} from "@/components/session/stimulus";
import { VoiceOrb } from "@/components/session/voice-orb";
import type { Correction } from "@/lib/api/schemas";
import type { SessionPhase } from "@/lib/session/phase";
import { cn } from "@/lib/utils";

interface ExerciseStageProps {
  state: SessionPhase;
  /** Absent for templates that give the learner nothing to work from. */
  stimulus?: StimulusSpec;
  /** What the coach is saying, or the opening line while idle. */
  coachLine: string;
  /** The Wispr Flow track so far this turn. */
  transcript: string;
  correction: Correction | null;
  onDismissCorrection: () => void;
}

/**
 * The middle of the practice screen, for any of the eighteen templates.
 *
 * Two rules do all the work here. The stimulus keeps its own size until a
 * correction arrives and then steps back to a thumbnail — it never leaves,
 * because a correction only means something against the thing the learner was
 * looking at. And the slot below the orb holds exactly one of three things,
 * chosen by session state rather than by a separate flag, so there is no
 * combination of props that can show a transcript and a correction at once.
 *
 * Nothing in here knows which template is running. That is the point: a
 * template is a `StimulusSpec` and a duration, and the screen is the same.
 */
export function ExerciseStage({
  state,
  stimulus,
  coachLine,
  transcript,
  correction,
  onDismissCorrection,
}: ExerciseStageProps) {
  const showingCorrection = correction !== null;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col items-center justify-center",
        stimulus ? "gap-5 sm:gap-7" : "gap-14 sm:gap-24",
      )}
    >
      {/* The width is a preference, not a promise: `max-w-full` caps it at
          whatever the column actually is, so a 460px stimulus renders at 328px
          on a 360px phone instead of pushing the page sideways. */}
      {stimulus && (
        <motion.div
          layout
          className="flex max-w-full flex-col items-center gap-3"
          animate={{
            width: showingCorrection
              ? compactStimulusWidth(stimulus)
              : stimulusWidth(stimulus),
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          <Stimulus spec={stimulus} compact={showingCorrection} />

          {/* The instruction survives the coach saying it once and moving on,
              and gets out of the way when the correction needs the room. */}
          <AnimatePresence>
            {!showingCorrection && (
              <motion.p
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-[22rem] text-center text-ui leading-relaxed text-balance text-muted-foreground"
              >
                {stimulus.instruction}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <VoiceOrb
        state={state}
        className={stimulus ? "[--orb-size:clamp(4.5rem,16vw,6.5rem)]" : undefined}
      />

      {/* Fixed height so swapping between the three states does not shift the
          orb above them. */}
      <div className="flex min-h-[8.5rem] w-full max-w-[36rem] items-start justify-center">
        <AnimatePresence mode="wait">
          {state === "listening" ? (
            <LiveTranscript key="transcript" text={transcript} />
          ) : correction ? (
            <CorrectionCard
              // Keyed on the content, because corrections have no id of their
              // own — they are derived from a turn, not stored as rows the
              // client sees. Two consecutive corrections of the same span in
              // the same sentence would not re-animate, which is correct: it
              // is the same correction.
              key={`${correction.competencyId}:${correction.errorSpan}`}
              correction={correction}
              onDismiss={onDismissCorrection}
            />
          ) : (
            <CoachGreeting key={coachLine} text={coachLine} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
