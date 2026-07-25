"use client";

import { useEffect, useRef, type RefObject } from "react";

const BARS = 21;

/**
 * A live loudness meter driven straight from the audio ref.
 *
 * Like the orb, it writes to the DOM inside its own animation frame rather
 * than re-rendering, and it shapes the bars with a centre-weighted curve so
 * the whole row moves as one body instead of a flat block.
 */
export function MicMeter({ levelRef }: { levelRef: RefObject<number> }) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const bars = Array.from(row.children) as HTMLElement[];
    let raf = 0;

    const paint = () => {
      const level = levelRef.current;
      const now = performance.now() / 1000;

      bars.forEach((bar, i) => {
        // Taller in the middle, and each bar lags its neighbour slightly.
        const centre = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const shimmer = 0.75 + 0.25 * Math.sin(now * 7 + i * 0.55);
        const scale = 0.08 + level * (0.35 + 0.65 * centre) * shimmer;
        bar.style.transform = `scaleY(${Math.max(0.08, Math.min(1, scale))})`;
      });

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  return (
    <div
      ref={rowRef}
      aria-hidden
      className="flex h-12 items-center justify-center gap-[3px]"
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-center rounded-full bg-foreground/45"
          style={{ transform: "scaleY(0.08)" }}
        />
      ))}
    </div>
  );
}
