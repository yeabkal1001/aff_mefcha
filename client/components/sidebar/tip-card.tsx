import { Smile } from "lucide-react";

import { coachName } from "@/lib/mock-data";

export function TipCard({ tip }: { tip: string }) {
  return (
    <section className="surface-panel relative rounded-xl px-3 py-2.5">
      <h2 className="label-eyebrow">Tip from {coachName}</h2>
      <p className="mt-2 pr-6 text-[0.75rem] leading-snug text-foreground/75">
        {tip}
      </p>
      <Smile
        className="absolute bottom-2.5 right-3 size-4 text-muted-foreground/45"
        strokeWidth={1.75}
      />
    </section>
  );
}
