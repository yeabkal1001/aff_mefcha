import { setTimeout as delay } from "node:timers/promises";

import { AppError } from "./errors.js";
import { log } from "./request-context.js";

/**
 * Timeouts, retries and a circuit breaker for calls that leave this process.
 *
 * Every model provider is a network dependency that will, on a long enough
 * timeline, hang rather than fail. A hung call is worse than a failed one: it
 * holds a request open, a connection open, and a learner staring at an orb. So
 * nothing calls a provider directly — it goes through `guard`, which enforces
 * all three in the order that matters.
 */

export class TimeoutError extends Error {
  constructor(readonly ms: number) {
    super(`Timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Race a promise against the clock, cancelling the work when we give up.
 *
 * The `AbortSignal` is the point. A bare `Promise.race` leaves the losing
 * request running: the socket stays open, the provider still bills for it, and
 * under load the process accumulates exactly the work it decided to abandon.
 */
export async function withTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError(ms);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface RetryOptions {
  attempts: number;
  /** Delay before the first retry. Each subsequent one doubles. */
  baseDelayMs: number;
  maxDelayMs: number;
  /**
   * Whether this failure is worth trying again.
   *
   * Defaults to "no", because retrying by default is how a validation error
   * becomes three validation errors and a rejected 400 becomes triple the
   * provider spend. Only the caller knows which of its failures are transient.
   */
  isRetryable: (error: unknown) => boolean;
}

/**
 * Retry with exponential backoff and full jitter.
 *
 * Jitter is not a refinement. Without it, every request that fails during a
 * provider blip retries at the same three moments, and the recovering provider
 * is hit by the entire backlog simultaneously — the outage extends itself. Full
 * jitter (a uniform draw from `[0, backoff]`, not `backoff ± noise`) is the
 * variant that actually spreads the load.
 */
export async function withRetry<T>(
  options: RetryOptions,
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isLast = attempt === options.attempts;
      if (isLast || !options.isRetryable(error)) throw error;

      const backoff = Math.min(
        options.maxDelayMs,
        options.baseDelayMs * 2 ** (attempt - 1),
      );
      const wait = Math.round(Math.random() * backoff);

      log().warn(
        { attempt, of: options.attempts, waitMs: wait, err: error },
        "retrying after upstream failure",
      );
      await delay(wait);
    }
  }

  throw lastError;
}

type BreakerState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  name: string;
  /** Consecutive failures before the breaker opens. */
  threshold: number;
  /** How long to stay open before allowing one probe through. */
  resetMs: number;
}

/**
 * A circuit breaker, per provider.
 *
 * The failure it prevents is specific: when a provider is down, every request
 * still pays the full timeout before failing. At any real request rate that
 * means the whole pool is parked in `withTimeout` waiting on something already
 * known to be broken, and an outage at a *dependency* becomes an outage of
 * *ours*. Once the breaker is open, calls fail in microseconds instead of
 * seconds, which keeps the rest of the API — history, profile, settings, none
 * of which need the provider — responsive.
 *
 * State lives per process. With several instances that means each learns the
 * outage independently, which is acceptable: they converge within one
 * threshold's worth of requests, and the alternative is shared state on the
 * hot path of every provider call.
 */
export class CircuitBreaker {
  private state: BreakerState = "closed";
  private failures = 0;
  private openedAt = 0;
  /** Set while a half-open probe is in flight, so only one is ever allowed. */
  private probing = false;

  constructor(private readonly options: BreakerOptions) {}

  get isOpen() {
    return this.state === "open";
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt < this.options.resetMs) {
        throw AppError.upstream(this.options.name, {
          context: { breaker: "open", failures: this.failures },
        });
      }
      this.state = "half-open";
      this.probing = false;
    }

    // Exactly one request gets to find out whether the provider is back. The
    // rest keep failing fast, or a recovering provider is stampeded the instant
    // the reset window elapses.
    if (this.state === "half-open") {
      if (this.probing) {
        throw AppError.upstream(this.options.name, {
          context: { breaker: "half-open", reason: "probe in flight" },
        });
      }
      this.probing = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state !== "closed") {
      log().info({ breaker: this.options.name }, "circuit closed, upstream recovered");
    }
    this.state = "closed";
    this.failures = 0;
    this.probing = false;
  }

  private onFailure() {
    this.failures += 1;
    this.probing = false;

    // A failed probe re-opens immediately rather than counting toward the
    // threshold again — one failure while half-open is already proof.
    if (this.state === "half-open" || this.failures >= this.options.threshold) {
      if (this.state !== "open") {
        log().error(
          { breaker: this.options.name, failures: this.failures },
          "circuit opened, shedding calls to upstream",
        );
      }
      this.state = "open";
      this.openedAt = Date.now();
    }
  }

  /** Test seam. Never called in production code. */
  reset() {
    this.state = "closed";
    this.failures = 0;
    this.probing = false;
  }
}

export interface GuardOptions {
  provider: string;
  timeoutMs: number;
  retry?: Omit<RetryOptions, "isRetryable"> & { isRetryable?: (error: unknown) => boolean };
  breaker: CircuitBreaker;
}

/**
 * The single entry point for an outbound provider call.
 *
 * Ordering is the substance here, and it is breaker → retry → timeout, reading
 * outward. The timeout is innermost so it bounds each individual attempt rather
 * than the whole sequence; retry sits inside the breaker so a burst of retries
 * counts as the several failures it is; and the breaker is outermost so an open
 * circuit costs nothing at all.
 */
export async function guard<T>(
  options: GuardOptions,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const attempt = () => withTimeout(options.timeoutMs, fn);

  return options.breaker.run(async () => {
    if (!options.retry) return attempt();

    return withRetry(
      { ...options.retry, isRetryable: options.retry.isRetryable ?? isTransient },
      attempt,
    );
  });
}

/**
 * Whether a provider failure is worth another attempt.
 *
 * Retryable: we never got an answer (timeout, socket reset), the provider said
 * it is overloaded (429), or it failed on its own side (5xx). Not retryable:
 * anything in the 4xx range other than 429, which means the request itself is
 * wrong and will be exactly as wrong next time.
 */
export function isTransient(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;

  const status = (error as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status >= 500;

  const code = (error as { code?: string })?.code;
  return (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN" ||
    code === "UND_ERR_SOCKET"
  );
}
