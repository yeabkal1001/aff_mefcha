import { Router } from "express";

import { requireAuth } from "../../http/middleware/auth.js";
import { paginationQuery } from "../../http/middleware/validate.js";
import { route } from "../../http/route.js";
import { historyService } from "./history.service.js";

/**
 * `/v1/history` — everything the learner has practised.
 *
 * Two reads, both cursor-paginated. The queries and the shape they return live
 * in the service; this file is only the map from URL to call.
 */
export const historyRouter: Router = Router();

historyRouter.use(requireAuth);

historyRouter.get(
  "/",
  ...route({
    schemas: { query: paginationQuery },
    handler: ({ learner, query }) => historyService.listDays(learner.id, query),
  }),
);

historyRouter.get(
  "/corrections",
  ...route({
    schemas: { query: paginationQuery },
    handler: ({ learner, query }) => historyService.listCorrections(learner.id, query),
  }),
);
