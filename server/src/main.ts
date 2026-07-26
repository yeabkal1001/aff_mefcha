import type { Server } from "node:http";

import { env, isProduction } from "./config/env.js";
import { logger } from "./core/logger.js";
import { createApp } from "./http/app.js";
import { readiness } from "./http/health.routes.js";
import { disconnectDatabase, pingDatabase } from "./infra/db/prisma.js";
import { startBackgroundJobs } from "./jobs/index.js";

/**
 * Process lifecycle: start up in a known-good state, shut down without
 * dropping anything.
 */

async function main() {
  // Fail before accepting traffic rather than on the first request. An instance
  // that starts, gets added to the load balancer and then 500s every request is
  // worse than one that never starts — the platform will keep the old one.
  await pingDatabase();
  logger.info({ env: env.NODE_ENV }, "database reachable");

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "listening");
  });

  // Long enough to outlast a proxy's own idle timeout. When ours is shorter,
  // the proxy reuses a connection we are closing and the client sees a 502 for
  // a request the server never saw.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  const jobs = startBackgroundJobs();

  installShutdown(server, jobs);
  installCrashHandlers();
}

/**
 * Drain, then stop.
 *
 * The sequence matters and each step buys something specific.
 *
 * Readiness goes false first and the process keeps serving. Load balancers
 * remove an instance on a *failed probe*, not on a closed socket, so closing
 * immediately means every request in flight — and every one routed in the
 * second before the balancer notices — becomes a 502. The delay is the
 * balancer's polling interval.
 *
 * Then the listener closes to new connections while existing ones finish, then
 * the database pool is released, and only then does the process exit.
 *
 * The hard timeout exists because a hung request must not stop a deploy. It
 * exits non-zero so that "we killed it" is distinguishable in the logs from
 * "it shut down cleanly".
 */
function installShutdown(server: Server, jobs: { stop: () => void }) {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    // A second SIGTERM during a slow drain must not start a second teardown.
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "shutting down");
    readiness.accepting = false;

    const forceExit = setTimeout(() => {
      logger.error("graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, env.SHUTDOWN_GRACE_MS);
    // Do not hold the loop open purely to wait for our own kill switch.
    forceExit.unref();

    try {
      jobs.stop();

      // Let the balancer see one failed readiness probe before the door shuts.
      if (isProduction) await delay(5_000);

      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info("http server closed");

      await disconnectDatabase();
      logger.info("database pool closed");

      clearTimeout(forceExit);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

/**
 * Crash on an unhandled error, deliberately.
 *
 * After an uncaught exception the process is in an unknown state: a handler was
 * interrupted somewhere arbitrary, and any invariant may be broken. Continuing
 * to serve from it risks writing corrupt data, which is strictly worse than a
 * restart. Log it, then let the platform bring up a fresh one.
 *
 * An unhandled rejection is treated the same way, because Node's default is
 * already to terminate and pretending otherwise just hides the bug.
 */
function installCrashHandlers() {
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    // `flushSync`-style pause: a fatal log lost to a synchronous exit is a
    // crash nobody can diagnose.
    setTimeout(() => process.exit(1), 100).unref();
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandled promise rejection");
    setTimeout(() => process.exit(1), 100).unref();
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.fatal({ err: error }, "failed to start");
  process.exit(1);
});
