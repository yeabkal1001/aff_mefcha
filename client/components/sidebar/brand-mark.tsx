import { Briefcase } from "lucide-react";

import { cn } from "@/lib/utils";

/** The dark tile that anchors the sidebar, and the only thing left of it when
 *  the sidebar is collapsed. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md bg-brand-mark text-brand-mark-foreground",
        className,
      )}
    >
      <Briefcase className="size-4" strokeWidth={2} />
    </span>
  );
}
