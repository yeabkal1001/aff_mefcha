"use client";

import { Mic, SkipForward, X } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SessionPhase } from "@/lib/session/phase";
import { cn } from "@/lib/utils";

interface SessionControlsProps {
  state: SessionPhase;
  onToggleListening: () => void;
  onEnd: () => void;
  /** Absent on the last activity of the Day Plan. */
  onSkip?: () => void;
}

export function SessionControls({
  state,
  onToggleListening,
  onEnd,
  onSkip,
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
              "relative grid size-[3.25rem] place-items-center rounded-full bg-control text-control-foreground",
              "transition-[transform,box-shadow,background-color] duration-300 ease-out",
              "hover:scale-105 active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
              listening &&
                "bg-control-active shadow-mic-live",
            )}
          >
            {/* A halo that breathes only while the mic is open. */}
            {listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-control-ping [animation-duration:2.2s]" />
            )}
            <Mic className="relative size-[1.15rem]" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={10}>
          {listening ? "Stop speaking" : "Start speaking"}
        </TooltipContent>
      </Tooltip>

      {/* A Day Plan is several activities, so there has to be a way past one
          that is not working — otherwise the only exit is ending the session. */}
      {onSkip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSkip}
              aria-label="Next activity"
              className={cn(
                "grid size-[3.25rem] place-items-center rounded-full bg-control-muted text-control-muted-foreground",
                "transition-transform duration-300 ease-out hover:scale-105 active:scale-95",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
              )}
            >
              <SkipForward className="size-[1.05rem]" strokeWidth={2.25} />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={10}>Next activity</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End session"
            className={cn(
              "grid size-[3.25rem] place-items-center rounded-full bg-control-muted text-control-muted-foreground",
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
