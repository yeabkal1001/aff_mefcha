import type { Request } from "express";

/**
 * The route pattern a request matched, as a stable string.
 *
 * Two reasons this is not just `req.path`.
 *
 * The pattern (`/v1/sessions/:id/turns`) is one value; the filled-in path is
 * one value per session. Logging and metrics keyed on the latter produce a
 * cardinality explosion — a dashboard with a million series and no aggregate.
 *
 * And it must include `req.baseUrl`. Express reports `req.route.path` relative
 * to the router's mount point, so two routers each with a `/:id` route report
 * the same pattern. That is merely confusing in a log and actually wrong in the
 * idempotency table, where the endpoint is part of the key: a replay of one
 * endpoint could be served the stored response of another.
 *
 * Falls back to `req.path` when no route matched, which is the 404 case.
 */
export function routePattern(req: Request): string {
  // Express's own types give `req.route` as `any`, so the shape is asserted
  // here, once, rather than at each of the three call sites.
  const route = (req as { route?: { path?: string } }).route;
  return route?.path ? `${req.baseUrl}${route.path}` : req.path;
}
