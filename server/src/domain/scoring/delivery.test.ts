import { describe, expect, it } from "vitest";

import {
  averageSentenceWords,
  hesitationsPer100Words,
  judgeDelivery,
  pauseRatio,
  sanitiseMetrics,
  wordsPerMinute,
  type DeliveryCompetencyMap,
  type TurnMetrics,
} from "./delivery.js";

const MAP: DeliveryCompetencyMap = {
  speechRate: "F001.05",
  pausing: "F001.06",
  hesitation: "F020.05",
  responseLatency: "F003.01",
  sentenceLength: "S002.01",
};

/** A fluent thirty-word turn: 100wpm, few pauses, no hesitation. */
function metrics(overrides: Partial<TurnMetrics> = {}): TurnMetrics {
  return {
    wordCount: 30,
    speechMs: 18_000,
    totalMs: 20_000,
    pauseCount: 1,
    pauseMs: 2_000,
    hesitationCount: 0,
    responseLatencyMs: 1_000,
    sentenceCount: 3,
    ...overrides,
  };
}

describe("sanitiseMetrics", () => {
  it("leaves plausible values alone", () => {
    expect(sanitiseMetrics(metrics())).toEqual(metrics());
  });

  it("clamps a word count the duration cannot support", () => {
    // The client reports this, and it drives a score. Without a ceiling, a
    // tampered payload sets Fluency to 100 in one request.
    const result = sanitiseMetrics(metrics({ wordCount: 100_000, totalMs: 20_000 }));

    expect(result.wordCount).toBeLessThan(200);
  });

  it("rejects negative and non-finite durations", () => {
    const result = sanitiseMetrics(
      metrics({ totalMs: -5_000, speechMs: Number.NaN, pauseMs: -1 }),
    );

    expect(result.totalMs).toBe(0);
    expect(result.speechMs).toBe(0);
    expect(result.pauseMs).toBe(0);
  });

  it("never lets speech or pauses exceed the turn", () => {
    const result = sanitiseMetrics(metrics({ totalMs: 10_000, speechMs: 90_000, pauseMs: 90_000 }));

    expect(result.speechMs).toBeLessThanOrEqual(10_000);
    expect(result.pauseMs).toBeLessThanOrEqual(10_000);
  });

  it("never counts more hesitations than words, or more sentences than words", () => {
    const result = sanitiseMetrics(metrics({ wordCount: 5, hesitationCount: 99, sentenceCount: 99 }));

    expect(result.hesitationCount).toBeLessThanOrEqual(5);
    expect(result.sentenceCount).toBeLessThanOrEqual(5);
  });

  it("reports at least one sentence when anything was said", () => {
    expect(sanitiseMetrics(metrics({ wordCount: 10, sentenceCount: 0 })).sentenceCount).toBe(1);
  });
});

describe("the arithmetic", () => {
  it("computes words per minute from speech time, not wall-clock time", () => {
    // Pauses are not speech. Dividing by the wall clock would make a thoughtful
    // speaker look slow rather than measured.
    expect(wordsPerMinute(metrics({ wordCount: 30, speechMs: 18_000 }))).toBe(100);
  });

  it("returns zero rather than dividing by zero", () => {
    expect(wordsPerMinute(metrics({ speechMs: 0 }))).toBe(0);
    expect(pauseRatio(metrics({ totalMs: 0 }))).toBe(0);
    expect(hesitationsPer100Words(metrics({ wordCount: 0 }))).toBe(0);
    expect(averageSentenceWords(metrics({ sentenceCount: 0 }))).toBe(0);
  });

  it("computes the pause ratio against the whole turn", () => {
    expect(pauseRatio(metrics({ pauseMs: 5_000, totalMs: 20_000 }))).toBe(0.25);
  });

  it("normalises hesitations per hundred words", () => {
    expect(hesitationsPer100Words(metrics({ hesitationCount: 3, wordCount: 30 }))).toBe(10);
  });
});

describe("judgeDelivery", () => {
  it("produces no evidence from a turn too short to judge", () => {
    // "Yes." is a perfectly fluent answer and says nothing about pace. Grading
    // it produces noise that the mastery update would treat as signal.
    expect(judgeDelivery(metrics({ wordCount: 3 }), MAP)).toEqual([]);
  });

  it("passes a fluent turn on every metric", () => {
    const judgements = judgeDelivery(metrics(), MAP);

    expect(judgements.length).toBeGreaterThan(0);
    expect(judgements.every((judgement) => judgement.correct === 1)).toBe(true);
    expect(judgements.flatMap((judgement) => judgement.errorTags)).toEqual([]);
  });

  it("marks slow speech against speech rate and tags it", () => {
    const judgements = judgeDelivery(metrics({ wordCount: 10, speechMs: 30_000 }), MAP);
    const rate = judgements.find((judgement) => judgement.competencyId === MAP.speechRate);

    expect(rate?.correct).toBe(0);
    expect(rate?.errorTags).toContain("speech_rate_slow");
  });

  it("marks a turn that is mostly pauses", () => {
    const judgements = judgeDelivery(metrics({ pauseMs: 15_000, totalMs: 20_000 }), MAP);
    const pausing = judgements.find((judgement) => judgement.competencyId === MAP.pausing);

    expect(pausing?.correct).toBe(0);
    expect(pausing?.errorTags).toContain("long_pauses");
  });

  it("marks heavy filled pauses", () => {
    const judgements = judgeDelivery(metrics({ hesitationCount: 6, wordCount: 30 }), MAP);
    const hesitation = judgements.find((judgement) => judgement.competencyId === MAP.hesitation);

    expect(hesitation?.correct).toBe(0);
    expect(hesitation?.errorTags).toContain("filled_pauses");
  });

  it("distinguishes a run-on from a string of fragments", () => {
    // Both fail the sentence-length target, and the tag has to say which —
    // "say that as two sentences" is the wrong advice for a fragment.
    const runOn = judgeDelivery(metrics({ wordCount: 40, sentenceCount: 1 }), MAP);
    const fragments = judgeDelivery(metrics({ wordCount: 12, sentenceCount: 6 }), MAP);

    expect(
      runOn.find((judgement) => judgement.competencyId === MAP.sentenceLength)?.errorTags,
    ).toContain("run_on");
    expect(
      fragments.find((judgement) => judgement.competencyId === MAP.sentenceLength)?.errorTags,
    ).toContain("fragmentary");
  });

  it("skips response latency when there was nothing to respond to", () => {
    // Zero latency on a session's opening turn is an artefact of there being no
    // preceding question, not evidence of a quick answer.
    const judgements = judgeDelivery(metrics({ responseLatencyMs: 0 }), MAP);

    expect(judgements.some((judgement) => judgement.competencyId === MAP.responseLatency)).toBe(
      false,
    );
  });

  it("reports counts, never a fractional score", () => {
    // `opportunities` and `correct` are documented as counts, and the mastery
    // update divides them. A fraction here would smuggle a score through.
    for (const judgement of judgeDelivery(metrics({ wordCount: 40, sentenceCount: 1 }), MAP)) {
      expect(judgement.opportunities).toBe(1);
      expect([0, 1]).toContain(judgement.correct);
    }
  });
});
