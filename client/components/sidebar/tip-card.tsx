import { Smile } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Async } from "@/lib/api/async";

export function TipCard({
  tip,
  coachName,
}: {
  tip: Async<string>;
  coachName: string;
}) {
  // A tip is a nicety. If it fails there is nothing useful to say about it, so
  // the card leaves rather than apologising in the corner of the sidebar.
  if (tip.status === "error") return null;

  return (
    <section className="surface-panel relative rounded-xl px-3 py-2.5">
      <h2 className="label-eyebrow">Tip from {coachName}</h2>
      {tip.status === "ready" ? (
        <p className="mt-2 pr-6 text-caption leading-snug text-foreground/75">
          {tip.data}
        </p>
      ) : (
        <div className="mt-2 space-y-1.5 pr-6" aria-hidden>
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>
      )}
      <Smile
        className="absolute bottom-2.5 right-3 size-4 text-muted-foreground/45"
        strokeWidth={1.75}
        aria-hidden
      />
    </section>
  );
}
