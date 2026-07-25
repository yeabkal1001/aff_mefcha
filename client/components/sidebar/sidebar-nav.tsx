"use client";

import {
  AudioLines,
  BarChart3,
  NotebookPen,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const NAV: { label: string; icon: LucideIcon }[] = [
  { label: "Practice", icon: AudioLines },
  { label: "Lessons", icon: NotebookPen },
  { label: "Progress", icon: BarChart3 },
  { label: "Settings", icon: SlidersHorizontal },
];

export function SidebarNav() {
  const [active, setActive] = useState("Practice");

  return (
    <nav aria-label="Main">
      <ul className="space-y-px">
        {NAV.map(({ label, icon: Icon }) => {
          const isActive = active === label;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => setActive(label)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left",
                  "text-[0.75rem] transition-colors duration-200",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-foreground/70 hover:bg-foreground/[0.035] hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-[0.9375rem] shrink-0 transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                  strokeWidth={1.75}
                />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
