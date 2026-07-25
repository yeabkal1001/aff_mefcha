"use client";

import { Mic, X } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SessionState } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface SessionControlsProps {
  state: SessionState;
  onToggleListening: () => void;
  onEnd: () => void;
}

export function SessionControls({
  state,
  onToggleListening,
  onEnd,
}: SessionControlsProps) {
  const listening = state === "listening";

  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleListening}
            aria-pressed={listening}
            aria-label={listening ? "Stop speaking" : "Start speaking"}
            className={cn(
              "relative grid size-[3.25rem] place-items-center rounded-full bg-[oklch(0.21_0.012_265)] text-white",
              "transition-[transform,box-shadow,background-color] duration-300 ease-out",
              "hover:scale-105 active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
              listening &&
                "bg-[oklch(0.17_0.015_280)] shadow-[0_0_0_6px_oklch(0.64_0.263_349/12%)]",
            )}
          >
            {/* A halo that breathes only while the mic is open. */}
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.64_0.263_349/18%)] [animation-duration:2.2s]" />
            )}
            <Mic className="relative size-[1.15rem]" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={10}>
          {listening ? "Stop speaking" : "Start speaking"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End session"
            className={cn(
              "grid size-[3.25rem] place-items-center rounded-full bg-[oklch(0.36_0.012_265)] text-white",
              "transition-transform duration-300 ease-out hover:scale-105 active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
            )}
          >
            <X className="size-[1.15rem]" strokeWidth={2.25} />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={10}>End session</TooltipContent>
      </Tooltip>
    </div>
  );
}
