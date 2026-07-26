import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { isProduction } from "../../config/env.js";
import { AppError, ErrorCode, toProblem, type FieldIssue } from "../../core/errors.js";
import { getContext, log } from "../../core/request-context.js";
import { translatePrismaError } from "../../infra/db/prisma.js";
import { routePattern } from "../route-pattern.js";

/**
 * The only place this API writes an error response.
 *
 * Every route delegates here by throwing. The value of a single exit is that
 * the rules below — what gets logged at what level, what a client is allowed
 * to see, what shape it arrives in — are stated once and cannot be forgotten
 * in the one handler nobody reviewed.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Express cannot take over a response that has already started streaming;
  // the only correct move is to destroy the socket so the client sees a
  // truncated body rather than valid-looking but incomplete JSON.
  if (res.headersSent) {
    log().error({ err: error }, "error after response started; destroying socket");
    return next(error);
  }

  const normalised = normalise(error);
  const requestId = getContext()?.requestId ?? "unknown";
  const problem = toProblem(normalised, requestId);

  // 4xx is the caller's problem and is noise at error level; 5xx is ours and
  // should page someone. Splitting on status rather than a hand-set flag means
  // a new error type cannot arrive silently un-alertable.
  const level = problem.status >= 500 ? "error" : "warn";

  log()[level](
    {
      err: normalised,
      status: problem.status,
      code: problem.code,
      method: req.method,
      // The pattern, not the filled-in URL, so this groups in a dashboard
      // instead of producing one series per ID.
      path: routePattern(req),
      ...(normalised instanceof AppError ? normalised.context : {}),
    },
    problem.message,
  );

  if (normalised instanceof AppError && normalised.retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(normalised.retryAfterSeconds));
  }

  res
    .status(problem.status)
    .type("application/problem+json")
    .json({
      ...problem,
      // The stack is a development affordance and a production disclosure. It
      // names file paths, dependency versions and internal structure.
      ...(isProduction ? {} : { stack: stackOf(normalised) }),
    });
}

/**
 * Coerce anything throwable into an `AppError`.
 *
 * Order matters: Prisma first because its errors are the most common non-App
 * throwable and carry real meaning, Zod next because a schema failure is a
 * 400 with useful field detail, then the body-parser cases, and finally the
 * catch-all that deliberately discards detail.
 */
function normalise(error: unknown): unknown {
  const translated = translatePrismaError(error);
  if (translated instanceof AppError) return translated;

  if (translated instanceof ZodError) {
    return AppError.validation(zodIssues(translated), { cause: translated });
  }

  // `express.json()` throws these. Without special-casing, a client sending
  // malformed JSON gets a 500 and we get paged for their typo.
  if (isBodyParserError(translated)) {
    const { type, status } = translated;

    if (type === "entity.too.large") {
      return new AppError(
        413,
        ErrorCode.PAYLOAD_TOO_LARGE,
        "That request was too large.",
        { cause: translated },
      );
    }
    if (type === "entity.parse.failed") {
      return AppError.badRequest("That request body wasn't valid JSON.", {
        cause: translated,
      });
    }
    if (type === "encoding.unsupported" || status === 415) {
      return new AppError(
        415,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
        "This endpoint expects application/json.",
        { cause: translated },
      );
    }
  }

  return translated;
}

/** Zod's issue list, flattened into the wire shape. */
export function zodIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

interface BodyParserError {
  type: string;
  status?: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error).type === "string"
  );
}

function stackOf(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

/**
 * Anything that reaches the end of the router matched no route.
 *
 * Registered after every route and before the error handler, so a 404 is
 * produced by the same machinery as every other failure and comes back in the
 * same problem+json shape rather than Express's HTML default.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(
    AppError.notFound("That endpoint", {
      context: { method: req.method, path: req.path },
    }),
  );
}
