import type { NextFunction, Request, Response } from "express";

import { log } from "../../core/request-context.js";
import { routePattern } from "../route-pattern.js";

/**
 * One line per request, on the way out.
 *
 * On the way out rather than on the way in, because a line logged before the
 * handler runs cannot carry the status or the duration — the two fields anyone
 * actually filters on. Logging both doubles the volume to add nothing.
 *
 * `pino-http` would do this, but it wants to own the request logger, and the
 * logger here is already bound to the correlation ID by `requestContext`. This
 * is fifteen lines and keeps one logger rather than two.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();

  // `finish` fires when the response is fully flushed. `close` catches the
  // client hanging up mid-response, which `finish` misses — and an aborted
  // request that never appears in the log is one that is very hard to explain.
  let logged = false;

  const record = (aborted: boolean) => {
    if (logged) return;
    logged = true;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    // A slow request is worth noticing even when it succeeded, and a 5xx is
    // worth noticing at a level that pages. Errors themselves are logged in
    // full by the error handler; this is the access line.
    const level =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 || durationMs > 2_000 ? "warn" : "info";

    log()[level](
      {
        method: req.method,
        route: routePattern(req),
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        ...(aborted ? { aborted: true } : {}),
      },
      "request",
    );
  };

  res.on("finish", () => record(false));
  res.on("close", () => record(!res.writableEnded));

  next();
}
