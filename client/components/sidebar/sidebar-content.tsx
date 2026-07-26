"use client";

import { PanelLeft } from "lucide-react";

import { BrandMark } from "@/components/sidebar/brand-mark";
import { ChatHistory } from "@/components/sidebar/chat-history";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { TipCard } from "@/components/sidebar/tip-card";
import { TodaysProgress } from "@/components/sidebar/todays-progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Async } from "@/lib/api/async";

/**
 * One past day, as the sidebar shows it.
 *
 * A view model rather than the wire type: `HistoryDay` carries every session
 * and its turn counts, and this list needs a line of text. Narrowing here keeps
 * the widening — a day becoming a link, a session detail screen — a change to
 * one mapping rather than to the component.
 */
export interface HistoryEntry {
  id: string;
  title: string;
  /** "Tuesday" for this week, "12 Mar" beyond it. */
  when: string;
  exercises: number;
  turns: number;
  complete: boolean;
}

/** Today, as the progress card shows it. */
export interface DailyProgress {
  speakingMinutes: number;
  speakingGoalMinutes: number;
  corrections: number;
  exercisesDone: number;
  exercisesTotal: number;
  streakDays: number;
}

/**
 * Everything the sidebar renders, in one shape.
 *
 * Passed down rather than imported, and each field carries its own load state
 * rather than the sidebar waiting on the slowest of them. The nav and the
 * learner's name are the two things worth showing instantly, so they never
 * sit behind a request.
 */
export interface SidebarData {
  /** Usually the local draft, so it is on screen before any request returns. */
  learnerName: Async<string>;
  plan: Async<string>;
  coachName: string;
  tip: Async<string>;
  sessions: Async<HistoryEntry[]>;
  progress: Async<DailyProgress>;
}

/**
 * The sidebar's contents, independent of how it is presented.
 *
 * Rendered inline on a desktop and inside a drawer on a phone. Keeping the two
 * presentations over one body is what stops the mobile sidebar drifting into a
 * different product from the desktop one.
 */
export function SidebarContent({
  data,
  onCollapse,
}: {
  data: SidebarData;
  /** Absent inside the mobile drawer, which closes rather than collapses. */
  onCollapse?: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
          <span className="min-w-0 flex-1">
            {data.learnerName.status === "ready" ? (
              <span className="block truncate text-ui font-semibold leading-tight text-foreground">
                {data.learnerName.data}
              </span>
            ) : (
              <Skeleton className="h-3 w-24" aria-hidden />
            )}
            {data.plan.status === "ready" ? (
              <span className="block text-mini leading-tight text-muted-foreground">
                {data.plan.data}
              </span>
            ) : (
              <Skeleton className="mt-1.5 h-2 w-14" aria-hidden />
            )}
          </span>
        </div>

        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onCollapse}
                aria-label="Collapse sidebar"
                aria-expanded
                className="rounded-md p-0.5 text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <PanelLeft className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Collapse sidebar
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-3.5 shrink-0">
        <SidebarNav />
      </div>

      {/* The history is the elastic region: it absorbs the leftover space and
          scrolls if the list outgrows it, so the cards below always stay
          pinned inside the panel. */}
      <div className="mt-3.5 min-h-0 flex-1 overflow-y-auto">
        <ChatHistory sessions={data.sessions} />
      </div>

      <div className="mt-3 shrink-0 space-y-2">
        <TodaysProgress progress={data.progress} />
        <TipCard tip={data.tip} coachName={data.coachName} />
        <div className="flex justify-end pt-0.5">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
