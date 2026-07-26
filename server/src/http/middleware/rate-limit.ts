import { createHash } from "node:crypto";

import type { Request, RequestHandler } from "express";

import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import { prisma } from "../../infra/db/prisma.js";

/**
 * Rate limiting, shared across instances.
 *
 * The counter lives in Postgres rather than in process memory because a
 * per-process counter is not a limit: run three instances and the real ceiling
 * is silently three times what the configuration says, which is the opposite
 * of the guarantee. Redis is the better home for this and is the documented
 * upgrade path; Postgres needs no new infrastructure and the write is one
 * upsert on a primary key.
 *
 * The window is fixed rather than sliding. A fixed window admits up to twice
 * the limit across a boundary, which is a real but bounded imprecision, and it
 * costs one row and one statement per request. A sliding window costs a sorted
 * set per principal and is not worth it to stop a burst that is already inside
 * an order of magnitude of the intended rate.
 */

export interface RateLimitOptions {
  /** Namespace, so the general and AI budgets do not share a counter. */
  bucket: string;
  windowMs: number;
  max: number;
  /**
   * Whether this request should not count.
   *
   * Used to exempt health checks, which are hit continuously by the platform
   * and would otherwise consume the limit for whatever shares their IP.
   */
  skip?: (req: Request) => boolean;
}

/**
 * Who is being limited.
 *
 * The learner ID when we know it, because that is the actual principal and it
 * follows them across networks. Falling back to the IP is worse in both
 * directions — a university NAT shares one address between hundreds of
 * learners, and a determined abuser changes address — but there is nothing
 * better for an unauthenticated request.
 *
 * The IP is hashed before it becomes a key. It is personal data, the key ends
 * up in a database row and in log lines, and the limiter only ever needs to
 * compare it for equality.
 */
function principalOf(req: Request): string {
  if (req.learner) return `learner:${req.learner.id}`;

  const ip = req.ip ?? "unknown";
  return `ip:${createHash("sha256").update(ip).digest("base64url").slice(0, 22)}`;
}

/**
 * Consume one unit from a principal's window.
 *
 * A single statement: the upsert both resets an expired window and increments a
 * live one. Doing it as read-then-write would let two concurrent requests both
 * read the same count and both be admitted, which at high concurrency is
 * exactly when the limit matters.
 */
async function consume(
  key: string,
  windowMs: number,
): Promise<{ count: number; resetAt: Date }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  // The window start is part of the key, so a new window is a new row and the
  // old one simply expires. No reset logic, and no race in the reset.
  const windowKey = `${key}:${windowStart}`;

  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limit_counter (key, count, expires_at)
    VALUES (${windowKey}, 1, ${resetAt})
    ON CONFLICT (key) DO UPDATE SET count = rate_limit_counter.count + 1
    RETURNING count
  `;

  return { count: row?.count ?? 1, resetAt };
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    if (options.skip?.(req)) return next();

    const key = `${options.bucket}:${principalOf(req)}`;

    try {
      const { count, resetAt } = await consume(key, options.windowMs);
      const remaining = Math.max(0, options.max - count);

      // The IETF draft header set. Clients that respect it back off on their
      // own, which is worth more than any amount of server-side rejection.
      res.setHeader("RateLimit-Limit", String(options.max));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)));

      if (count > options.max) {
        const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
        log().warn({ bucket: options.bucket, count, max: options.max }, "rate limited");
        return next(AppError.rateLimited(retryAfter));
      }

      next();
    } catch (error) {
      // Fail open, loudly.
      //
      // A limiter that fails closed turns a database blip into a total outage,
      // and the limiter is not the thing protecting correctness — validation
      // and authorization are, and they are still running. The warning is what
      // stops this being silent: a limiter that has been failing open for a
      // week is a limiter that is not there.
      log().error({ err: error, bucket: options.bucket }, "rate limiter unavailable; allowing");
      next();
    }
  };
}

/**
 * Drop counters for windows that have closed.
 *
 * Rows are never updated after their window ends, so this only ever deletes
 * dead weight. Without it the table grows by one row per principal per window,
 * forever.
 */
export async function sweepRateLimitCounters(): Promise<number> {
  const { count } = await prisma.rateLimitCounter.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
