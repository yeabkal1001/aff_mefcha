"use client";

import { Check, MicOff, TriangleAlert } from "lucide-react";

import { MicMeter } from "@/components/onboarding/mic-meter";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Button } from "@/components/ui/button";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { retryMic, type MicBlockReason } from "@/lib/mic-engine";

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
/**
 * Short forms of the reasons in `MicNotice`. This screen has one line to work
 * with and the learner has not started a session yet, so it names the problem
 * and leaves the full instructions to the notice that appears in practice.
 */
const BLOCKED_SUMMARY: Record<MicBlockReason, string> = {
  denied: "Microphone access was refused, so the coach won't hear you.",
  "no-device": "No microphone found. Plug one in and this will pick it up.",
  "in-use": "Another app is holding your microphone. Close it and try again.",
  insecure: "Microphones need HTTPS. Open this page at its https:// address.",
  timeout: "The permission prompt wasn't answered.",
  unknown: "Your microphone couldn't be opened.",
};

export function StepMic({ index, count, onNext, onBack }: StepProps) {
  const { levelRef, micBlocked, micReason, micSilent, micEverHeard } =
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
      requirement="Say something — your coach is still waiting to hear you."
      nextLabel={micEverHeard ? "Continue" : "Waiting to hear you"}
    >
      <div className="surface-panel rounded-2xl px-5 py-5 sm:px-6">
        <MicMeter levelRef={levelRef} />

        <div
          aria-live="polite"
          className="mt-4 flex items-center justify-center gap-2 text-center text-ui"
        >
          {micBlocked ? (
            <>
              <MicOff className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              <span className="text-muted-foreground">
                {BLOCKED_SUMMARY[micReason ?? "unknown"]} You can continue and
                fix it later.
              </span>
              {micReason !== "insecure" && (
                <Button size="xs" variant="outline" onClick={retryMic}>
                  Try again
                </Button>
              )}
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
