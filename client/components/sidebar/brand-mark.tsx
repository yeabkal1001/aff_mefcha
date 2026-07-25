import { Briefcase } from "lucide-react";

import { cn } from "@/lib/utils";

/** The dark tile that anchors the sidebar, and the only thing left of it when
 *  the sidebar is collapsed. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-[0.5rem] bg-[oklch(0.21_0.012_265)] text-white",
        className,
      )}
    >
      <Briefcase className="size-3.5" strokeWidth={2} />
    </span>
  );
}
