"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { useAudioLevel } from "@/hooks/use-audio-level";
import type { SessionPhase } from "@/lib/session/phase";
import { cn } from "@/lib/utils";

interface VoiceOrbProps {
  state: SessionPhase;
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
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = orbRef.current;
    if (!node) return;

    // Reduced motion: paint the held level once and leave the compositor alone.
    if (reducedMotion) {
      node.style.setProperty("--level", levelRef.current.toFixed(3));
      return;
    }

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
  }, [levelRef, reducedMotion, state]);

  return (
    <div
      ref={orbRef}
      className={cn("orb", className)}
      data-state={state}
      role="img"
      aria-label={ORB_LABELS[state]}
    >
      {/* Glow and rings sit inside the drifting body, not beside it, so the
          whole orb moves as one object. See the note in globals.css. */}
      <div className="orb-body">
        <div className="orb-glow" aria-hidden />

        {state === "speaking" &&
          !reducedMotion &&
          RIPPLE_DELAYS.map((delay) => (
            <span
              key={delay}
              className="orb-ripple"
              style={{ "--ripple-delay": `${delay}s` } as React.CSSProperties}
              aria-hidden
            />
          ))}

        <div className="orb-sphere" aria-hidden />
        <div className="orb-highlight" aria-hidden />
      </div>
    </div>
  );
}

/** Evenly spaced across the 2.6s ripple period, so one is always mid-flight. */
const RIPPLE_DELAYS = [0, 0.85, 1.7];

const ORB_LABELS: Record<SessionPhase, string> = {
  idle: "Coach is waiting",
  listening: "Coach is listening to you",
  thinking: "Coach is thinking",
  speaking: "Coach is speaking",
};
