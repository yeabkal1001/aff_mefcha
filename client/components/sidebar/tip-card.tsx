import { Smile } from "lucide-react";

import { coachName } from "@/lib/mock-data";

export function TipCard({ tip }: { tip: string }) {
  return (
    <section className="surface-panel relative rounded-xl px-2.5 py-2">
      <h2 className="label-eyebrow">Tip from {coachName}</h2>
      <p className="mt-1.5 pr-5 text-[0.6875rem] leading-snug text-foreground/75">
        {tip}
      </p>
      <Smile
        className="absolute bottom-2 right-2.5 size-3.5 text-muted-foreground/45"
        strokeWidth={1.75}
      />
    </section>
  );
}
