"use client";

import { useEffect, useRef } from "react";

import { useAudioLevel } from "@/hooks/use-audio-level";
import type { SessionState } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface VoiceOrbProps {
  state: SessionState;
  className?: string;
}

/**
 * The centre of the screen, and the only thing on it that has to feel alive.
 *
 * Its gradient says who holds the floor and its size says how loud they are.
 * The loudness path deliberately avoids React: the audio level is read from a
 * ref each frame and written straight to a CSS custom property, so the whole
 * animation runs on the compositor and never triggers a render.
 */
export function VoiceOrb({ state, className }: VoiceOrbProps) {
  const { levelRef } = useAudioLevel(state);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = orbRef.current;
    if (!node) return;

    let raf = 0;
    let painted = -1;

    const paint = () => {
      const level = levelRef.current;
      // Only touch the DOM when the value actually moved a visible amount.
      if (Math.abs(level - painted) > 0.002) {
        node.style.setProperty("--level", level.toFixed(3));
        painted = level;
      }
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div
      ref={orbRef}
      className={cn("orb", className)}
      data-state={state}
      role="img"
      aria-label={ORB_LABELS[state]}
    >
      <div className="orb-glow" aria-hidden />

      {state === "speaking" && (
        <>
          <span className="orb-ripple" aria-hidden />
          <span className="orb-ripple" aria-hidden />
          <span className="orb-ripple" aria-hidden />
        </>
      )}

      <div className="orb-body">
        <div className="orb-sphere" aria-hidden />
        <div className="orb-highlight" aria-hidden />
      </div>
    </div>
  );
}

const ORB_LABELS: Record<SessionState, string> = {
  idle: "Coach is waiting",
  listening: "Coach is listening to you",
  thinking: "Coach is thinking",
  speaking: "Coach is speaking",
};
