"use client";

import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { pastSessions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ChatHistory() {
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        Chat History
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-300",
            !open && "-rotate-90",
          )}
          strokeWidth={1.75}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <ul className="mt-1 space-y-0.5 overflow-hidden">
          {pastSessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                className="w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-foreground/[0.035]"
              >
                <span className="block truncate text-[0.8125rem] tracking-tight text-foreground/85">
                  {session.title}
                </span>
                <span className="mt-px block text-[0.75rem] text-muted-cool">
                  {session.minutes} min &middot; {session.corrections}{" "}
                  corrections
                </span>
              </button>
            </li>
          ))}

          <li>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[0.75rem] text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
              More
            </button>
          </li>
        </ul>
      </div>
    </section>
  );
}
