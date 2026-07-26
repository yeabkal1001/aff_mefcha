import { describe, expect, it } from "vitest";

import {
  applyEvidence,
  computeDimension,
  computeProfile,
  dueAtFrom,
  evidenceWeight,
  MIN_EVIDENCE_FOR_DISPLAY,
  retrievability,
  type DimensionInput,
  type Evidence,
  type MasteryState,
} from "./mastery.js";

/**
 * The learner model.
 *
 * These tests are the closest thing this codebase has to a specification of the
 * pedagogy. Everything here would fail silently in production — a broken
 * mastery update still returns 200 and still shows a number — so the assertions
 * are about behaviour a teacher would recognise, not about arithmetic.
 */

const fresh: MasteryState = { mastery: 0, stabilityDays: 1, evidenceCount: 0 };

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    opportunities: 4,
    correct: 4,
    scaffoldLevel: 0,
    reliability: 1,
    repeatedTemplate: false,
    repeatedTheme: false,
    ...overrides,
  };
}

describe("evidenceWeight", () => {
  it("counts an unaided answer on a reliable exercise in full", () => {
    expect(evidenceWeight(evidence())).toBe(1);
  });

  it("discounts by how well the exercise measures the skill at all", () => {
    expect(evidenceWeight(evidence({ reliability: 0.5 }))).toBeCloseTo(0.5);
  });

  it("discounts help that was showing", () => {
    const unaided = evidenceWeight(evidence());
    const scaffolded = evidenceWeight(evidence({ scaffoldLevel: 2 }));

    expect(scaffolded).toBeLessThan(unaided);
  });

  it("never discounts scaffolding to nothing", () => {
    // A correct answer with maximum help is still a correct answer. Zero here
    // would make the last rung of the ladder produce no evidence at all, so a
    // struggling learner's whole session would go unrecorded.
    expect(evidenceWeight(evidence({ scaffoldLevel: 10 }))).toBeGreaterThan(0.2);
  });

  it("penalises the same template and the same theme, and both together", () => {
    const base = evidenceWeight(evidence());
    const sameTemplate = evidenceWeight(evidence({ repeatedTemplate: true }));
    const both = evidenceWeight(evidence({ repeatedTemplate: true, repeatedTheme: true }));

    expect(sameTemplate).toBeLessThan(base);
    expect(both).toBeLessThan(sameTemplate);
  });
});

describe("applyEvidence", () => {
  it("moves the estimate toward what was observed", () => {
    const next = applyEvidence(fresh, evidence({ opportunities: 4, correct: 4 }));

    expect(next.mastery).toBeGreaterThan(0);
    expect(next.evidenceCount).toBe(1);
  });

  it("moves it down when the learner does badly", () => {
    const strong: MasteryState = { mastery: 0.8, stabilityDays: 10, evidenceCount: 5 };
    const next = applyEvidence(strong, evidence({ opportunities: 4, correct: 0 }));

    expect(next.mastery).toBeLessThan(strong.mastery);
  });

  it("treats no opportunities as no evidence, not as failure", () => {
    // The single most important case in this file. A competency that never came
    // up must not be scored as though the learner failed it, or a session that
    // happened not to elicit something would punish them for it.
    const state: MasteryState = { mastery: 0.6, stabilityDays: 5, evidenceCount: 3 };
    const next = applyEvidence(state, evidence({ opportunities: 0, correct: 0 }));

    expect(next).toEqual(state);
  });

  it("moves less as evidence accumulates", () => {
    const novice = applyEvidence(
      { mastery: 0.5, stabilityDays: 5, evidenceCount: 0 },
      evidence(),
    );
    const veteran = applyEvidence(
      { mastery: 0.5, stabilityDays: 5, evidenceCount: 20 },
      evidence(),
    );

    // One bad morning must not undo three weeks of work, and one good answer
    // must not certify a competency the learner has never shown before.
    expect(novice.mastery - 0.5).toBeGreaterThan(veteran.mastery - 0.5);
  });

  it("keeps mastery inside 0..1 under repeated success and repeated failure", () => {
    let state = fresh;
    for (let i = 0; i < 100; i += 1) {
      state = applyEvidence(state, evidence({ opportunities: 5, correct: 5 }));
    }
    expect(state.mastery).toBeLessThanOrEqual(1);
    expect(state.mastery).toBeGreaterThan(0.9);

    for (let i = 0; i < 100; i += 1) {
      state = applyEvidence(state, evidence({ opportunities: 5, correct: 0 }));
    }
    expect(state.mastery).toBeGreaterThanOrEqual(0);
  });

  it("extends the review interval after a success and collapses it after a failure", () => {
    const learned: MasteryState = { mastery: 0.85, stabilityDays: 10, evidenceCount: 8 };

    const passed = applyEvidence(learned, evidence({ opportunities: 4, correct: 4 }));
    expect(passed.stabilityDays).toBeGreaterThan(learned.stabilityDays);

    const failed = applyEvidence(learned, evidence({ opportunities: 4, correct: 1 }));
    expect(failed.stabilityDays).toBeLessThan(learned.stabilityDays);
    // Never to zero: even a failed recall is a rehearsal, and re-showing it in
    // an hour is not how anybody learns.
    expect(failed.stabilityDays).toBeGreaterThanOrEqual(1);
  });

  it("caps the review interval so an estimate cannot go stale forever", () => {
    let state: MasteryState = { mastery: 0.95, stabilityDays: 170, evidenceCount: 30 };
    for (let i = 0; i < 20; i += 1) {
      state = applyEvidence(state, evidence({ opportunities: 4, correct: 4 }));
    }
    expect(state.stabilityDays).toBeLessThanOrEqual(180);
  });
});

describe("retrievability", () => {
  it("is zero for something never practised", () => {
    expect(retrievability(null, 5, new Date())).toBe(0);
  });

  it("is 0.9 at exactly one stability interval", () => {
    // This is what makes "stability" mean something concrete rather than being
    // an arbitrary scale, and it is the anchor the scheduler's DUE_BELOW
    // constant is chosen against.
    const now = new Date("2026-01-11T00:00:00Z");
    const lastSeen = new Date("2026-01-01T00:00:00Z");

    expect(retrievability(lastSeen, 10, now)).toBeCloseTo(0.9, 3);
  });

  it("decays as time passes", () => {
    const lastSeen = new Date("2026-01-01T00:00:00Z");
    const soon = retrievability(lastSeen, 10, new Date("2026-01-05T00:00:00Z"));
    const later = retrievability(lastSeen, 10, new Date("2026-02-01T00:00:00Z"));

    expect(soon).toBeGreaterThan(later);
  });

  it("decays more slowly for a stronger memory", () => {
    const lastSeen = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-01-15T00:00:00Z");

    expect(retrievability(lastSeen, 30, now)).toBeGreaterThan(
      retrievability(lastSeen, 3, now),
    );
  });
});

describe("dueAtFrom", () => {
  it("is the last sighting plus the stability interval", () => {
    const seen = new Date("2026-01-01T00:00:00Z");
    expect(dueAtFrom(seen, 3).toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });
});

describe("computeDimension", () => {
  function input(overrides: Partial<DimensionInput> = {}): DimensionInput {
    return {
      skill: "GRAMMAR",
      observable: true,
      mastery: 0.5,
      evidenceCount: MIN_EVIDENCE_FOR_DISPLAY,
      weight: 1,
      ...overrides,
    };
  }

  it("reports null rather than zero when nothing has been assessed", () => {
    // Null and 0 mean opposite things to a learner. A dashboard that opens on
    // four zeroes reads as failure before they have said a word.
    const result = computeDimension("GRAMMAR", []);

    expect(result.percent).toBeNull();
    expect(result.observedCount).toBe(0);
  });

  it("ignores competencies below the evidence threshold", () => {
    const result = computeDimension("GRAMMAR", [
      input({ evidenceCount: MIN_EVIDENCE_FOR_DISPLAY - 1, mastery: 1 }),
    ]);

    // Two right out of two is 100%, and saying so is a lie the learner catches.
    expect(result.percent).toBeNull();
    expect(result.totalCount).toBe(1);
  });

  it("excludes unobservable competencies instead of scoring them zero", () => {
    const result = computeDimension("GRAMMAR", [
      input({ mastery: 0.8 }),
      input({ observable: false, mastery: 0, evidenceCount: 10 }),
    ]);

    // Nothing in this stack can produce evidence for an unobservable
    // competency, so a permanent zero would be a score for our tooling.
    expect(result.percent).toBe(80);
    expect(result.totalCount).toBe(1);
  });

  it("weights competencies by their pull in the curriculum", () => {
    const result = computeDimension("GRAMMAR", [
      input({ mastery: 1, weight: 3 }),
      input({ mastery: 0, weight: 1 }),
    ]);

    expect(result.percent).toBe(75);
  });

  it("ignores competencies belonging to another skill", () => {
    const result = computeDimension("GRAMMAR", [
      input({ mastery: 1 }),
      input({ skill: "FLUENCY", mastery: 0 }),
    ]);

    expect(result.percent).toBe(100);
  });

  it("does not produce NaN when every weight is zero", () => {
    // An authoring mistake, not a runtime one — but it would put NaN on the
    // dashboard, which is worse than reporting nothing.
    const result = computeDimension("GRAMMAR", [input({ weight: 0 }), input({ weight: 0 })]);

    expect(result.percent).toBeNull();
  });
});

describe("computeProfile", () => {
  it("always returns the four dimensions, in display order", () => {
    const profile = computeProfile([]);

    expect(profile.map((dimension) => dimension.skill)).toEqual([
      "GRAMMAR",
      "VOCABULARY",
      "FLUENCY",
      "SENTENCE_STRUCTURE",
    ]);
    // A dimension missing from the response would collapse the dashboard's
    // layout; one reading "not yet assessed" is the designed empty state.
    expect(profile.every((dimension) => dimension.percent === null)).toBe(true);
  });
});
