"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ActivityRail } from "@/components/session/activity-rail";
import { ExerciseStage } from "@/components/session/exercise-stage";
import { LessonHeader } from "@/components/session/lesson-header";
import { MicNotice } from "@/components/session/mic-notice";
import { SessionControls } from "@/components/session/session-controls";
import { ScreenLoading } from "@/components/shell/screen-loading";
import {
  useAmbientState,
  useReportProgress,
} from "@/components/shell/shell-context";
import { StatusScreen } from "@/components/shell/status-screen";
import { useToday } from "@/hooks/queries";
import { useLiveSession } from "@/hooks/use-live-session";
import { fromQuery } from "@/lib/api/async";
import type { Today } from "@/lib/api/schemas";
import { warmVoices } from "@/lib/speech/synthesis";
import { templateById } from "@/lib/templates";

export default function PracticePage() {
  const today = fromQuery(useToday());

  if (today.status === "loading") {
    return <ScreenLoading label="Building Today's Mission" />;
  }

  if (today.status === "error") {
    return (
      <StatusScreen
        eyebrow="Today's Mission"
        title="We couldn't load Today's Mission."
        body={today.message}
        onRetry={{ label: "Try again", run: today.retry }}
        action={{ label: "See your plan", href: "/plan" }}
        className="min-h-0"
      />
    );
  }

  return <LiveSession today={today.data} />;
}

function LiveSession({ today }: { today: Today }) {
  const router = useRouter();

  // Resume where the day was left, rather than restarting it. A learner who
  // closed the tab after three exercises should not be handed the first one
  // again — the server already knows which are done.
  const [index, setIndex] = useState(() => {
    const next = today.activities.findIndex((a) => a.status !== "COMPLETED");
    return next === -1 ? today.activities.length - 1 : next;
  });

  const activity = today.activities[index]!;
  const last = index === today.activities.length - 1;

  // Chrome populates its voice list asynchronously and returns an empty array
  // until it has. Asking once on mount means the coach's first sentence already
  // has a good voice rather than the system default.
  useEffect(warmVoices, []);

  const session = useLiveSession({
    activity,
    onComplete: () => {
      if (last) {
        toast.success("That's today's mission finished.");
        router.push("/progress");
      } else {
        setIndex((current) => current + 1);
      }
    },
  });

  const {
    phase,
    transcript,
    coachLine,
    correction,
    correctionCount,
    speakingMinutes,
    micBlocked,
    micReason,
    micSilent,
    error,
    toggle,
    stop,
    dismissCorrection,
  } = session;

  // The ambient field and the sidebar's progress card both live in the shell
  // layout, so they survive navigation. The session is what drives them.
  useAmbientState(phase);
  useReportProgress(speakingMinutes, correctionCount);

  // Surfaced as a toast rather than replacing the screen: a failed turn is
  // recoverable by pressing the button again, and tearing down the exercise
  // would throw away the turns that did work.
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const steps = useMemo(
    () =>
      today.activities.map((item) => ({
        templateId: item.templateId,
        label: templateById(item.templateId)?.name ?? "Speaking",
      })),
    [today.activities],
  );

  const handleSkip = last
    ? undefined
    : () => {
        stop();
        setIndex((current) => current + 1);
      };

  return (
    <main className="relative z-10 grid min-w-0 flex-1 grid-rows-[auto_1fr_auto] px-4 pb-6 pt-14 sm:px-6 md:pb-9 md:pt-7">
      {/* One universal domain, skinned by the Life Path. Hana practises it in a
          lecture hall, Samuel in a hotel lobby. */}
      <div className="flex flex-col items-center gap-3">
        <LessonHeader topic={today.theme} />
        <ActivityRail steps={steps} current={index} />
        <MicNotice blocked={micBlocked} reason={micReason} silent={micSilent} />
      </div>

      <ExerciseStage
        // Remounted per exercise, so a correction from the previous one cannot
        // land on top of this one's picture.
        key={activity.id}
        state={phase}
        stimulus={activity.stimulus ?? undefined}
        coachLine={phase === "idle" && !coachLine ? activity.prompt : coachLine}
        transcript={transcript}
        correction={correction}
        onDismissCorrection={dismissCorrection}
      />

      <div className="flex justify-center">
        <SessionControls
          state={phase}
          onToggleListening={toggle}
          onEnd={() => {
            stop();
            router.push("/plan");
          }}
          onSkip={handleSkip}
        />
      </div>
    </main>
  );
}
