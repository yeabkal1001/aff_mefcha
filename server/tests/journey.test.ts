import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * One learner, end to end: onboarding answers, a plan, a spoken turn, a grade,
 * and a Communication Profile that moves because of it.
 *
 * This is the product's central claim — that the numbers on the dashboard are
 * measured rather than asserted — expressed as a test. Every other suite checks
 * a layer; this one checks that the layers add up to the thing we promised.
 *
 * Both model calls are stubbed with fixed answers. That is the point: the
 * assertion is that *our* pipeline turns a judgement into mastery into a
 * dimension correctly, and a real model would make that unrepeatable without
 * testing anything extra. Gemini's own behaviour is not ours to assert.
 */

const auth = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: auth.userId }),
}));

/**
 * A director that always replies, and an evaluator that always finds the
 * learner got two of three chances right on whichever competency it was asked
 * about. Enough evidence to move mastery, not enough to master anything — which
 * is the interesting middle.
 */
const model = vi.hoisted(() => ({
  lastEvaluationTargets: [] as string[],
}));

vi.mock("../src/infra/ai/index.js", async () => {
  const ports = await import("../src/infra/ai/ports.js");

  return {
    ...ports,
    ai: {
      director: {
        name: "stub",
        reply: () =>
          Promise.resolve({ line: "That's a good start. Tell me more.", suggestsComplete: false }),
      },
      evaluator: {
        name: "stub",
        evaluate: (context: { utterance: string; targets: { id: string }[] }) => {
          model.lastEvaluationTargets = context.targets.map((target) => target.id);

          return Promise.resolve({
            cleanedTranscript: "I am studying software engineering at university.",
            judgements: context.targets.map((target) => ({
              competencyId: target.id,
              opportunities: 3,
              correct: 2,
              errorTags: ["tense"],
            })),
            corrections: [
              {
                errorSpan: "I am study",
                corrected: "I am studying",
                explanation: "After 'am', the verb takes -ing.",
                competencyId: context.targets[0]?.id ?? "G001",
              },
            ],
            sentenceCount: 1,
          });
        },
      },
      synthesizer: { name: "stub", available: false, synthesize: () => Promise.reject(new Error()) },
      transcriber: { name: "stub", available: false, transcribe: () => Promise.reject(new Error()) },
    },
  };
});

const { createApp } = await import("../src/http/app.js");
const { prisma } = await import("../src/infra/db/prisma.js");

let app: Express;

const HANA = "user_test_journey_hana";

beforeAll(async () => {
  app = createApp();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function cleanup() {
  await prisma.learner.deleteMany({ where: { clerkUserId: HANA } });
}

/** A turn's worth of client-measured timing. Roughly ten words in six seconds. */
const METRICS = {
  wordCount: 10,
  speechMs: 5_400,
  totalMs: 6_000,
  pauseCount: 1,
  pauseMs: 600,
  hesitationCount: 1,
  responseLatencyMs: 900,
  sentenceCount: 1,
};

describe("a learner's first day", () => {
  it("carries the onboarding answers onto the account", async () => {
    auth.userId = HANA;

    const created = await request(app).get("/v1/me");
    expect(created.status).toBe(200);

    // What the client replays out of the on-device draft after sign-up.
    const saved = await request(app).patch("/v1/me").send({
      displayName: "Hana",
      l1: "am",
      lifePathId: "university_success",
      studyField: "Computer science",
      dailyMinutes: 15,
      feedbackLanguage: "BILINGUAL",
    });

    expect(saved.status).toBe(200);
    expect(saved.body.displayName).toBe("Hana");
    expect(saved.body.profile.lifePathId).toBe("university_success");
  });

  it("reports every dimension unassessed before a word has been spoken", async () => {
    auth.userId = HANA;
    const profile = await request(app).get("/v1/me/profile");

    const dimensions = profile.body.dimensions as { skill: string; percent: number | null }[];

    expect(dimensions.map((d) => d.skill).sort()).toEqual([
      "FLUENCY",
      "GRAMMAR",
      "SENTENCE_STRUCTURE",
      "VOCABULARY",
    ]);
    // Null rather than zero. Four zeroes read as failure to someone who has not
    // yet had a chance to succeed.
    expect(dimensions.every((d) => d.percent === null)).toBe(true);
  });

  it("builds a plan set in the learner's own Life Path", async () => {
    auth.userId = HANA;
    const today = await request(app).get("/v1/today");

    expect(today.status).toBe(200);
    expect(today.body.activities.length).toBeGreaterThan(0);
    expect(today.body.activities[0].targets.length).toBeGreaterThan(0);
  });

  it("grades a spoken turn against the competencies the plan targeted", async () => {
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string; targets: { competencyId: string }[] };

    const started = await request(app).post(`/v1/sessions/${activity.id}/start`);
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("IN_PROGRESS");

    const turn = await request(app)
      .post(`/v1/sessions/${activity.id}/turns`)
      .send({ transcript: "I am study software engineering at university", metrics: METRICS });

    expect(turn.status).toBe(201);
    // The reply comes back with the turn, before grading has run. That ordering
    // is what keeps the conversation feeling like one.
    expect(turn.body.coachReply).toBeTruthy();
    expect(turn.body.turnId).toBeTruthy();

    const graded = await request(app).post(`/v1/turns/${turn.body.turnId}/evaluate`);

    expect(graded.status).toBe(200);
    expect(graded.body.corrections.length).toBeGreaterThan(0);
    // The evaluator was asked about the competencies the plan targeted, not
    // some general set — that link is what makes the evidence attributable.
    expect(model.lastEvaluationTargets).toEqual(
      expect.arrayContaining(activity.targets.map((t) => t.competencyId)),
    );
  });

  it("still reports unassessed on a single observation", async () => {
    // One turn is evidence, not a claim. `MIN_EVIDENCE_FOR_DISPLAY` is the
    // reason, and it is worth a test of its own: the failure mode it guards
    // against is a dashboard that reports 67% off one sentence, which the
    // learner will disbelieve and be right to.
    auth.userId = HANA;
    const profile = await request(app).get("/v1/me/profile");
    const dimensions = profile.body.dimensions as { percent: number | null }[];

    expect(dimensions.every((d) => d.percent === null)).toBe(true);
  });

  it("publishes a dimension once there is enough evidence to stand behind", async () => {
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string };

    // Two more graded turns takes the day's competencies to the threshold.
    for (const transcript of [
      "I am studying at the university this year",
      "My classes start early in the morning",
    ]) {
      const turn = await request(app)
        .post(`/v1/sessions/${activity.id}/turns`)
        .send({ transcript, metrics: METRICS });

      expect(turn.status).toBe(201);

      const graded = await request(app).post(`/v1/turns/${turn.body.turnId}/evaluate`);
      expect(graded.status).toBe(200);
    }

    const profile = await request(app).get("/v1/me/profile");
    const dimensions = profile.body.dimensions as {
      skill: string;
      percent: number | null;
      observedCount: number;
    }[];

    const moved = dimensions.filter((d) => d.percent !== null);

    expect(moved.length).toBeGreaterThan(0);
    // The stub answers two of three correct, so the number is a real read of
    // the evidence rather than a floor or a ceiling.
    for (const dimension of moved) {
      expect(dimension.observedCount).toBeGreaterThan(0);
      expect(dimension.percent).toBeGreaterThan(0);
      expect(dimension.percent).toBeLessThan(100);
    }
  });

  it("grades the same turn twice without counting the evidence twice", async () => {
    // A retried request, or a client that refetches. The write is keyed on
    // (turnId, competencyId), so a second run corrects rather than duplicates —
    // and mastery built from doubled evidence is mastery nobody can trust.
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string };

    const turn = await request(app)
      .post(`/v1/sessions/${activity.id}/turns`)
      .send({ transcript: "I am studying at the university now", metrics: METRICS });

    expect(turn.status).toBe(201);

    await request(app).post(`/v1/turns/${turn.body.turnId}/evaluate`);
    const second = await request(app).post(`/v1/turns/${turn.body.turnId}/evaluate`);

    expect(second.status).toBe(200);

    const attempts = await prisma.attempt.count({ where: { turnId: turn.body.turnId } });
    const judgements = await prisma.attempt.findMany({
      where: { turnId: turn.body.turnId },
      select: { competencyId: true },
    });

    expect(attempts).toBe(new Set(judgements.map((a) => a.competencyId)).size);
  });

  it("treats one utterance retried on a flaky connection as one turn", async () => {
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string };
    const key = "b7c1a6f4-2b3e-4f5a-9c8d-1e2f3a4b5c6d";

    const body = { transcript: "The library closes at nine", metrics: METRICS };

    const first = await request(app)
      .post(`/v1/sessions/${activity.id}/turns`)
      .set("Idempotency-Key", key)
      .send(body);
    const replay = await request(app)
      .post(`/v1/sessions/${activity.id}/turns`)
      .set("Idempotency-Key", key)
      .send(body);

    expect(first.status).toBe(201);
    expect(replay.body.turnId).toBe(first.body.turnId);
  });

  it("closes the session and shows the day in history", async () => {
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string };

    const completed = await request(app).post(`/v1/sessions/${activity.id}/complete`);
    expect(completed.body.status).toBe("COMPLETED");

    const history = await request(app).get("/v1/history");
    expect(history.status).toBe(200);
    expect(history.body.items.length).toBeGreaterThan(0);
    expect(history.body.items[0].activities.length).toBeGreaterThan(0);

    // The corrections the learner collected today, which is what the progress
    // screen shows back to them.
    const corrections = await request(app).get("/v1/history/corrections");
    expect(corrections.status).toBe(200);
    expect(corrections.body.items.length).toBeGreaterThan(0);
  });

  it("refuses to accept another turn once the exercise is finished", async () => {
    auth.userId = HANA;

    const today = await request(app).get("/v1/today");
    const activity = today.body.activities[0] as { id: string };

    const late = await request(app)
      .post(`/v1/sessions/${activity.id}/turns`)
      .send({ transcript: "One more thing", metrics: METRICS });

    expect(late.status).toBe(409);
  });
});
