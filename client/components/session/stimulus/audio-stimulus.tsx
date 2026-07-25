"use client";

import { Play, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { StimulusLabel, StimulusPanel } from "./stimulus-panel";
import type { AudioQuestionStimulus, AudioStimulus } from "./types";

/** Deterministic bar heights, so the waveform does not reshuffle on re-render. */
function bars(count: number, seed: number) {
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin((i + seed) * 0.7) * 0.5 + Math.sin((i + seed) * 0.23) * 0.5;
    return 0.28 + Math.abs(wave) * 0.72;
  });
}

/**
 * `EX004`, `EX005`, `EX006` — the learner listens before speaking.
 *
 * The replay counter is the pedagogically load-bearing part. `EX005 Listen &
 * Summarize` tests whether the learner held the content, so unlimited replays
 * turn it into a transcription exercise; `EX006 Shadowing` is pure imitation,
 * so restricting replays would just make it harder for no reason. Both use
 * this component and differ only in `replaysAllowed`.
 */
export function AudioStimulusView({
  spec,
  compact,
}: {
  spec: AudioStimulus;
  compact?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef<number>(undefined);

  const replaysLeft = Math.max(0, spec.replaysAllowed - Math.max(0, played - 1));
  const exhausted = played > 0 && replaysLeft === 0;

  useEffect(() => {
    if (!playing) return;

    const started = performance.now();
    const tick = () => {
      const seconds = (performance.now() - started) / 1000;
      if (seconds >= spec.seconds) {
        setElapsed(spec.seconds);
        setPlaying(false);
        return;
      }
      setElapsed(seconds);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [playing, spec.seconds]);

  const progress = spec.seconds > 0 ? elapsed / spec.seconds : 0;
  const shape = bars(compact ? 22 : 40, 3);

  return (
    <div className="flex w-full flex-col items-center">
      {!compact && <StimulusLabel>Listen</StimulusLabel>}

      <StimulusPanel className="w-full px-4 py-3">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              if (exhausted && !playing) return;
              setElapsed(0);
              setPlayed((n) => n + 1);
              setPlaying(true);
            }}
            disabled={exhausted && !playing}
            aria-label={played === 0 ? "Play audio" : "Play again"}
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full transition",
              "bg-foreground text-background hover:opacity-90",
              "disabled:pointer-events-none disabled:opacity-30",
            )}
          >
            {played === 0 ? (
              <Play className="size-4 translate-x-[1px] fill-current" strokeWidth={0} />
            ) : (
              <RotateCcw className="size-4" strokeWidth={2} />
            )}
          </button>

          <div className="flex h-9 flex-1 items-center justify-between" aria-hidden>
            {shape.map((height, i) => {
              const reached = i / shape.length <= progress;
              return (
                <motion.span
                  key={i}
                  className={cn(
                    "w-[3px] rounded-full",
                    reached ? "bg-foreground/70" : "bg-foreground/15",
                  )}
                  animate={{
                    height: `${height * (playing && reached ? 100 : 72)}%`,
                  }}
                  transition={{ duration: 0.18 }}
                />
              );
            })}
          </div>

          <span className="shrink-0 text-[0.75rem] tabular-nums text-muted-foreground">
            {Math.ceil(spec.seconds - elapsed)}s
          </span>
        </div>

        {/* Shadowing shows the words; summarising must not. */}
        {spec.transcript && !compact && (
          <p className="mt-3 border-t border-border/60 pt-3 text-center text-[0.9375rem] font-medium leading-snug text-foreground/85">
            {spec.transcript}
          </p>
        )}
      </StimulusPanel>

      {!compact && spec.replaysAllowed > 0 && (
        <p className="mt-2 text-[0.75rem] text-muted-foreground">
          {played === 0
            ? `You can replay this ${spec.replaysAllowed} ${spec.replaysAllowed === 1 ? "time" : "times"}.`
            : exhausted
              ? "No replays left — say what you remember."
              : `${replaysLeft} ${replaysLeft === 1 ? "replay" : "replays"} left.`}
        </p>
      )}
    </div>
  );
}

/**
 * `EX007`, `EX008`, `EX010` — the coach asks a question out loud.
 *
 * Distinct from `AudioStimulusView` because the question is not a listening
 * test: the words stay on screen, there is no replay budget, and the visual
 * weight belongs to the question rather than to the player.
 */
export function AudioQuestionStimulusView({
  spec,
  compact,
}: {
  spec: AudioQuestionStimulus;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      {!compact && <StimulusLabel>The coach asks</StimulusLabel>}
      <StimulusPanel className="px-5 py-4">
        <p
          className={cn(
            "text-balance text-center font-medium leading-snug tracking-tight",
            compact ? "text-[0.9375rem]" : "text-[1.125rem]",
          )}
        >
          {spec.question}
        </p>
      </StimulusPanel>
    </div>
  );
}
