import { AsyncLocalStorage } from "node:async_hooks";

import type { Logger } from "./logger.js";
import { logger as rootLogger } from "./logger.js";

/**
 * The ambient facts about the request currently being served.
 *
 * Carried in `AsyncLocalStorage` rather than threaded through every signature.
 * The alternative is passing a context object into every service, repository
 * and provider call purely so the bottom of the stack can log a request ID —
 * which couples every layer to HTTP for no benefit and is abandoned the first
 * time somebody is in a hurry.
 *
 * What goes in here is strictly identity and tracing. Business state does not:
 * a service that reads its inputs from ambient storage cannot be tested or
 * reasoned about, and the temptation to grow this into a request-scoped grab
 * bag is the failure mode to watch for.
 */
export interface RequestContext {
  /** Correlation ID. Echoed to the client and stamped on every log line. */
  requestId: string;
  /** Clerk's user ID, once authenticated. */
  userId?: string;
  /** Our own learner ID, once resolved. Distinct from `userId` on purpose. */
  learnerId?: string;
  /** A child logger already bound to the fields above. */
  logger: Logger;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/**
 * The current request's logger, or the root logger outside a request.
 *
 * Background jobs and startup code legitimately have no request, so this
 * degrades rather than throwing — a missing correlation ID is not worth losing
 * the log line over.
 */
export function log(): Logger {
  return storage.getStore()?.logger ?? rootLogger;
}

/**
 * Attach identity to the context once authentication has resolved it.
 *
 * Mutates in place so that log lines emitted *before* the learner was resolved
 * and after it share one context object. Rebinding the child logger here is
 * what makes every subsequent line carry `learnerId` without any call site
 * knowing it exists.
 */
export function identify(identity: { userId?: string; learnerId?: string }) {
  const context = storage.getStore();
  if (!context) return;

  if (identity.userId) context.userId = identity.userId;
  if (identity.learnerId) context.learnerId = identity.learnerId;

  context.logger = context.logger.child({
    ...(context.userId ? { userId: context.userId } : {}),
    ...(context.learnerId ? { learnerId: context.learnerId } : {}),
  });
}
