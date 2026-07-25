"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ChoiceButtonProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  detail?: string;
  /** An icon tile, shown left of the label. */
  leading?: ReactNode;
  disabled?: boolean;
  /** Replaces the tick with a note, for options that are not available yet. */
  badge?: string;
  className?: string;
}

/**
 * One answer in a single-choice step. Behaves as a radio, looks like a card.
 */
export function ChoiceButton({
  selected,
  onSelect,
  label,
  detail,
  leading,
  disabled = false,
  badge,
  className,
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "surface-panel group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
        "transition-[border-color,background-color,transform,box-shadow] duration-200",
        "hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected &&
          "border-foreground/70 shadow-[0_10px_30px_-18px_oklch(0.3_0.05_280/50%)]",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      {leading}

      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-medium leading-tight text-foreground">
          {label}
        </span>
        {detail && (
          <span className="mt-1 block text-[0.75rem] leading-snug text-muted-foreground">
            {detail}
          </span>
        )}
      </span>

      {badge ? (
        <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          {badge}
        </span>
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-200",
            selected
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/20 text-transparent",
          )}
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
