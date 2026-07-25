"use client";

import { Check, MicOff } from "lucide-react";
import { useEffect, useState } from "react";

import { MicMeter } from "@/components/onboarding/mic-meter";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { useAudioLevel } from "@/hooks/use-audio-level";

import type { StepProps } from "./types";

/**
 * Prove the microphone works before four minutes of speech depend on it.
 *
 * Advancing requires actually being heard, not just granting permission — a
 * muted headset grants permission perfectly well and then records silence.
 */
export function StepMic({ index, count, onNext, onBack }: StepProps) {
  const { levelRef, micBlocked } = useAudioLevel("listening");
  const [heard, setHeard] = useState(false);

  useEffect(() => {
    let raf = 0;
    const watch = () => {
      if (levelRef.current > 0.22) setHeard(true);
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <OnboardingShell
      stepKey="mic"
      stepIndex={index}
      stepCount={count}
      question="Let's check I can hear you."
      hint="Say anything — your name is fine."
      onBack={onBack}
      onNext={onNext}
      canAdvance={heard || micBlocked}
      nextLabel={heard ? "Continue" : "Waiting to hear you"}
    >
      <div className="surface-panel rounded-2xl px-6 py-5">
        <MicMeter levelRef={levelRef} />

        <div className="mt-4 flex items-center justify-center gap-2 text-[0.8125rem]">
          {micBlocked ? (
            <>
              <MicOff className="size-4 text-muted-foreground" strokeWidth={2} />
              <span className="text-muted-foreground">
                No microphone access — you can continue, but the coach won&apos;t
                hear you.
              </span>
            </>
          ) : heard ? (
            <>
              <Check className="size-4 text-coach-correct" strokeWidth={2.5} />
              <span className="text-coach-correct">Got it — that&apos;s you.</span>
            </>
          ) : (
            <span className="text-muted-foreground">Listening…</span>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}
