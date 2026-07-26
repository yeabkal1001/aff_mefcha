import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The HTTP surface, end to end against a real database.
 *
 * Clerk is the only thing stubbed, and only its token verification: everything
 * downstream of `getAuth` — provisioning, ownership, roles, validation, the
 * error shape — is the real code path. Stubbing the service layer instead would
 * leave the part most likely to be wrong untested, because authorization bugs
 * live in the wiring rather than in the services.
 *
 * The stub is hoisted because `vi.mock` is, and the factory runs before any
 * `beforeAll`.
 */
const auth = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: auth.userId }),
}));

const { createApp } = await import("../src/http/app.js");
const { readiness } = await import("../src/http/health.routes.js");
const { prisma } = await import("../src/infra/db/prisma.js");

let app: Express;

/** Distinct from any real Clerk ID, so a stray run cannot touch a real row. */
const ALICE = "user_test_alice";
const BOB = "user_test_bob";

beforeAll(async () => {
  app = createApp();
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(() => {
  auth.userId = null;
});

async function cleanup() {
  // Cascades handle everything the learner owns; the schema declares those
  // relations, so a hand-written teardown here would be a second, divergent
  // description of the same graph.
  await prisma.learner.deleteMany({
    where: { clerkUserId: { in: [ALICE, BOB] } },
  });
}

async function signIn(clerkUserId: string) {
  auth.userId = clerkUserId;
  const response = await request(app).get("/v1/me");
  return response.body as { id: string };
}

describe("health", () => {
  it("reports liveness without touching a dependency", async () => {
    // Must not check the database: a database outage failing the liveness probe
    // restarts every instance, none recover, and a dependency's outage becomes
    // a total one.
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("reports readiness including the database", async () => {
    const response = await request(app).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body.checks.database).toBe("ok");
  });

  it("reports itself unready the moment a drain begins", async () => {
    // The whole point of the shutdown sequence: readiness goes false, the
    // balancer stops routing, *then* the socket closes. If this endpoint keeps
    // answering 200 during a drain the delay in main.ts buys nothing and every
    // in-flight request at shutdown becomes a 502.
    readiness.accepting = false;
    try {
      const response = await request(app).get("/ready");

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("draining");
    } finally {
      readiness.accepting = true;
    }
  });

  it("stays alive while draining, so nothing restarts it mid-drain", async () => {
    readiness.accepting = false;
    try {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
    } finally {
      readiness.accepting = true;
    }
  });

  it("gives away nothing about the stack", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(/express|postgres|prisma/i);
  });
});

describe("correlation IDs", () => {
  it("returns one on every response, including failures", async () => {
    // Anonymous, so this is a 401 rather than a 404: routes under /v1 are
    // behind authentication as a group, which means an unauthenticated caller
    // cannot map the API by watching which paths 404.
    const response = await request(app).get("/v1/nope");

    expect(response.status).toBe(401);
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("echoes a caller's ID when it is a UUID", async () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const response = await request(app).get("/health").set("x-request-id", id);

    expect(response.headers["x-request-id"]).toBe(id);
  });

  it("replaces a malformed one rather than trusting it", async () => {
    // Inbound IDs are attacker-controlled text that lands in every log line for
    // the request, and are reflected in a response header. Accepting arbitrary
    // strings accepts log forging and header injection; the node HTTP layer
    // rejects a literal newline, so the value below is what actually gets
    // through — long, unbounded, and not ours.
    const response = await request(app)
      .get("/health")
      .set("x-request-id", `not-a-uuid-${"A".repeat(4_000)}`);

    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("authentication", () => {
  it("rejects an anonymous request", async () => {
    const response = await request(app).get("/v1/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("unauthenticated");
  });

  it("says nothing about why a token was rejected", async () => {
    const response = await request(app).get("/v1/me");

    // "Expired" versus "malformed" versus "no such user" is information about
    // our token handling that an unauthenticated caller has no business having.
    expect(response.body.message).not.toMatch(/expired|malformed|signature|jwt/i);
  });

  it("provisions a learner on first sight", async () => {
    // Clerk issues a valid session the instant a user signs up and the webhook
    // is asynchronous, so failing here would make the very first screen flaky.
    auth.userId = ALICE;
    const response = await request(app).get("/v1/me");

    expect(response.status).toBe(200);
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.profile.cefr).toBe("A2");
  });

  it("returns the same learner on a second request", async () => {
    const first = await signIn(ALICE);
    const second = await signIn(ALICE);

    expect(second.id).toBe(first.id);
  });

  it("never exposes the Clerk user ID or soft-delete state", async () => {
    auth.userId = ALICE;
    const response = await request(app).get("/v1/me");

    const body = JSON.stringify(response.body);
    expect(body).not.toContain(ALICE);
    expect(response.body.deletedAt).toBeUndefined();
    expect(response.body.role).toBeUndefined();
  });
});

describe("validation", () => {
  it("rejects an unknown field rather than ignoring it", async () => {
    // Mass assignment. Silently dropping the key means a client probing for
    // privilege escalation gets a 200 and we never see it.
    auth.userId = ALICE;
    const response = await request(app).patch("/v1/me").send({ role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("validation_failed");
  });

  it("reports every problem at once, with paths", async () => {
    auth.userId = ALICE;
    const response = await request(app)
      .patch("/v1/me")
      .send({ dailyMinutes: 5_000, l1: "amharic" });

    expect(response.status).toBe(400);
    expect(response.body.issues.length).toBeGreaterThanOrEqual(2);
    expect(response.body.issues[0].path).toMatch(/^body\./);
  });

  it("rejects a malformed body as a 400, not a 500", async () => {
    auth.userId = ALICE;
    const response = await request(app)
      .patch("/v1/me")
      .set("content-type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
  });

  it("rejects a non-UUID path parameter before it reaches the database", async () => {
    auth.userId = ALICE;
    const response = await request(app).post("/v1/sessions/not-a-uuid/start");

    expect(response.status).toBe(400);
    expect(response.body.issues[0].path).toBe("params.id");
  });

  it("accepts a valid update and returns the new state", async () => {
    auth.userId = ALICE;
    const response = await request(app)
      .patch("/v1/me")
      .send({ displayName: "Hana", studyField: "software engineering", dailyMinutes: 20 });

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe("Hana");
    expect(response.body.profile.dailyMinutes).toBe(20);
  });

  it("refuses a Life Path with no authored content", async () => {
    auth.userId = ALICE;
    const response = await request(app).patch("/v1/me").send({ lifePathId: "job_interview" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/isn't available/i);
  });
});

describe("authorization", () => {
  it("refuses to let one learner read another's session", async () => {
    auth.userId = ALICE;
    await request(app).patch("/v1/me").send({ lifePathId: "university_success" });
    const plan = await request(app).get("/v1/today");
    const sessionId = plan.body.activities[0].id as string;

    auth.userId = BOB;
    await request(app).get("/v1/me");
    const response = await request(app).get(`/v1/sessions/${sessionId}`);

    expect(response.status).toBe(403);
  });

  it("returns 403 rather than 404 for someone else's resource", async () => {
    // 404 for a resource that exists but is not yours turns the endpoint into
    // an existence oracle: walk IDs, watch the status code, enumerate the table.
    auth.userId = ALICE;
    const plan = await request(app).get("/v1/today");
    const sessionId = plan.body.activities[0].id as string;

    auth.userId = BOB;
    await request(app).get("/v1/me");

    const theirs = await request(app).get(`/v1/sessions/${sessionId}`);
    const nothing = await request(app).get(
      "/v1/sessions/00000000-0000-4000-8000-000000000000",
    );

    expect(theirs.status).toBe(403);
    expect(nothing.status).toBe(404);
    // And the message must not distinguish them either.
    expect(theirs.body.message).not.toMatch(/exist|found/i);
  });

  it("refuses to let one learner submit a turn to another's session", async () => {
    auth.userId = ALICE;
    const plan = await request(app).get("/v1/today");
    const sessionId = plan.body.activities[0].id as string;

    auth.userId = BOB;
    await request(app).get("/v1/me");
    const response = await request(app)
      .post(`/v1/sessions/${sessionId}/turns`)
      .send({ transcript: "hello", metrics: zeroMetrics() });

    expect(response.status).toBe(403);
  });
});

describe("the day plan", () => {
  it("builds one on the first request of the day", async () => {
    auth.userId = ALICE;
    await request(app).patch("/v1/me").send({ lifePathId: "university_success" });

    const response = await request(app).get("/v1/today");

    expect(response.status).toBe(200);
    expect(response.body.activities.length).toBeGreaterThan(0);
    expect(response.body.activities[0].prompt).toBeTruthy();
    expect(response.body.activities[0].targets.length).toBeGreaterThan(0);
  });

  it("returns the same plan on a second request rather than building another", async () => {
    // The unique index on (learnerId, date) is what decides, not a
    // check-then-insert that two concurrent requests both pass.
    auth.userId = ALICE;
    const first = await request(app).get("/v1/today");
    const second = await request(app).get("/v1/today");

    expect(second.body.id).toBe(first.body.id);
  });

  it("survives two concurrent first requests", async () => {
    auth.userId = BOB;
    await request(app).get("/v1/me");

    const [a, b] = await Promise.all([
      request(app).get("/v1/today"),
      request(app).get("/v1/today"),
    ]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.id).toBe(b.body.id);
  });
});

describe("the communication profile", () => {
  it("reports all four dimensions as unassessed for a new learner", async () => {
    auth.userId = ALICE;
    const response = await request(app).get("/v1/me/profile");

    expect(response.status).toBe(200);
    const dimensions = response.body.dimensions as { percent: number | null }[];

    expect(dimensions).toHaveLength(4);
    // Null, not zero. Four zeroes read as failure before they have spoken.
    expect(dimensions.every((dimension) => dimension.percent === null)).toBe(true);
    expect(response.body.totals.sessionsCompleted).toBe(0);
  });
});

describe("history", () => {
  it("paginates with a cursor and reports the end of the list", async () => {
    auth.userId = ALICE;
    await request(app).get("/v1/today");

    const response = await request(app).get("/v1/history?limit=1");

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeLessThanOrEqual(1);
    // Null rather than absent: absent is indistinguishable from "the server
    // forgot", and a client looping until the key is missing behaves
    // differently from one looping until it is null.
    expect(response.body).toHaveProperty("nextCursor");
  });

  it("rejects a page size beyond the ceiling", async () => {
    auth.userId = ALICE;
    const response = await request(app).get("/v1/history?limit=100000");

    expect(response.status).toBe(400);
  });
});

function zeroMetrics() {
  return {
    wordCount: 5,
    speechMs: 3_000,
    totalMs: 4_000,
    pauseCount: 0,
    pauseMs: 0,
    hesitationCount: 0,
    responseLatencyMs: 500,
    sentenceCount: 1,
  };
}
