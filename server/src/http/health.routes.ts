import { Router } from "express";

import { pingDatabase } from "../infra/db/prisma.js";
import { log } from "../core/request-context.js";

/**
 * Liveness and readiness, which are different questions with different answers.
 *
 * **Liveness** asks "is this process wedged". It must not touch a dependency:
 * if a database outage fails the liveness probe, the orchestrator restarts
 * every instance, none of them come back — the database is still down — and a
 * dependency's outage has been amplified into a full one of ours.
 *
 * **Readiness** asks "can this instance serve traffic". It checks the database,
 * because an instance that cannot reach Postgres should be taken out of the
 * load balancer rather than serving 500s.
 *
 * Neither requires authentication, so neither returns anything worth having.
 * Versions, dependency names and error details are all omitted deliberately —
 * an unauthenticated endpoint that enumerates your stack is free
 * reconnaissance.
 */
export const healthRouter: Router = Router();

const startedAt = Date.now();

/** Liveness. Touches nothing. */
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
});

/** Readiness. Checks what this instance needs to do its job. */
healthRouter.get("/ready", async (_req, res) => {
  // Draining takes precedence over every other check, and skips them. Once
  // SIGTERM has arrived the answer is "stop routing to me" regardless of how
  // healthy the database is, and spending a round trip to confirm that only
  // slows the drain down.
  if (!readiness.accepting) {
    res.status(503).json({ status: "draining", checks: {} });
    return;
  }

  const checks: Record<string, "ok" | "failing"> = {};

  try {
    await pingDatabase();
    checks.database = "ok";
  } catch (error) {
    checks.database = "failing";
    // Logged in full here; the response says only "failing".
    log().error({ err: error }, "readiness check failed: database");
  }

  const ready = Object.values(checks).every((status) => status === "ok");

  // 503 rather than 200-with-a-flag: load balancers read the status code, and
  // a body nobody parses is a health check that never removes an instance.
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
});

/**
 * Set false by the shutdown handler.
 *
 * Once SIGTERM arrives this instance keeps serving in-flight requests but stops
 * advertising itself as ready, so the load balancer drains it before the socket
 * closes. Without the gap, every request in flight at shutdown becomes a 502.
 */
export const readiness = { accepting: true };
