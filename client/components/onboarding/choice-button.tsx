"use client";

import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ChoiceButtonProps extends Omit<ComponentProps<"button">, "children"> {
  selected: boolean;
  label: string;
  detail?: string;
  /** An icon tile, shown left of the label. */
  leading?: ReactNode;
  /** Replaces the tick with a note, for options that are not available yet. */
  badge?: string;
}

/**
 * One answer in a single-choice step. Behaves as a radio, looks like a card.
 *
 * The radio semantics — `role`, `aria-checked`, the roving `tabIndex` — are
 * passed in rather than set here, because they are a property of the group and
 * not of the button. `useRovingRadioGroup` owns them.
 */
export function ChoiceButton({
  selected,
  label,
  detail,
  leading,
  badge,
  className,
  disabled = false,
  ...props
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      {...props}
      className={cn(
        "surface-panel group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
        "transition-[border-color,background-color,transform,box-shadow] duration-200",
        "hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected && "border-foreground/70 shadow-selected",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      {leading}

      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium leading-tight text-foreground">
          {label}
        </span>
        {detail && (
          <span className="mt-1 block text-caption leading-snug text-muted-foreground">
            {detail}
          </span>
        )}
      </span>

      {badge ? (
        <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-micro font-medium uppercase tracking-wide text-muted-foreground">
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
