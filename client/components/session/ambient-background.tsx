import type { SessionState } from "@/lib/mock-data";

/**
 * The wash behind the stage. Purely decorative, and it shifts warmer while the
 * coach holds the floor.
 */
export function AmbientBackground({ state }: { state: SessionState }) {
  return (
    <div className="ambient" data-state={state} aria-hidden>
      <div className="ambient-wash ambient-sky" />
      <div className="ambient-wash ambient-blush" />
      <div className="ambient-wash ambient-lilac" />
      <div className="ambient-wash ambient-glare" />
    </div>
  );
}
