import { getAuth } from "@clerk/express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Role, type Learner } from "@prisma/client";

import { AppError } from "../../core/errors.js";
import { identify, log } from "../../core/request-context.js";
import { learnerRepository } from "../../modules/learners/learner.repository.js";

/**
 * Who is calling, and what they are allowed to do.
 *
 * Two separate questions, deliberately two separate middlewares. Conflating
 * them produces the classic bug where a route that only checked "is signed in"
 * is assumed to have checked "is allowed", and every learner can read every
 * other learner's sessions by changing an ID.
 *
 * Authentication is Clerk's. Tokens are verified offline against their JWKS by
 * `clerkMiddleware`, which means no network call per request and no shared
 * session store — the property that makes this horizontally scalable.
 * Authorization is entirely ours, because Clerk knows nothing about learners.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireAuth`. Absent on public routes. */
      learner?: Learner;
    }
  }
}

/**
 * Require a signed-in learner, and put them on the request.
 *
 * Also provisions on first sight. A learner can be authenticated by Clerk
 * before we have ever seen them — they signed up seconds ago, or the webhook
 * has not landed yet — and failing that request would make signup racy in a
 * way that shows up as an intermittent error on the very first screen. The
 * upsert is keyed on Clerk's user ID, so a webhook arriving afterwards
 * reconciles rather than duplicating.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      // No detail about *why*. "Expired" versus "malformed" versus "no such
      // user" is information about our token handling that a caller without a
      // valid token has no business learning.
      throw AppError.unauthenticated();
    }

    identify({ userId: auth.userId });

    const learner = await learnerRepository.findOrCreateByClerkId(auth.userId);

    if (learner.deletedAt) {
      throw AppError.unauthenticated("This account has been closed.");
    }
    if (learner.status === "SUSPENDED") {
      throw AppError.forbidden("This account is suspended.");
    }

    identify({ learnerId: learner.id });
    req.learner = learner;

    next();
  } catch (error) {
    next(error);
  }
};

/** The learner on the request, or a programming error if there is none. */
export function currentLearner(req: Request): Learner {
  if (!req.learner) {
    // Not an auth failure — a route wired without `requireAuth` in front of a
    // handler that assumes it. Surfacing it as a 500 is correct: it is our bug,
    // and reporting it as a 401 would hide the misconfiguration behind a
    // plausible-looking response.
    throw AppError.internal("Handler requires authentication but none ran.", {
      context: { path: req.path },
    });
  }
  return req.learner;
}

/**
 * Restrict a route to a set of roles.
 *
 * Coarse by design. Ownership — "is this *your* session" — is not a role
 * question and is checked per resource by the services, which are the only
 * layer that knows what owns what.
 */
export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const learner = currentLearner(req);

      if (!allowed.includes(learner.role)) {
        log().warn(
          { required: allowed, actual: learner.role, path: req.path },
          "role check failed",
        );
        throw AppError.forbidden();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Assert that a resource belongs to the caller.
 *
 * The single check every per-resource route runs. `ADMIN` and `SUPPORT` pass
 * regardless, which is the whole reason those roles exist; everyone else must
 * own the row.
 *
 * The failure is a 403 with the same message as "not allowed", never a 404.
 * Returning 404 for someone else's resource and 403 for your own turns the
 * endpoint into an existence oracle — walk IDs, watch the status code, and you
 * have enumerated the table.
 */
export function assertOwnership(learner: Learner, ownerId: string): void {
  if (learner.id === ownerId) return;
  if (learner.role === Role.ADMIN || learner.role === Role.SUPPORT) return;

  log().warn(
    { learnerId: learner.id, ownerId },
    "ownership check failed",
  );
  throw AppError.forbidden();
}

/**
 * Reject writes from read-only principals.
 *
 * `SUPPORT` exists to look at a learner's data while helping them, not to
 * change it. Without this, "can read any learner" quietly means "can edit any
 * learner", which is the privilege escalation nobody notices until it is used.
 */
export function assertCanWrite(learner: Learner): void {
  if (learner.role === Role.SUPPORT) {
    throw AppError.forbidden("Support accounts have read-only access.");
  }
}

/**
 * Attach the learner when there is one, and carry on when there is not.
 *
 * For endpoints whose response differs for a signed-in caller but which do not
 * require one.
 */
export const optionalAuth: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return next();

    identify({ userId: auth.userId });
    const learner = await learnerRepository.findByClerkId(auth.userId);

    if (learner && !learner.deletedAt && learner.status === "ACTIVE") {
      identify({ learnerId: learner.id });
      req.learner = learner;
    }

    next();
  } catch (error) {
    next(error);
  }
};
