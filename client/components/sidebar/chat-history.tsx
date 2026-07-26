"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import type { HistoryEntry } from "@/components/sidebar/sidebar-content";
import { Skeleton } from "@/components/ui/skeleton";
import type { Async } from "@/lib/api/async";
import { cn } from "@/lib/utils";

/**
 * What the coach remembers — the learner's real past days.
 *
 * Rows are inert on purpose rather than by omission. They used to be
 * `<button>`s with no handler, which is the worst of both worlds: they invited
 * a click and swallowed it. There is no per-day screen yet, so they are a list.
 */
export function ChatHistory({ sessions }: { sessions: Async<HistoryEntry[]> }) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Chat History
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-300",
            !open && "-rotate-90",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      <div
        id={listId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <Body sessions={sessions} />
        </div>
      </div>
    </section>
  );
}

function Body({ sessions }: { sessions: Async<HistoryEntry[]> }) {
  if (sessions.status === "loading") {
    return (
      <div className="mt-1 space-y-2 px-2 py-1" aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (sessions.status === "error") {
    return (
      <div className="px-2 py-1.5">
        <p className="text-caption leading-relaxed text-muted-foreground">
          {sessions.message}
        </p>
        <button
          type="button"
          onClick={sessions.retry}
          className="mt-1 text-caption font-medium text-foreground underline underline-offset-4"
        >
          Retry
        </button>
      </div>
    );
  }

  if (sessions.data.length === 0) {
    return (
      <p className="px-2 py-1.5 text-caption leading-relaxed text-muted-foreground">
        Nothing here yet. Your first conversation shows up the moment you finish
        it.
      </p>
    );
  }

  return (
    <ul className="mt-1 space-y-0.5">
      {sessions.data.map((session) => (
        <li key={session.id} className="rounded-lg px-2 py-1">
          <span className="block truncate text-ui tracking-tight text-foreground/85">
            {session.title}
          </span>
          <span className="mt-px block text-caption text-muted-cool">
            {session.when} &middot;{" "}
            {session.turns > 0
              ? `${session.turns} ${session.turns === 1 ? "turn" : "turns"}`
              : // A day that was built and never spoken to. Saying "0 turns"
                // reads as a failure; saying what it is reads as an invitation.
                "not started"}
          </span>
        </li>
      ))}
    </ul>
  );
}
