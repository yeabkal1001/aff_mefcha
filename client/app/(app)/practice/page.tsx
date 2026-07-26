"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActivityRail } from "@/components/session/activity-rail";
import { AmbientBackground } from "@/components/session/ambient-background";
import { ExerciseStage } from "@/components/session/exercise-stage";
import { LessonHeader } from "@/components/session/lesson-header";
import { MicNotice } from "@/components/session/mic-notice";
import { SessionControls } from "@/components/session/session-controls";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { useSession } from "@/hooks/use-session";
import { coachName, dayPlan, greeting, lessonTopic } from "@/lib/mock-data";
import { lifePathById } from "@/lib/onboarding";

export default function PracticePage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [activity, setActivity] = useState(0);
  const { name, studyField, lifePath, assessmentComplete } = useOnboardingDraft();
  const path = lifePathById(lifePath);
  const {
    state,
    correction,
    coachLine,
    transcript,
    speakingMinutes,
    correctionCount,
    micBlocked,
    micSilent,
    toggleListening,
    endSession,
    dismissCorrection,
  } = useSession();

  const session = dayPlan[activity];

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
        <div className="flex flex-col items-center gap-3">
          <LessonHeader topic={path?.firstMission ?? lessonTopic} />
          <ActivityRail steps={dayPlan} current={activity} />
          <MicNotice blocked={micBlocked} silent={micSilent} />
        </div>

        <ExerciseStage
          state={state}
          stimulus={session.stimulus}
          coachLine={state === "idle" ? openingLine : coachLine}
          transcript={transcript}
          correction={correction}
          onDismissCorrection={dismissCorrection}
        />

        <div className="flex justify-center">
          <SessionControls
            state={state}
            onToggleListening={toggleListening}
            onEnd={handleEnd}
            onSkip={
              activity < dayPlan.length - 1
                ? () => setActivity((i) => i + 1)
                : undefined
            }
          />
        </div>
      </main>
    </div>
  );
}
