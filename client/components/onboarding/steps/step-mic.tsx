"use client";

import { Check, MicOff, TriangleAlert } from "lucide-react";

import { MicMeter } from "@/components/onboarding/mic-meter";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useAudioLevel } from "@/hooks/use-audio-level";

import type { StepProps } from "./types";

/**
 * Prove the microphone works before four minutes of speech depend on it.
 *
 * Advancing requires actually being heard, not just granting permission — a
 * muted headset grants permission perfectly well and then records silence.
 *
 * "Heard" is the voice activity verdict from the mic engine, which is relative
 * to the room's own noise floor. It used to be a fixed level threshold, and
 * that could not work: the same sentence into a headset and into a laptop
 * differs by more than a factor of ten, so any constant either passed on room
 * tone or could not be reached by a normal speaking voice. It was the second,
 * and this screen was unpassable.
 */
export function StepMic({ index, count, onNext, onBack }: StepProps) {
  const { levelRef, micBlocked, micSilent, micEverHeard } =
    useAudioLevel("listening");

  return (
    <OnboardingShell
      stepKey="mic"
      stepIndex={index}
      stepCount={count}
      question="Let's check I can hear you."
      hint="Say anything — your name is fine."
      onBack={onBack}
      onNext={onNext}
      // A learner with no microphone is let through: they can still read the
      // corrections, and trapping them here helps nobody.
      canAdvance={micEverHeard || micBlocked || micSilent}
      nextLabel={micEverHeard ? "Continue" : "Waiting to hear you"}
    >
      <div className="surface-panel rounded-2xl px-6 py-5">
        <MicMeter levelRef={levelRef} />

        <div className="mt-4 flex items-center justify-center gap-2 text-center text-[0.8125rem]">
          {micBlocked ? (
            <>
              <MicOff className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <span className="text-muted-foreground">
                No microphone access — you can continue, but the coach won&apos;t
                hear you.
              </span>
            </>
          ) : micEverHeard ? (
            <>
              <Check className="size-4 shrink-0 text-coach-correct" strokeWidth={2.5} />
              <span className="text-coach-correct">Got it — that&apos;s you.</span>
            </>
          ) : micSilent ? (
            <>
              <TriangleAlert
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <span className="text-muted-foreground">
                Your microphone is on but completely silent. Check it isn&apos;t
                muted, or carry on and fix it later.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Listening…</span>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}
