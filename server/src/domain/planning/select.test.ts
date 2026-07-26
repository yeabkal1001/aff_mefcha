import { describe, expect, it } from "vitest";

import {
  exerciseCount,
  scoreCandidate,
  selectTargets,
  unmetPrerequisites,
  type Candidate,
} from "./select.js";

const NOW = new Date("2026-03-01T08:00:00Z");
const LONG_AGO = new Date("2026-01-01T00:00:00Z");

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    competencyId: "G001",
    skill: "GRAMMAR",
    mastery: 0,
    stabilityDays: 1,
    lastSeenAt: null,
    evidenceCount: 0,
    weight: 1,
    isCore: true,
    blockedBy: [],
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("puts an overdue review above everything else", () => {
    // Recovering a competency about to be forgotten is cheap now and expensive
    // later, which is the whole argument for spaced repetition.
    const due = scoreCandidate(
      candidate({ mastery: 0.9, evidenceCount: 5, stabilityDays: 5, lastSeenAt: LONG_AGO }),
      NOW,
    );
    const fresh = scoreCandidate(candidate(), NOW);

    expect(due.reason).toBe("review");
    expect(due.score).toBeGreaterThan(fresh.score);
  });

  it("scores a review higher the further past due it is", () => {
    const slightly = scoreCandidate(
      candidate({
        mastery: 0.9,
        evidenceCount: 5,
        stabilityDays: 30,
        lastSeenAt: new Date("2026-02-20T00:00:00Z"),
      }),
      NOW,
    );
    const badly = scoreCandidate(
      candidate({ mastery: 0.9, evidenceCount: 5, stabilityDays: 2, lastSeenAt: LONG_AGO }),
      NOW,
    );

    expect(badly.score).toBeGreaterThan(slightly.score);
  });

  it("scores a core requirement above an incidental one", () => {
    const core = scoreCandidate(candidate({ isCore: true }), NOW);
    const incidental = scoreCandidate(candidate({ isCore: false }), NOW);

    expect(core.score).toBeGreaterThan(incidental.score);
  });

  it("prefers finishing something in progress to nudging something new", () => {
    const nearlyDone = scoreCandidate(
      candidate({ mastery: 0.75, evidenceCount: 6 }),
      NOW,
    );
    const barelyStarted = scoreCandidate(
      candidate({ mastery: 0.1, evidenceCount: 6 }),
      NOW,
    );

    expect(nearlyDone.reason).toBe("reinforce");
    expect(nearlyDone.score).toBeGreaterThan(barelyStarted.score);
  });

  it("scores a blocked competency at zero whatever else is true of it", () => {
    // Introducing something whose foundations are missing produces a failure
    // that teaches nothing and depresses the estimate for both.
    const blocked = scoreCandidate(
      candidate({ isCore: true, weight: 10, blockedBy: ["G001.01"] }),
      NOW,
    );

    expect(blocked.score).toBe(0);
  });

  it("nearly ignores something learned and not yet due", () => {
    const settled = scoreCandidate(
      candidate({ mastery: 0.95, evidenceCount: 10, stabilityDays: 60, lastSeenAt: NOW }),
      NOW,
    );

    expect(settled.score).toBeLessThan(10);
  });
});

describe("selectTargets", () => {
  const options = { limit: 4, now: NOW, maxPerSkill: 2 };

  it("returns at most the limit", () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      candidate({ competencyId: `G${index}`, skill: index % 2 ? "GRAMMAR" : "FLUENCY" }),
    );

    expect(selectTargets(candidates, options)).toHaveLength(4);
  });

  it("caps how much of one skill a day can be", () => {
    // Without the cap, a learner weak in grammar gets a day of nothing but
    // grammar — optimal against the model, miserable to sit through, and it
    // starves the other three dimensions of evidence.
    const candidates = Array.from({ length: 10 }, (_, index) =>
      candidate({ competencyId: `G${index}`, skill: "GRAMMAR" }),
    );

    expect(selectTargets(candidates, options)).toHaveLength(2);
  });

  it("excludes blocked competencies entirely", () => {
    const chosen = selectTargets(
      [
        candidate({ competencyId: "A", blockedBy: ["X"] }),
        candidate({ competencyId: "B", skill: "FLUENCY" }),
      ],
      options,
    );

    expect(chosen.map((target) => target.competencyId)).toEqual(["B"]);
  });

  it("is deterministic for equally scored candidates", () => {
    // Without a total order, two builds of the same plan from the same data can
    // differ — which makes the whole thing untestable and makes "why did my
    // plan change" unanswerable.
    const candidates = [
      candidate({ competencyId: "G003", skill: "GRAMMAR" }),
      candidate({ competencyId: "G001", skill: "VOCABULARY" }),
      candidate({ competencyId: "G002", skill: "FLUENCY" }),
    ];

    const first = selectTargets(candidates, options).map((target) => target.competencyId);
    const second = selectTargets([...candidates].reverse(), options).map(
      (target) => target.competencyId,
    );

    expect(first).toEqual(second);
  });

  it("returns nothing when everything is blocked", () => {
    const chosen = selectTargets([candidate({ blockedBy: ["X"] })], options);
    expect(chosen).toEqual([]);
  });
});

describe("exerciseCount", () => {
  it("fits more exercises into a longer session", () => {
    expect(exerciseCount(30)).toBeGreaterThan(exerciseCount(10));
  });

  it("always plans at least one", () => {
    // An empty plan is indistinguishable from a broken product.
    expect(exerciseCount(1)).toBeGreaterThanOrEqual(1);
    expect(exerciseCount(0)).toBeGreaterThanOrEqual(1);
  });

  it("caps the day however long the learner asks for", () => {
    expect(exerciseCount(600)).toBeLessThanOrEqual(8);
  });

  it("leaves room for the greeting and the reflection", () => {
    // Ten minutes is 600 seconds; at 150s an exercise that is four, and the
    // plan must not assume the whole budget is exercises.
    expect(exerciseCount(10)).toBeLessThan(4);
  });
});

describe("unmetPrerequisites", () => {
  const prereqs = new Map([["G001.02", ["G001.01", "G004"]]]);

  it("lists only the prerequisites actually below the threshold", () => {
    const unmet = unmetPrerequisites("G001.02", prereqs, (id) =>
      id === "G001.01" ? 0.9 : 0.1,
    );

    expect(unmet).toEqual(["G004"]);
  });

  it("treats a competency with no prerequisites as unblocked", () => {
    expect(unmetPrerequisites("G001", prereqs, () => 0)).toEqual([]);
  });

  it("does not require full mastery of a prerequisite", () => {
    // Gating new material on complete mastery of everything beneath it is the
    // most common way an adaptive curriculum stalls on its first hard item.
    expect(unmetPrerequisites("G001.02", prereqs, () => 0.65)).toEqual([]);
  });
});
