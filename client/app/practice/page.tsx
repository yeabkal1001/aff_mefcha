"use client";

import { AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { AmbientBackground } from "@/components/session/ambient-background";
import { CoachGreeting } from "@/components/session/coach-greeting";
import { CorrectionCard } from "@/components/session/correction-card";
import { LessonHeader } from "@/components/session/lesson-header";
import { LiveTranscript } from "@/components/session/live-transcript";
import { SessionControls } from "@/components/session/session-controls";
import { StimulusImage } from "@/components/session/stimulus-image";
import { VoiceOrb } from "@/components/session/voice-orb";
import { useDayPlan } from "@/hooks/use-day-plan";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { useSession } from "@/hooks/use-session";
import { coachName, greeting, lessonTopic } from "@/lib/mock-data";
import { lifePathById } from "@/lib/onboarding";

export default function PracticePage() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { name, studyField, lifePath, assessmentComplete } = useOnboardingDraft();
  const path = lifePathById(lifePath);
  const dayPlan = useDayPlan();

  const session = dayPlan.status === "ready" ? dayPlan.session : null;
  const theme =
    dayPlan.status === "ready"
      ? dayPlan.plan.theme
      : (path?.firstMission ?? lessonTopic);

  const openingLine = useMemo(() => {
    if (session?.prompt) return session.prompt;
    if (name) {
      return `Hi ${name}! I'm ${coachName}. I hear you're heading into ${studyField || "university"} — let's get you speaking.`;
    }
    return greeting;
  }, [name, session?.prompt, studyField]);

  const {
    state,
    correction,
    coachLine,
    transcript,
    speakingMinutes,
    correctionCount,
    error,
    busy,
    toggleListening,
    endSession,
    dismissCorrection,
  } = useSession({
    sessionId: session?.id ?? null,
    openingLine,
  });

  const needsImage = session?.stimulus_type === "image";

  const handleEnd = async () => {
    await endSession();
    if (assessmentComplete) router.push("/signup");
  };

  if (dayPlan.status === "loading") {
    return (
      <CenteredMessage>
        Building today&apos;s mission…
      </CenteredMessage>
    );
  }

  if (dayPlan.status === "absent") {
    return (
      <CenteredMessage>
        Finish onboarding first — there is no learner on this device yet.
      </CenteredMessage>
    );
  }

  if (dayPlan.status === "error") {
    return (
      <CenteredMessage>
        Could not load today&apos;s mission.
        <span className="mt-2 block text-[0.75rem] text-muted-foreground/70">
          {dayPlan.message}
        </span>
      </CenteredMessage>
    );
  }

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
        <LessonHeader topic={theme} />

        <div
          className={
            needsImage
              ? "flex flex-col items-center justify-center gap-8"
              : "flex flex-col items-center justify-center gap-24"
          }
        >
          {needsImage && (
            <div className="flex flex-col items-center gap-3">
              <StimulusImage
                src={session?.stimulus_url}
                className="w-full max-w-[17rem]"
              />
              <p className="max-w-[22rem] text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
                {session?.prompt}
              </p>
            </div>
          )}

          <VoiceOrb
            state={state}
            className={needsImage ? "[--orb-size:7rem]" : undefined}
          />

          <div className="flex min-h-[8.5rem] w-full max-w-[36rem] flex-col items-center justify-start gap-3">
            <AnimatePresence mode="wait">
              {state === "listening" || (state === "thinking" && transcript) ? (
                <LiveTranscript key="transcript" text={transcript || "Listening…"} />
              ) : correction ? (
                <CorrectionCard
                  key={correction.id}
                  correction={correction}
                  onDismiss={dismissCorrection}
                />
              ) : (
                <CoachGreeting
                  key={state === "idle" ? "greeting" : coachLine}
                  text={
                    state === "thinking"
                      ? "Working that out…"
                      : state === "idle"
                        ? openingLine
                        : coachLine
                  }
                />
              )}
            </AnimatePresence>

            {error && (
              <p className="max-w-[28rem] text-center text-[0.75rem] leading-relaxed text-muted-foreground">
                {error}
              </p>
            )}
            {busy && state === "thinking" && (
              <p className="text-[0.75rem] text-muted-foreground">
                Transcribing and grading…
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <SessionControls
            state={state}
            onToggleListening={toggleListening}
            onEnd={() => void handleEnd()}
          />
        </div>
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh items-center justify-center px-6">
      <AmbientBackground state="idle" />
      <p className="relative z-10 max-w-[24rem] text-center text-[0.875rem] leading-relaxed text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
