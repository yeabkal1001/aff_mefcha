import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireAuth } from "../../http/middleware/auth.js";
import { idempotent } from "../../http/middleware/idempotency.js";
import { rateLimit } from "../../http/middleware/rate-limit.js";
import { text, uuidParam } from "../../http/middleware/validate.js";
import { route } from "../../http/route.js";
import { learnerRepository } from "../learners/learner.repository.js";
import { planService } from "../plans/plan.service.js";
import { turnService } from "../turns/turn.service.js";
import { sessionService } from "./session.service.js";

/**
 * `/v1/sessions` and `/v1/today` — practice.
 *
 * The AI rate limit is separate from the general one and much tighter, because
 * these are the endpoints that spend money at a provider. A learner cannot
 * speak thirty turns a minute; anything approaching that limit is a loop, and
 * the general limit is far too generous to catch it before it costs something.
 */
export const practiceRouter: Router = Router();

practiceRouter.use(requireAuth);

const aiLimit = rateLimit({
  bucket: "ai",
  windowMs: env.RATE_LIMIT_AI_WINDOW_MS,
  max: env.RATE_LIMIT_AI_MAX,
});

/** Today's plan, built on first request of the day. */
practiceRouter.get(
  "/today",
  ...route({
    handler: async ({ learner }) => {
      const full = await learnerRepository.findById(learner.id);
      if (!full) throw new Error("unreachable: authenticated learner not found");

      const plan = await planService.getOrCreateToday(full);
      return toPlanResponse(plan);
    },
  }),
);

practiceRouter.post(
  "/sessions/:id/start",
  ...route({
    schemas: { params: z.object({ id: uuidParam }) },
    handler: async ({ learner, params }) => {
      const session = await sessionService.start(params.id, learner);
      return { id: session.id, status: session.status, prompt: session.prompt };
    },
  }),
);

/**
 * Submit an utterance and get the coach's reply.
 *
 * The hot path. Idempotent on a client-supplied key, because this is exactly
 * the request a flaky connection retries — and without the key, one utterance
 * becomes two turns, two gradings and two mastery updates.
 */
practiceRouter.post(
  "/sessions/:id/turns",
  aiLimit,
  idempotent,
  ...route({
    status: 201,
    schemas: {
      params: z.object({ id: uuidParam }),
      body: z.object({
        /**
         * Bounded at both ends. Empty means the recogniser heard nothing and
         * there is nothing to grade; the ceiling is roughly four minutes of
         * speech, past which this is not a conversational turn.
         */
        transcript: text(4_000),
        metrics: z.object({
          wordCount: z.number().int().min(0),
          speechMs: z.number().min(0),
          totalMs: z.number().min(0),
          pauseCount: z.number().int().min(0),
          pauseMs: z.number().min(0),
          hesitationCount: z.number().int().min(0),
          responseLatencyMs: z.number().min(0),
          sentenceCount: z.number().int().min(0),
        }),
      }),
    },
    handler: ({ learner, params, body }) =>
      turnService.submit(learner, {
        sessionId: params.id,
        transcript: body.transcript,
        metrics: body.metrics,
      }),
  }),
);

/**
 * Grade a turn.
 *
 * Separate from submitting it, and that separation is the reason the
 * conversation feels alive: the reply comes back in about a second, and this
 * runs afterwards while the learner is already listening to it. Safe to call
 * twice — every write is keyed and upserted.
 */
practiceRouter.post(
  "/turns/:id/evaluate",
  aiLimit,
  ...route({
    schemas: { params: z.object({ id: uuidParam }) },
    handler: ({ learner, params }) => turnService.evaluate(params.id, learner),
  }),
);

practiceRouter.post(
  "/sessions/:id/complete",
  ...route({
    schemas: { params: z.object({ id: uuidParam }) },
    handler: async ({ learner, params }) => {
      const session = await sessionService.complete(params.id, learner);
      return { id: session.id, status: session.status };
    },
  }),
);

practiceRouter.post(
  "/sessions/:id/abandon",
  ...route({
    schemas: { params: z.object({ id: uuidParam }) },
    handler: async ({ learner, params }) => {
      const session = await sessionService.abandon(params.id, learner);
      return { id: session.id, status: session.status };
    },
  }),
);

/** What the learner said and what the coach replied, for one exercise. */
practiceRouter.get(
  "/sessions/:id",
  ...route({
    schemas: { params: z.object({ id: uuidParam }) },
    handler: ({ learner, params }) => sessionService.transcript(params.id, learner),
  }),
);

function toPlanResponse(plan: Awaited<ReturnType<typeof planService.findByDate>>) {
  if (!plan) throw new Error("unreachable: plan was just created");

  return {
    id: plan.id,
    date: plan.date.toISOString().slice(0, 10),
    theme: plan.theme,
    completedAt: plan.completedAt?.toISOString() ?? null,
    domain: plan.domain,
    activities: plan.sessions.map((session) => ({
      id: session.id,
      orderIndex: session.orderIndex,
      status: session.status,
      prompt: session.prompt,
      stimulus: session.spec,
      templateId: session.templateId,
      targets: session.targets.map((target) => ({
        competencyId: target.competencyId,
        name: target.competency.name,
        skill: target.competency.skill,
        role: target.role,
      })),
    })),
  };
}
