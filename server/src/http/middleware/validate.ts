import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z, type ZodTypeAny } from "zod";

import { AppError } from "../../core/errors.js";
import { zodIssues } from "./error-handler.js";

/**
 * Schema validation at the edge, and the typed request that comes out of it.
 *
 * The contract: a handler never sees `req.body`, `req.query` or `req.params`.
 * It sees `req.valid`, which is the *parsed* result — coerced, defaulted, and
 * stripped of anything the schema did not name. That last part is the security
 * property. Passing an un-stripped body to a Prisma `update` is mass
 * assignment: a client adds `"role": "ADMIN"` to a profile edit and, with a
 * spread into the update, becomes one.
 */

export interface RequestSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

type Parsed<S extends RequestSchemas> = {
  body: S["body"] extends ZodTypeAny ? z.infer<S["body"]> : undefined;
  query: S["query"] extends ZodTypeAny ? z.infer<S["query"]> : undefined;
  params: S["params"] extends ZodTypeAny ? z.infer<S["params"]> : undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `validate`. Absent on routes that declare no schema. */
      valid?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

/**
 * Validate the parts of a request a route declares, and reject the rest.
 *
 * All three parts are collected before failing, so a client with two mistakes
 * learns about both in one round trip instead of playing whack-a-mole.
 */
export function validate<S extends RequestSchemas>(schemas: S): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues = [];
    const valid: { body?: unknown; query?: unknown; params?: unknown } = {};

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) valid.params = result.data;
      else issues.push(...prefix("params", zodIssues(result.error)));
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) valid.query = result.data;
      else issues.push(...prefix("query", zodIssues(result.error)));
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) valid.body = result.data;
      else issues.push(...prefix("body", zodIssues(result.error)));
    }

    if (issues.length > 0) return next(AppError.validation(issues));

    req.valid = valid;
    next();
  };
}

function prefix(where: string, issues: { path: string; message: string }[]) {
  return issues.map((issue) => ({ ...issue, path: `${where}.${issue.path}` }));
}

/**
 * Read the validated request inside a handler.
 *
 * The cast is contained here rather than repeated at every call site. It is
 * sound as long as the handler is registered behind `validate` with the same
 * schemas, which `route()` in `../route.ts` enforces by construction.
 */
export function validated<S extends RequestSchemas>(req: Request): Parsed<S> {
  return (req.valid ?? {}) as Parsed<S>;
}

// --- shared primitives -----------------------------------------------------

/** Path IDs are UUIDs everywhere except the curriculum, which uses its own. */
export const uuidParam = z.string().uuid("must be a UUID");

/** Curriculum IDs: `G014`, `G014.02`, `EX001`, `university_success`. */
export const slugParam = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.-]+$/, "may only contain letters, digits, dot, dash and underscore");

/**
 * Cursor pagination, not offset.
 *
 * `OFFSET n` makes the database walk and discard n rows, so page 500 costs
 * five hundred pages of work, and a row inserted mid-scroll shifts every
 * subsequent page. A cursor is a constant-time index seek and is stable under
 * concurrent writes. The ceiling on `limit` is what stops a client asking for
 * the entire table in one request.
 */
export const paginationQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;

/**
 * Free text from a learner, bounded and trimmed.
 *
 * Length limits are not cosmetic: an unbounded string is a row that will not
 * fit in a page, a prompt that will not fit in a context window, and a cheap
 * way to make grading expensive. Escaping is deliberately *not* done here —
 * output encoding belongs at the point of output, and pre-escaping means
 * storing `&amp;` and showing it to the learner who typed `&`.
 */
export function text(max: number, min = 1) {
  return z.string().trim().min(min).max(max);
}
