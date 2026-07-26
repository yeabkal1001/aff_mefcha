import { logger } from "../core/logger.js";
import { sweepIdempotencyKeys } from "../http/middleware/idempotency.js";
import { sweepRateLimitCounters } from "../http/middleware/rate-limit.js";
import { learnerRepository } from "../modules/learners/learner.repository.js";

/**
 * Housekeeping that has to happen but must not happen in a request.
 *
 * In-process timers rather than a separate worker, because at this size a
 * worker is a second thing to deploy, monitor and pay for in order to run three
 * `DELETE`s. The trade-off is stated rather than assumed: with several
 * instances every one of them runs these, so each job has to be safe to run
 * concurrently. All three are — they are idempotent deletes over a time
 * predicate, and losing the race just means deleting nothing.
 *
 * The upgrade path when this stops being true is Render's cron job type, which
 * runs a one-shot process on a schedule. Nothing here would need rewriting.
 */

const HOUR_MS = 60 * 60 * 1000;

/** How long a deleted account is recoverable before it is really gone. */
const DELETION_GRACE_DAYS = 30;

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const jobs: Job[] = [
  {
    name: "sweep-rate-limit-counters",
    intervalMs: HOUR_MS,
    async run() {
      const deleted = await sweepRateLimitCounters();
      if (deleted > 0) logger.debug({ deleted }, "swept rate limit counters");
    },
  },
  {
    name: "sweep-idempotency-keys",
    intervalMs: 6 * HOUR_MS,
    async run() {
      const deleted = await sweepIdempotencyKeys();
      if (deleted > 0) logger.debug({ deleted }, "swept idempotency keys");
    },
  },
  {
    /**
     * The job that makes deletion real.
     *
     * Everything the learner owns cascades from this one delete, which is why
     * the foreign keys are declared `onDelete: Cascade` rather than being torn
     * down by hand here — a hand-written teardown is one that misses a table,
     * and the table it misses is the one holding transcripts.
     */
    name: "purge-deleted-learners",
    intervalMs: 24 * HOUR_MS,
    async run() {
      const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * HOUR_MS);
      const purged = await learnerRepository.purgeDeletedBefore(cutoff);
      if (purged > 0) logger.warn({ purged, cutoff }, "purged deleted learners");
    },
  },
];

export function startBackgroundJobs(): { stop: () => void } {
  const timers = jobs.map((job) => {
    const tick = () => {
      // Never let a job's failure escape: an unhandled rejection in a timer
      // takes the whole process down, and losing an API instance because a
      // cleanup delete failed is a spectacularly bad trade.
      void job.run().catch((error) => {
        logger.error({ err: error, job: job.name }, "background job failed");
      });
    };

    const timer = setInterval(tick, job.intervalMs);
    // Must not hold the event loop open during shutdown.
    timer.unref();
    return timer;
  });

  logger.info({ jobs: jobs.map((job) => job.name) }, "background jobs started");

  return {
    stop() {
      timers.forEach(clearInterval);
      logger.info("background jobs stopped");
    },
  };
}
