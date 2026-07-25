"use client";

import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { AmbientBackground } from "@/components/session/ambient-background";
import { CoachGreeting } from "@/components/session/coach-greeting";
import { CorrectionCard } from "@/components/session/correction-card";
import { LessonHeader } from "@/components/session/lesson-header";
import { SessionControls } from "@/components/session/session-controls";
import { VoiceOrb } from "@/components/session/voice-orb";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { useSession } from "@/hooks/use-session";
import { coachName, greeting, lessonTopic } from "@/lib/mock-data";
import { lifePathById } from "@/lib/onboarding";

export default function PracticePage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { name, studyField, lifePath, assessmentComplete } = useOnboardingDraft();
  const path = lifePathById(lifePath);
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

  // "Hi Hana. I understand you're preparing for university." The onboarding
  // answers are what make the first line land as personal.
  const openingLine = name
    ? `Hi ${name}! I'm ${coachName}. I hear you're heading into ${studyField || "university"} — let's get you speaking.`
    : greeting;

  // The first mission is the last thing that happens without an account.
  const handleEnd = () => {
    endSession();
    if (assessmentComplete) router.push("/signup");
  };

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
        {/* One universal domain, skinned by the Life Path. Hana practises it
            in a lecture hall, Samuel in a hotel lobby. */}
        <LessonHeader topic={path?.firstMission ?? lessonTopic} />

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
                  text={state === "idle" ? openingLine : coachLine}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-center">
          <SessionControls
            state={state}
            onToggleListening={toggleListening}
            onEnd={handleEnd}
          />
        </div>
      </main>
    </div>
  );
}
