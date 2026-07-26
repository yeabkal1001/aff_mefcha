import { createHash } from "node:crypto";

import type { RequestHandler } from "express";

import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import { prisma } from "../../infra/db/prisma.js";
import { routePattern } from "../route-pattern.js";
import { currentLearner } from "./auth.js";

/**
 * Make a retried write indistinguishable from the original.
 *
 * The concrete failure: a learner on a bad connection posts a turn, the
 * response is lost, the client retries. Without this they get two turns, two
 * gradings, two mastery updates and two provider bills from one utterance —
 * and the learner model is now wrong in a way nothing will ever correct.
 *
 * Opt-in per route rather than blanket, because it only makes sense on
 * non-idempotent writes. `PUT /profile` is naturally idempotent and needs
 * nothing; `POST /turns` is not and needs this.
 */

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** Keys are retained long enough to cover any plausible retry, and no longer. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Replay a stored response, or record the one about to be produced.
 *
 * Requires authentication in front of it: keys are scoped per learner, so one
 * learner cannot collide with — or read back — another's stored response.
 */
export const idempotent: RequestHandler = async (req, res, next) => {
  const key = req.get(IDEMPOTENCY_HEADER);
  if (!key) return next();

  if (key.length < 8 || key.length > 200) {
    return next(
      AppError.badRequest("Idempotency-Key must be between 8 and 200 characters."),
    );
  }

  try {
    const learner = currentLearner(req);
    const endpoint = `${req.method} ${routePattern(req)}`;
    // Binding the key to the body is what stops a client reusing one key for
    // two different requests — which would otherwise silently return the first
    // request's response to the second, a very hard bug to see from outside.
    const requestHash = createHash("sha256")
      .update(JSON.stringify(req.body ?? null))
      .digest("hex");

    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

    if (existing) {
      if (existing.learnerId !== learner.id) {
        // Someone else's key. Same message as a mismatch, so this cannot be
        // used to probe which keys exist.
        throw AppError.conflict("That Idempotency-Key has already been used.");
      }
      if (existing.endpoint !== endpoint || existing.requestHash !== requestHash) {
        throw AppError.conflict(
          "That Idempotency-Key was already used for a different request.",
        );
      }

      log().info({ key }, "replaying idempotent response");
      res.setHeader("Idempotent-Replay", "true");
      return res.status(existing.statusCode).json(existing.response);
    }

    // Capture the response as it is sent rather than asking the handler to
    // report it. Wrapping `json` keeps this transparent: no route knows it is
    // behind an idempotency layer.
    const send = res.json.bind(res);

    res.json = (body: unknown) => {
      // Only successful writes are worth replaying. Storing a 4xx would pin a
      // client to its own earlier mistake even after it fixed the request.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void prisma.idempotencyKey
          .create({
            data: {
              key,
              learnerId: learner.id,
              endpoint,
              requestHash,
              statusCode: res.statusCode,
              response: body as never,
              expiresAt: new Date(Date.now() + RETENTION_MS),
            },
          })
          // A lost race means another copy of this request stored it first,
          // which is the outcome we wanted anyway.
          .catch((error) => log().warn({ err: error, key }, "could not store idempotency key"));
      }

      return send(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};

/** Drop keys past their retention window. Run from the cleanup job. */
export async function sweepIdempotencyKeys(): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
