import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { logger } from "../../core/logger.js";
import { runWithContext } from "../../core/request-context.js";

/** Header carrying the correlation ID, in and out. */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * A UUID, or nothing.
 *
 * An inbound request ID is convenient — a trace started at the edge stays one
 * trace — but it is also attacker-controlled text that ends up in every log
 * line for the request. Accepting it unchecked means accepting newline
 * injection into the log stream, which is how a forged log entry gets written.
 * A strict UUID shape costs nothing and closes it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Open a context for the request and bind a logger to it.
 *
 * Must be the first middleware. Everything downstream — the error handler, the
 * repositories, the provider clients — reaches for `log()` and gets a logger
 * already carrying the request ID, without any of them being passed one.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const inbound = req.get(REQUEST_ID_HEADER);
  const requestId = inbound && UUID.test(inbound) ? inbound : randomUUID();

  // Echoed immediately, not at the end, so it is present even on responses
  // that never reach a handler — a rate-limit rejection, a CORS refusal, a
  // crash. Those are precisely the ones somebody will want to look up.
  res.setHeader(REQUEST_ID_HEADER, requestId);

  runWithContext(
    {
      requestId,
      logger: logger.child({ requestId }),
    },
    () => next(),
  );
}
