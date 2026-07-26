import { Router } from "express";

import { requireAuth } from "../../http/middleware/auth.js";
import { route } from "../../http/route.js";
import { learnerService } from "./learner.service.js";
import { updateProfileSchema } from "./learner.schemas.js";

/**
 * `/v1/me` — the signed-in learner, their onboarding profile, and their
 * Communication Profile.
 *
 * Scoped to "me" rather than `/learners/:id` throughout. There is no legitimate
 * reason for the client to name a learner ID, and an endpoint that accepts one
 * is an endpoint whose ownership check has to be right every time. This one
 * cannot be got wrong: the subject is the token.
 */
export const learnerRouter: Router = Router();

learnerRouter.use(requireAuth);

learnerRouter.get(
  "/",
  ...route({
    handler: ({ learner }) => learnerService.getMe(learner),
  }),
);

learnerRouter.patch(
  "/",
  ...route({
    schemas: { body: updateProfileSchema },
    handler: ({ learner, body }) => learnerService.updateProfile(learner, body),
  }),
);

/** The four dimensions and the lifetime totals behind the progress card. */
learnerRouter.get(
  "/profile",
  ...route({
    handler: ({ learner }) => learnerService.getCommunicationProfile(learner.id),
  }),
);

/**
 * Soft delete now, purge after the grace window.
 *
 * 202 rather than 204: the account is not gone yet, and saying so honestly is
 * the difference between a promise we keep and one we appear to break when the
 * data is still there an hour later.
 */
learnerRouter.delete(
  "/",
  ...route({
    status: 202,
    handler: async ({ learner }) => {
      await learnerService.requestDeletion(learner);
      return {
        status: "pending_deletion",
        message: "Your account is scheduled for deletion. Sign in within 30 days to cancel.",
      };
    },
  }),
);
