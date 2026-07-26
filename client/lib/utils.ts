import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Prove a switch covered every case.
 *
 * Reachable only if the union grew and this switch did not, which TypeScript
 * catches at the call site: `value` no longer narrows to `never`. Use it
 * instead of a `default:` branch that quietly returns something plausible —
 * a new stimulus kind should stop the build, not render at 320 pixels.
 */
export function assertNever(value: never, context: string): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
