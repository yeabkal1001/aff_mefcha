import { cn } from "@/lib/utils";

/**
 * A placeholder the shape of the thing that is coming.
 *
 * Tinted from the foreground rather than given its own grey, so it stays
 * legible against both the light ambient field and the dark one.
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-foreground/[0.07] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
