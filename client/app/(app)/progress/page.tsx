"use client";

import { ArrowRight, Flame } from "lucide-react";
import { motion } from "motion/react";

import { ScreenLoading } from "@/components/shell/screen-loading";
import { StatusScreen } from "@/components/shell/status-screen";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommunicationProfile, useCorrections, useMe } from "@/hooks/queries";
import { fromQuery, valueOf, type Async } from "@/lib/api/async";
import {
  SKILL_LABEL,
  type CommunicationProfile,
  type Learner,
  type PastCorrection,
} from "@/lib/api/schemas";

/**
 * The Communication Profile: four numbers, and the evidence behind them.
 *
 * The four are fixed — Grammar, Vocabulary, Fluency, Sentence Structure — and
 * nothing else becomes one. See CONTEXT.md and ADR 0006. Confidence and
 * presentation are things learners improve *at*, not things this can measure
 * from a transcript, and putting a number on them would be inventing data.
 *
 * A dimension with no evidence shows a dash, never a zero. Zero is a
 * measurement, and four zeroes on a first visit read as four failures.
 */
export default function ProgressPage() {
  const profile = fromQuery(useCommunicationProfile());
  const corrections = fromQuery(useCorrections(20));
  // Placement lives on the learner, not on the profile: it is a fact about the
  // account, and duplicating it into the profile response would be two answers
  // to one question.
  const me = valueOf(fromQuery(useMe()));

  if (profile.status === "loading") return <ScreenLoading label="Reading your progress" />;

  if (profile.status === "error") {
    return (
      <StatusScreen
        eyebrow="Progress"
        title="We couldn't load your progress."
        body={profile.message}
        onRetry={{ label: "Try again", run: profile.retry }}
        action={{ label: "Back to practice", href: "/practice" }}
        className="min-h-0"
      />
    );
  }

  return (
    <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-5 pb-16 pt-14 sm:px-6 md:pt-10">
      <Header learner={me} />
      <Dimensions profile={profile.data} />
      <Totals profile={profile.data} />
      <Corrections corrections={corrections} />
    </main>
  );
}

function Header({ learner }: { learner: Learner | undefined }) {
  // `placedAt`, not the presence of a CEFR. A level is stored from the moment
  // the account exists — it defaults to A2 — so reading the level as evidence
  // of placement would tell every new learner they had been measured.
  const placed = learner?.profile.placedAt !== null && learner !== undefined;

  return (
    <header>
      <p className="label-eyebrow">Your Communication Profile</p>
      <h1 className="mt-2 text-display-sm font-semibold tracking-tight">
        {placed ? `You're speaking at ${learner.profile.cefr}.` : "Not measured yet."}
      </h1>
      <p className="mt-2 max-w-prose text-body leading-relaxed text-muted-foreground">
        {placed
          ? "Each number is how often you get that right when the chance comes up — measured from what you actually said, not from a test."
          : "Finish a few conversations and these fill in. Until then there is nothing honest to show."}
      </p>
    </header>
  );
}

function Dimensions({ profile }: { profile: CommunicationProfile }) {
  return (
    <section className="mt-9 grid gap-3 sm:grid-cols-2">
      {profile.dimensions.map((dimension, i) => (
        <motion.article
          key={dimension.skill}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4 }}
          className="surface-panel rounded-2xl px-5 py-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-ui font-medium text-foreground/85">
              {SKILL_LABEL[dimension.skill]}
            </h2>
            <p className="text-display-xs font-semibold tabular-nums tracking-tight">
              {dimension.percent === null ? (
                <span className="text-muted-foreground/60" aria-label="Not yet assessed">
                  —
                </span>
              ) : (
                `${Math.round(dimension.percent)}%`
              )}
            </p>
          </div>

          {/* The bar is drawn from the same number as the label, and is absent
              when the label is. A zero-width bar under a dash would read as a
              score of nothing. */}
          {dimension.percent !== null && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dimension.percent}%` }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-primary"
              />
            </div>
          )}

          <p className="mt-2.5 text-caption text-muted-foreground">
            {dimension.observedCount === 0
              ? "No evidence yet"
              : `${dimension.observedCount} of ${dimension.totalCount} skills measured`}
          </p>
        </motion.article>
      ))}
    </section>
  );
}

function Totals({ profile }: { profile: CommunicationProfile }) {
  const { totals } = profile;

  return (
    <section className="mt-9">
      <h2 className="text-heading font-semibold tracking-tight">Since you started</h2>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Total label="Exercises" value={totals.sessionsCompleted} />
        <Total label="Turns spoken" value={totals.turnsSpoken} />
        <Total label="Corrections" value={totals.corrections} />
        <Total
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1.5 text-coach-streak">
              <Flame className="size-4 fill-current" strokeWidth={0} aria-hidden />
              {totals.streakDays}
            </span>
          }
        />
      </dl>
    </section>
  );
}

function Total({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="surface-panel rounded-xl px-4 py-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-heading font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Everything the coach has corrected, most recent first.
 *
 * Read from attempts rather than from a separate log, so this list and the
 * numbers above rest on the same rows and cannot disagree.
 */
function Corrections({ corrections }: { corrections: Async<{ items: PastCorrection[] }> }) {
  return (
    <section className="mt-9">
      <h2 className="text-heading font-semibold tracking-tight">What you&apos;ve fixed</h2>

      {corrections.status === "loading" && (
        <div className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {corrections.status === "error" && (
        <p className="mt-4 text-ui leading-relaxed text-muted-foreground">
          {corrections.message}
        </p>
      )}

      {corrections.status === "ready" && corrections.data.items.length === 0 && (
        <p className="mt-4 text-ui leading-relaxed text-muted-foreground">
          Nothing yet. The first correction shows up the moment your coach hears
          something worth fixing.
        </p>
      )}

      {corrections.status === "ready" && corrections.data.items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {corrections.data.items.map((correction) => (
            <li key={correction.id} className="surface-panel rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-full bg-foreground/[0.06] px-2 py-px text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                  {SKILL_LABEL[correction.skill]}
                </span>
                <span className="text-caption text-muted-foreground">
                  {correction.competency}
                </span>
              </div>

              <p className="mt-2 text-ui leading-relaxed text-foreground/70">
                {correction.said}
              </p>

              {correction.better && (
                <p className="mt-1 flex items-start gap-1.5 text-ui leading-relaxed">
                  <ArrowRight
                    className="mt-1 size-3.5 shrink-0 text-coach-correct/70"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span className="mark-correct">{correction.better}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
