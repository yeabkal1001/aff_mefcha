import type { Request, RequestHandler, Response } from "express";
import { type z } from "zod";

import type { Learner } from "@prisma/client";

import { currentLearner } from "./middleware/auth.js";
import {
  validate,
  validated,
  type RequestSchemas,
} from "./middleware/validate.js";

/**
 * The route builder.
 *
 * It exists to make one class of mistake impossible: a handler that reads
 * `req.valid` without a `validate` in front of it, and so reads `undefined`
 * where it expected a parsed body. Here the schemas and the handler are given
 * together, the middleware is generated from the schemas, and the handler's
 * input type is *derived* from them — so a schema change that the handler has
 * not caught up with is a compile error rather than a runtime surprise.
 *
 * It also removes the try/catch every async Express handler otherwise needs.
 * Express 5 does forward a rejected promise to the error handler, but only for
 * the exact signature it recognises; wrapping here means that is guaranteed
 * rather than assumed.
 */

export interface HandlerContext<S extends RequestSchemas> {
  body: S["body"] extends z.ZodTypeAny ? z.infer<S["body"]> : undefined;
  query: S["query"] extends z.ZodTypeAny ? z.infer<S["query"]> : undefined;
  params: S["params"] extends z.ZodTypeAny ? z.infer<S["params"]> : undefined;
  /** Present on any route behind `requireAuth`. Throws if it is not. */
  learner: Learner;
  req: Request;
  res: Response;
}

export interface RouteDefinition<S extends RequestSchemas> {
  schemas?: S;
  /**
   * Status for a successful response. Explicit because the difference between
   * 200 and 201 is API surface, and defaulting it is how every creation
   * endpoint ends up returning 200.
   */
  status?: number;
  handler: (context: HandlerContext<S>) => Promise<unknown>;
}

/**
 * Build the middleware chain for one route.
 *
 * Returns an array so it spreads directly into `router.post(path, ...route({…}))`.
 */
export function route<S extends RequestSchemas>(
  definition: RouteDefinition<S>,
): RequestHandler[] {
  const handlers: RequestHandler[] = [];

  if (definition.schemas) handlers.push(validate(definition.schemas));

  handlers.push(async (req, res, next) => {
    try {
      const parsed = validated<S>(req);

      const result = await definition.handler({
        body: parsed.body,
        query: parsed.query,
        params: parsed.params,
        // A getter, so a public route that never touches `learner` does not
        // throw merely for being built by the same helper.
        get learner() {
          return currentLearner(req);
        },
        req,
        res,
      });

      // A handler that has already written the response — a stream, a redirect
      // — returns nothing and is left alone.
      if (res.headersSent) return;

      if (result === undefined) {
        res.status(definition.status ?? 204).end();
        return;
      }

      res.status(definition.status ?? 200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return handlers;
}

/**
 * The envelope for a paginated collection.
 *
 * Consistent across every list endpoint, so a client writes one function to
 * consume all of them. `nextCursor` is null rather than absent at the end of a
 * list: absent is indistinguishable from "the server forgot", and a client
 * looping until the key is missing behaves differently from one looping until
 * it is null.
 */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Slice a page out of an over-fetched result.
 *
 * Fetching `limit + 1` is how "is there another page" is answered without a
 * second `COUNT(*)` over the same predicate, which on a large table costs more
 * than the page itself.
 */
export function paginate<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}
