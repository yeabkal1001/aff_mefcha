/**
 * The waiting state, shaped like the screen it precedes.
 *
 * A spinner in the middle of an empty page tells the learner nothing about
 * what is coming. A dim orb where the orb is about to be does, and it also
 * means the layout does not jump when the real thing arrives.
 */
export function ScreenLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-8 px-6"
    >
      <div className="orb opacity-40 [--level:0.15]" aria-hidden>
        <div className="orb-glow" />
        <div className="orb-body">
          <div className="orb-sphere" />
          <div className="orb-highlight" />
        </div>
      </div>

      <div className="flex w-full max-w-[22rem] flex-col items-center gap-2.5">
        <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-foreground/[0.07]" />
        <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-foreground/[0.05]" />
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
