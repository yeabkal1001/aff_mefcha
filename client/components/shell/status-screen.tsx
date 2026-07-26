import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StatusScreenProps {
  eyebrow: string;
  title: string;
  body: string;
  /** A route to send the learner somewhere useful, not just "go back". */
  action?: { label: string; href: string };
  /** For error boundaries, which recover in place rather than navigating. */
  onRetry?: { label: string; run: () => void };
  className?: string;
}

/**
 * The shared body of every dead end: not found, crashed, offline.
 *
 * One component because these screens are read in the worst moment a learner
 * has with the product, and three hand-written variants is how one of them
 * ends up curt while another apologises twice.
 */
export function StatusScreen({
  eyebrow,
  title,
  body,
  action,
  onRetry,
  className,
}: StatusScreenProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex min-h-dvh flex-1 flex-col items-center justify-center px-6 text-center",
        className,
      )}
    >
      <p className="label-eyebrow">{eyebrow}</p>
      <h1 className="mt-3 max-w-[24rem] text-display-sm font-semibold tracking-tight text-balance">
        {title}
      </h1>
      <p className="mt-3 max-w-[26rem] text-body leading-relaxed text-muted-foreground text-balance">
        {body}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button onClick={onRetry.run} className="rounded-full">
            {onRetry.label}
          </Button>
        )}
        {action && (
          <Button
            asChild
            variant={onRetry ? "outline" : "default"}
            className="rounded-full"
          >
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
