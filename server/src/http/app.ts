import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, { type Express, Router } from "express";
import helmet from "helmet";

import { env } from "../config/env.js";
import { AppError } from "../core/errors.js";
import { historyRouter } from "../modules/history/history.routes.js";
import { learnerRouter } from "../modules/learners/learner.routes.js";
import { practiceRouter } from "../modules/sessions/session.routes.js";
import { speechRouter } from "../modules/speech/speech.routes.js";
import { clerkWebhookRouter } from "../modules/webhooks/clerk.routes.js";
import { healthRouter } from "./health.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { requestContext } from "./middleware/request-context.js";
import { requestLogger } from "./middleware/request-logger.js";

/**
 * The application, assembled.
 *
 * Built by a function rather than at module scope so tests can construct one
 * without starting a listener, and so the order below is explicit rather than
 * an accident of import order. Middleware order is the substance of this file:
 * almost every mistake available here is an ordering mistake.
 */
export function createApp(): Express {
  const app = express();

  // Exactly as many proxies as are really in front of us. Too low and every
  // client shares the load balancer's address, so one abuser rate-limits the
  // world; too high and a client spoofs `X-Forwarded-For` for a fresh bucket
  // per request. `true` would be both.
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  // Nothing about the stack in the response headers.
  app.disable("x-powered-by");

  // First, so every later line — including a rejection by CORS or the rate
  // limiter — carries a request ID.
  app.use(requestContext);

  app.use(
    helmet({
      // This is a JSON API. It serves no HTML, so the sensible policy is to
      // forbid everything rather than to enumerate what is allowed.
      contentSecurityPolicy: {
        directives: { "default-src": ["'none'"], "frame-ancestors": ["'none'"] },
      },
      // Browsers must not sniff a JSON error body as HTML and run it.
      xContentTypeOptions: true,
      // Referrer to a third party would leak our path structure.
      referrerPolicy: { policy: "no-referrer" },
      // A year, with preload. The API is HTTPS-only in production.
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(
    cors({
      // A function, not a list, so a disallowed origin is a *refusal* rather
      // than a reflected header. `origin: true` echoes whatever is asked for,
      // which with credentials on defeats the entire point of CORS.
      origin(origin, callback) {
        // Same-origin, curl, and server-to-server requests send no Origin.
        // Rejecting those would break the health check and every integration.
        if (!origin) return callback(null, true);

        if (env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        callback(new AppError(403, "forbidden", "Origin not allowed."));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
      // So a browser can read the correlation ID and the rate-limit budget.
      exposedHeaders: ["X-Request-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
      maxAge: 86_400,
    }),
  );

  // Before the body parser: the signature covers raw bytes, and a parsed body
  // re-serialised is not the same bytes. Mounted here rather than inside the
  // versioned router for the same reason — nothing may touch the body first.
  app.use("/v1/webhooks", clerkWebhookRouter);

  app.use(
    express.json({
      // A transcript is a few kilobytes. Audio goes to `/speech/transcribe`,
      // which takes a raw body with its own limit. Anything approaching this
      // on a JSON endpoint is a mistake or an attack.
      limit: "256kb",
      // Reject a wrong content type outright rather than parsing helpfully.
      type: "application/json",
    }),
  );

  // Health checks are exempt from logging and rate limiting: the platform hits
  // them every few seconds, so logging them buries everything else and
  // counting them consumes the budget of whoever shares their address.
  app.use(healthRouter);

  app.use(requestLogger);

  app.use(
    rateLimit({
      bucket: "general",
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
    }),
  );

  // Populates the auth context from the bearer token. Verification is offline
  // against Clerk's JWKS — no network call per request, no shared session
  // store, which is what makes this horizontally scalable. It does not reject
  // anonymous requests; `requireAuth` does that, per route.
  app.use(clerkMiddleware());

  app.use("/v1", v1());

  app.use(notFoundHandler);
  // Last, always. Express identifies the error handler by its arity, and
  // anything registered after it never runs.
  app.use(errorHandler);

  return app;
}

/**
 * Version 1 of the API.
 *
 * Versioned in the path from the first commit. Adding a version to an API that
 * shipped without one means every existing client breaks on the day you need
 * to change something, which is the day you least want to be doing it.
 */
function v1(): Router {
  const router = Router();

  router.use("/me", learnerRouter);
  router.use("/history", historyRouter);
  router.use("/speech", speechRouter);
  // Mounted at the root of /v1 because it owns several sibling nouns —
  // `/today`, `/sessions`, `/turns` — which belong to one bounded context.
  router.use("/", practiceRouter);

  return router;
}
