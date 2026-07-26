"use client";

import { useMemo } from "react";

import { ProfileSync } from "@/components/profile-sync";
import { AmbientBackground } from "@/components/session/ambient-background";
import { ShellProvider, useShell } from "@/components/shell/shell-context";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import type {
  HistoryEntry,
  SidebarData,
} from "@/components/sidebar/sidebar-content";
import { useCommunicationProfile, useHistory, useMe, useToday } from "@/hooks/queries";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { fromQuery, mapAsync, ready, valueOf } from "@/lib/api/async";
import type { HistoryDay } from "@/lib/api/schemas";
import { lifePathById } from "@/lib/onboarding";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ProfileSync />
      <ShellFrame>{children}</ShellFrame>
    </ShellProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { ambient, liveProgress } = useShell();
  const { name } = useOnboardingDraft();

  const me = fromQuery(useMe());
  const today = fromQuery(useToday());
  const history = fromQuery(useHistory(12));
  const profile = fromQuery(useCommunicationProfile());

  const sidebar = useMemo<SidebarData>(() => {
    const learner = valueOf(me);
    const totals = valueOf(profile)?.totals;

    return {
      // The draft name beats the account name: the learner typed it three
      // screens ago, and there is no reason to make them wait for a request to
      // see it come back.
      learnerName: name
        ? ready(name)
        : mapAsync(me, (it) => it.displayName ?? "Learner"),

      // The Life Path, not a billing tier. It is the one line that tells the
      // learner what this coach is currently for.
      plan: mapAsync(me, (it) =>
        it.profile.lifePathId
          ? (lifePathById(it.profile.lifePathId)?.name ?? "Everyday English")
          : "Everyday English",
      ),

      coachName: "your coach",

      tip: mapAsync(today, (it) => it.domain.description),

      sessions: mapAsync(history, (page) => page.items.map(toEntry)),

      // While a session is on screen its own counters win, because they move as
      // the learner talks. Everywhere else the card shows today's stored totals.
      progress: mapAsync(today, (day) => ({
        // The server counts seconds; the card shows minutes. Rounding here
        // rather than on the wire keeps the API's unit the precise one.
        speakingMinutes:
          liveProgress?.speakingMinutes ?? Math.round((totals?.speakingSeconds ?? 0) / 60),
        speakingGoalMinutes: learner?.profile.dailyMinutes ?? 15,
        corrections: liveProgress?.corrections ?? totals?.corrections ?? 0,
        exercisesDone: day.activities.filter((a) => a.status === "COMPLETED").length,
        exercisesTotal: day.activities.length,
        streakDays: totals?.streakDays ?? 0,
      })),
    };
  }, [history, liveProgress, me, name, profile, today]);

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <AmbientBackground state={ambient} />
      <AppSidebar data={sidebar} />
      {children}
    </div>
  );
}

/** A past day, condensed to the line the sidebar has room for. */
function toEntry(day: HistoryDay): HistoryEntry {
  return {
    id: day.id,
    title: day.theme,
    when: relativeDay(day.date),
    exercises: day.activities.length,
    turns: day.activities.reduce((sum, activity) => sum + activity.turnCount, 0),
    complete: day.completedAt !== null,
  };
}

/**
 * "Today", "Yesterday", a weekday, or a date.
 *
 * Parsed as local midnight rather than with `new Date(iso)`, which reads a bare
 * `YYYY-MM-DD` as UTC — putting every day one behind for anyone west of
 * Greenwich, and making yesterday's session read as "2 days ago" in Addis for
 * part of the evening.
 */
function relativeDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;

  const date = new Date(year, month - 1, day);
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((midnight.getTime() - date.getTime()) / 86_400_000);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
