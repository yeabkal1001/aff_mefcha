"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { AmbientBackground } from "@/components/session/ambient-background";
import { CoachGreeting } from "@/components/session/coach-greeting";
import { CorrectionCard } from "@/components/session/correction-card";
import { LessonHeader } from "@/components/session/lesson-header";
import { SessionControls } from "@/components/session/session-controls";
import { VoiceOrb } from "@/components/session/voice-orb";
import { useSession } from "@/hooks/use-session";
import { greeting, lessonTopic } from "@/lib/mock-data";

export default function PracticePage() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    state,
    correction,
    coachLine,
    speakingMinutes,
    correctionCount,
    toggleListening,
    endSession,
    dismissCorrection,
  } = useSession();

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <AmbientBackground state={state} />

      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        speakingMinutes={speakingMinutes}
        corrections={correctionCount}
      />

      <main className="relative z-10 grid flex-1 grid-rows-[auto_1fr_auto] px-6 pb-9 pt-7">
        <LessonHeader topic={lessonTopic} />

        <div className="flex flex-col items-center justify-center gap-24">
          <VoiceOrb state={state} />

          {/* Fixed height so swapping the greeting for a correction does not
              shift the orb above it. */}
          <div className="flex min-h-[8.5rem] w-full max-w-[36rem] items-start justify-center">
            <AnimatePresence mode="wait">
              {correction ? (
                <CorrectionCard
                  key={correction.id}
                  correction={correction}
                  onDismiss={dismissCorrection}
                />
              ) : (
                <CoachGreeting
                  key={state === "idle" ? "greeting" : coachLine}
                  text={state === "idle" ? greeting : coachLine}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-center">
          <SessionControls
            state={state}
            onToggleListening={toggleListening}
            onEnd={endSession}
          />
        </div>
      </main>
    </div>
  );
}
