import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0..1. */
  value: number;
  size?: number;
  className?: string;
  /**
   * What the ring is measuring. The percentage inside it is meaningless on
   * its own to a screen reader, so the ring carries the whole sentence and
   * the digits are hidden.
   */
  label: string;
}

export function ProgressRing({
  value,
  size = 38,
  className,
  label,
}: ProgressRingProps) {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="text-foreground transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center text-micro font-semibold tabular-nums text-foreground"
      >
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}
