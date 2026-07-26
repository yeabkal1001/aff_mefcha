"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

/**
 * Three explicit choices rather than a two-state switch.
 *
 * A switch has to pick a side before it knows the system preference, so it
 * either lies for a frame or forces a theme the learner never asked for.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The server cannot know the stored theme, so the selected state is only
  // truthful after hydration. Until then every option renders unselected.
  const hydrated = useHydrated();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-panel-border bg-panel p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = hydrated && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-6 place-items-center rounded-full transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
