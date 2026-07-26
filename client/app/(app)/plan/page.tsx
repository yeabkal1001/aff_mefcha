"use client";

import { ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/queries";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { valueOf, fromQuery } from "@/lib/api/async";
import { buildLearnerProfile } from "@/lib/learner-profile";
import { profileToDraft } from "@/lib/onboarding-replay";
import { phaseRange, projectOutline, type OutlinePhase } from "@/lib/study-outline";
import { cn } from "@/lib/utils";

/**
 * The thirty-day outline.
 *
 * Everything on this screen is derived on render from the learner profile —
 * there is no plan object anywhere, and reloading recomputes it. That is the
 * decision in ADR 0007 made visible: the arc is knowable in advance, the
 * sessions are not, so the screen shows domains and objectives and never
 * claims to know what Tuesday's exercise will be.
 */
export default function PlanPage() {
  const draft = useOnboardingDraft();
  const learner = valueOf(fromQuery(useMe()));

  // The account wins once there is one. It is the answers as they stand after
  // any change made in settings, and it is the only copy that exists on a
  // second device — the draft is per-browser by design.
  const answers = useMemo(
    () => (learner ? profileToDraft(learner) : draft),
    [draft, learner],
  );

  const profile = useMemo(() => buildLearnerProfile(answers), [answers]);
  const outline = useMemo(() => projectOutline(profile), [profile]);

  return (
    <main className="relative z-10 min-w-0 flex-1 overflow-y-auto px-4 pb-9 pt-14 sm:px-6 md:px-8 md:pt-9">
      <div className="mx-auto max-w-[44rem]">
        <header>
          <p className="label-eyebrow">Your next 30 days</p>
          <h1 className="mt-2 text-display-sm font-semibold leading-tight tracking-tight">
            {profile.name
              ? `${profile.name}, here's the road ahead.`
              : "Here's the road ahead."}
          </h1>
          <p className="mt-2.5 max-w-[34rem] text-body leading-relaxed text-muted-foreground">
            Built from your {profile.lifePath.name.toLowerCase()} path at level{" "}
            {profile.cefr}, at {profile.budget.minutes} minutes a day. That is{" "}
            {outline.totalActivities} activities across{" "}
            {Math.round(outline.totalMinutes / 60)} hours of speaking.
          </p>
        </header>

        <Caveat placed={outline.placed} />

        <ol className="mt-8 space-y-3">
          {outline.phases.map((phase, i) => (
            <Phase
              key={phase.domain.id}
              phase={phase}
              index={i}
              current={i === 0}
            />
          ))}
        </ol>

        <Horizon reachesNextBand={outline.reachesNextBand} cefr={profile.cefr} />

        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" className="rounded-full">
            <Link href="/practice">
              Start Today&apos;s Mission
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

/**
 * The honesty note, and not decoration.
 *
 * An outline that looks like a schedule invites the learner to treat day
 * nineteen as a commitment. It is not one — day nineteen is chosen on day
 * nineteen, from evidence that does not exist yet — and saying so here is
 * cheaper than explaining it after the dates move.
 */
function Caveat({ placed }: { placed: boolean }) {
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-foreground/[0.035] px-4 py-3">
      <Info className="mt-[3px] size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
      <p className="text-ui leading-relaxed text-muted-foreground">
        {placed ? (
          <>
            This is the shape of your next month, not a timetable. Your coach picks each
            day&apos;s activities that morning, from what you actually did the day before — so
            these dates move when you move.
          </>
        ) : (
          <>
            You haven&apos;t been placed yet, so this is built on a starting level we&apos;ve
            assumed rather than measured. Finish the four-minute assessment and it will be
            rebuilt from your own speech.
          </>
        )}
      </p>
    </div>
  );
}

function Phase({
  phase,
  index,
  current,
}: {
  phase: OutlinePhase;
  index: number;
  current: boolean;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        "surface-panel rounded-2xl px-5 py-4",
        current && "ring-1 ring-foreground/15",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="label-eyebrow">{phaseRange(phase)}</p>
        {current && (
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            Starting here
          </span>
        )}
      </div>

      <h2 className="mt-1.5 text-lead font-semibold leading-tight tracking-tight">
        {phase.domain.name}
      </h2>
      <p className="mt-1 text-ui leading-relaxed text-muted-foreground">
        {phase.theme}
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {phase.objectives.map((objective) => (
          <li key={objective} className="flex items-start gap-2">
            <Check
              className="mt-[3px] size-3 shrink-0 text-coach-correct"
              strokeWidth={3}
            />
            <span className="text-ui leading-snug text-foreground/80">
              {objective}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border/60 pt-2.5 text-caption text-muted-foreground">
        About {phase.activities} activities
      </p>
    </motion.li>
  );
}

function Horizon({
  reachesNextBand,
  cefr,
}: {
  reachesNextBand: boolean;
  cefr: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-4">
      <p className="label-eyebrow">After that</p>
      <p className="mt-1.5 text-body leading-relaxed text-muted-foreground">
        {reachesNextBand ? (
          <>
            Thirty days covers every {cefr} domain on your path. Clearing them all to mastery
            is what moves you up a level — not the calendar — so the next band opens when the
            evidence says it should.
          </>
        ) : (
          <>
            Thirty days won&apos;t cover every {cefr} domain at this pace, and that is fine.
            The remaining ones come next, in the same order.
          </>
        )}
      </p>
    </div>
  );
}
