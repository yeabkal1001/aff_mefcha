import { Flame, Gauge } from "lucide-react";

import { ProgressRing } from "@/components/sidebar/progress-ring";
import { dailyProgress } from "@/lib/mock-data";

interface TodaysProgressProps {
  /** Live from the session, so the card moves while the learner talks. */
  speakingMinutes: number;
  corrections: number;
}

export function TodaysProgress({
  speakingMinutes,
  corrections,
}: TodaysProgressProps) {
  const goal = dailyProgress.speakingGoalMinutes;

  return (
    <section className="surface-panel rounded-xl px-2.5 py-2">
      <div className="flex items-center justify-between">
        <h2 className="label-eyebrow">Today&apos;s Progress</h2>
        <Gauge className="size-3 text-muted-foreground/50" strokeWidth={2} />
      </div>

      <div className="mt-2 flex items-center gap-2.5">
        <ProgressRing value={speakingMinutes / goal} />
        <div className="min-w-0">
          <p className="text-[0.625rem] leading-tight text-muted-foreground">
            Speaking Time
          </p>
          <p className="text-[0.8125rem] font-semibold leading-tight tabular-nums text-foreground">
            {speakingMinutes} / {goal} min
          </p>
        </div>
      </div>

      <dl className="mt-2 space-y-1 border-t border-border/60 pt-2">
        <Stat label="Corrections" value={corrections} />
        <Stat label="New Vocabulary" value={dailyProgress.newVocabulary} />
        <Stat
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1 font-semibold text-coach-streak">
              <Flame className="size-3 fill-current" strokeWidth={0} />
              {dailyProgress.streakDays} days
            </span>
          }
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[0.6875rem] text-muted-foreground">{label}</dt>
      <dd className="text-[0.6875rem] font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
