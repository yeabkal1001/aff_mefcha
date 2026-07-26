"use client";

import { Play, RotateCcw } from "lucide-react";
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
  /** Whole seconds left. The only part of playback React needs to re-render. */
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(spec.seconds));
  const waveRef = useRef<HTMLDivElement>(null);

  const replaysLeft = Math.max(0, spec.replaysAllowed - Math.max(0, played - 1));
  const exhausted = played > 0 && replaysLeft === 0;

  // Playback moves two things: a fill across forty bars, and a countdown. The
  // fill is written straight to a CSS custom property so it runs on the
  // compositor — driving it through state re-rendered every one of those bars
  // sixty times a second, for an animation React was adding nothing to.
  useEffect(() => {
    const node = waveRef.current;
    if (!playing || !node) return;

    const started = performance.now();
    let raf = 0;

    const paint = () => {
      const seconds = Math.min(spec.seconds, (performance.now() - started) / 1000);
      node.style.setProperty(
        "--played",
        String(spec.seconds > 0 ? seconds / spec.seconds : 0),
      );
      setSecondsLeft(Math.ceil(spec.seconds - seconds));

      if (seconds >= spec.seconds) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [playing, spec.seconds]);

  const shape = bars(compact ? 22 : 40, 3);

  const restart = () => {
    if (exhausted && !playing) return;
    waveRef.current?.style.setProperty("--played", "0");
    setSecondsLeft(Math.ceil(spec.seconds));
    setPlayed((n) => n + 1);
    setPlaying(true);
  };

  return (
    <div className="flex w-full flex-col items-center">
      {!compact && <StimulusLabel>Listen</StimulusLabel>}

      <StimulusPanel className="w-full px-4 py-3">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={restart}
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

          {/* Two identical waveforms stacked: a dim one, and a bright one
              clipped to how far playback has got. The clip is the only thing
              that moves, and it moves on the compositor. */}
          <div
            ref={waveRef}
            className="relative h-9 flex-1 [--played:0]"
            aria-hidden
          >
            <Waveform shape={shape} className="text-foreground/15" />
            <div className="absolute inset-0 [clip-path:inset(0_calc((1-var(--played))*100%)_0_0)]">
              <Waveform shape={shape} className="text-foreground/70" />
            </div>
          </div>

          <span className="shrink-0 text-caption tabular-nums text-muted-foreground">
            {secondsLeft}s
          </span>
        </div>

        {/* Shadowing shows the words; summarising must not. */}
        {spec.transcript && !compact && (
          <p className="mt-3 border-t border-border/60 pt-3 text-center text-body font-medium leading-snug text-foreground/85">
            {spec.transcript}
          </p>
        )}
      </StimulusPanel>

      {!compact && spec.replaysAllowed > 0 && (
        <p className="mt-2 text-caption text-muted-foreground">
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

function Waveform({
  shape,
  className,
}: {
  shape: number[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-between",
        className,
      )}
    >
      {shape.map((height, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current"
          style={{ height: `${height * 100}%` }}
        />
      ))}
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
            compact ? "text-body" : "text-lead",
          )}
        >
          {spec.question}
        </p>
      </StimulusPanel>
    </div>
  );
}
