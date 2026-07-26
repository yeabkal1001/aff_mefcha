import { Flame, Gauge } from "lucide-react";

import { ProgressRing } from "@/components/sidebar/progress-ring";
import type { DailyProgress } from "@/components/sidebar/sidebar-content";
import { Skeleton } from "@/components/ui/skeleton";
import type { Async } from "@/lib/api/async";

export function TodaysProgress({
  progress,
}: {
  progress: Async<DailyProgress>;
}) {
  return (
    <section className="surface-panel rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between">
        <h2 className="label-eyebrow">Today&apos;s Progress</h2>
        <Gauge
          className="size-3.5 text-muted-foreground/50"
          strokeWidth={2}
          aria-hidden
        />
      </div>

      {progress.status === "ready" ? (
        <Figures {...progress.data} />
      ) : progress.status === "error" ? (
        <p className="mt-2 text-caption leading-relaxed text-muted-foreground">
          Today&apos;s numbers didn&apos;t load. Your practice still counted.
        </p>
      ) : (
        <div className="mt-2.5 space-y-2.5" aria-hidden>
          <div className="flex items-center gap-3">
            <Skeleton className="size-[42px] rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
        </div>
      )}
    </section>
  );
}

function Figures({
  speakingMinutes,
  speakingGoalMinutes,
  corrections,
  exercisesDone,
  exercisesTotal,
  streakDays,
}: DailyProgress) {
  return (
    <>
      <div className="mt-2.5 flex items-center gap-3">
        <ProgressRing
          value={speakingMinutes / speakingGoalMinutes}
          size={42}
          label={`Speaking time: ${speakingMinutes} of ${speakingGoalMinutes} minutes`}
        />
        <div className="min-w-0">
          <p className="text-mini leading-tight text-muted-foreground">
            Speaking Time
          </p>
          <p className="text-body font-semibold leading-tight tabular-nums text-foreground">
            {speakingMinutes} / {speakingGoalMinutes} min
          </p>
        </div>
      </div>

      <dl className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2.5">
        <Stat label="Corrections" value={corrections} />
        {/* Exercises rather than "new vocabulary": the server counts attempts
            against competencies, and there is no per-day count of words met
            for the first time. A number that cannot be computed honestly is
            better replaced than approximated. */}
        <Stat label="Exercises" value={`${exercisesDone} / ${exercisesTotal}`} />
        <Stat
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1 font-semibold text-coach-streak">
              <Flame
                className="size-3.5 fill-current"
                strokeWidth={0}
                aria-hidden
              />
              {streakDays} days
            </span>
          }
        />
      </dl>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-caption font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
