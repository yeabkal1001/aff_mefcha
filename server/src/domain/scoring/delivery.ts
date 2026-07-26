/**
 * Turning how a turn was *spoken* into evidence, without an LLM.
 *
 * Grammar and vocabulary need a judge. Fluency and sentence structure mostly do
 * not: words per minute, pause behaviour, hesitation rate and sentence length
 * are arithmetic over timings the client already has, and computing them here
 * makes them cheap, instant, deterministic and free of the risk that a model
 * invents a number. The persona document promises specific figures; these are
 * the ones that have to be real.
 *
 * The input comes from the browser, and is therefore not trusted. Everything
 * below is clamped to a physically plausible range before it is used — a
 * client claiming 4,000 words per minute must not be able to drive a learner's
 * Fluency to 100%.
 */

/** What the client measures during a turn. Mirrors `turnMetricsSchema`. */
export interface TurnMetrics {
  /** Words in the verbatim transcript. */
  wordCount: number;
  /** Milliseconds of actual speech, excluding the pauses below. */
  speechMs: number;
  /** Wall-clock length of the turn, including pauses. */
  totalMs: number;
  /** Gaps longer than the pause threshold. */
  pauseCount: number;
  pauseMs: number;
  /** "um", "uh", "eh" and friends in the verbatim track. */
  hesitationCount: number;
  /** How long after the coach stopped before the learner started. */
  responseLatencyMs: number;
  /** Sentences the recogniser or evaluator found in the transcript. */
  sentenceCount: number;
}

/** A judgement in the same shape as an LLM's, so both feed one pipeline. */
export interface DeliveryJudgement {
  competencyId: string;
  opportunities: number;
  correct: number;
  errorTags: string[];
}

/**
 * Plausible ranges for A2 conversational English.
 *
 * These are targets, not averages of the general population: the point of
 * comparison is "does this sound like someone speaking comfortably", and a
 * learner who exceeds them is not penalised.
 */
const TARGET = {
  /** Below this reads as halting; the ceiling is where fast stops helping. */
  wordsPerMinuteFloor: 70,
  wordsPerMinuteCeiling: 130,
  /** Fraction of the turn spent in long pauses. */
  pauseRatioMax: 0.3,
  /** Filled pauses per 100 words. */
  hesitationsPer100Max: 8,
  /** How long a natural gap before answering is. */
  responseLatencyMaxMs: 3_000,
  /** Sentence length, in words. A2 target is roughly 8 to 14. */
  sentenceWordsFloor: 6,
  sentenceWordsCeiling: 14,
} as const;

/**
 * A turn shorter than this is not evidence about fluency.
 *
 * "Yes." is a perfectly fluent answer and tells us nothing about pace or
 * pausing. Grading it produces noise that the mastery update then treats as
 * signal, and a session of short answers would move Fluency on no information
 * at all.
 */
const MIN_WORDS_FOR_DELIVERY = 8;

/**
 * Clamp client-reported metrics into the physically possible.
 *
 * Not defensive dressing: these values come from a browser and drive a score.
 * Negative durations, word counts that exceed what fits in the time, a pause
 * total longer than the turn — all are either bugs or tampering, and both
 * should end up at a sane number rather than in the learner model.
 */
export function sanitiseMetrics(raw: TurnMetrics): TurnMetrics {
  const totalMs = clamp(raw.totalMs, 0, 10 * 60 * 1000);
  const speechMs = clamp(raw.speechMs, 0, totalMs);
  const pauseMs = clamp(raw.pauseMs, 0, totalMs);

  // 400 words per minute is roughly the fastest a human speaks. Anything above
  // it means the count and the duration disagree, and the count is the one a
  // client can inflate for free.
  const maxPlausibleWords = Math.ceil((totalMs / 60_000) * 400) + 5;

  const wordCount = clamp(Math.round(raw.wordCount), 0, maxPlausibleWords);

  return {
    wordCount,
    speechMs,
    totalMs,
    pauseCount: clamp(Math.round(raw.pauseCount), 0, 500),
    pauseMs,
    hesitationCount: clamp(Math.round(raw.hesitationCount), 0, wordCount),
    responseLatencyMs: clamp(raw.responseLatencyMs, 0, 60_000),
    // At least one sentence if anything was said, and never more sentences
    // than words.
    sentenceCount: clamp(Math.round(raw.sentenceCount), wordCount > 0 ? 1 : 0, wordCount || 1),
  };
}

export function wordsPerMinute(metrics: TurnMetrics): number {
  if (metrics.speechMs <= 0) return 0;
  return (metrics.wordCount / metrics.speechMs) * 60_000;
}

export function pauseRatio(metrics: TurnMetrics): number {
  if (metrics.totalMs <= 0) return 0;
  return clamp(metrics.pauseMs / metrics.totalMs, 0, 1);
}

export function hesitationsPer100Words(metrics: TurnMetrics): number {
  if (metrics.wordCount <= 0) return 0;
  return (metrics.hesitationCount / metrics.wordCount) * 100;
}

export function averageSentenceWords(metrics: TurnMetrics): number {
  if (metrics.sentenceCount <= 0) return 0;
  return metrics.wordCount / metrics.sentenceCount;
}

/**
 * Delivery metrics, expressed as attempts against specific competencies.
 *
 * The important design choice: these do not become a "Delivery" score of their
 * own. Each metric is evidence *about* a competency and updates mastery through
 * the ordinary path, which is what keeps ADR 0002 true — nothing reaches the
 * profile except through mastery, and there is no second route for a number to
 * appear on the dashboard by.
 *
 * `opportunities` is 1 and `correct` is 0 or 1: each metric is one binary
 * observation of whether the learner met the target this turn. Fractional
 * credit would smuggle a score in through a field that is documented as a count.
 */
export function judgeDelivery(
  metrics: TurnMetrics,
  competencies: DeliveryCompetencyMap,
): DeliveryJudgement[] {
  if (metrics.wordCount < MIN_WORDS_FOR_DELIVERY) return [];

  const judgements: DeliveryJudgement[] = [];

  const wpm = wordsPerMinute(metrics);
  judgements.push(
    binary(competencies.speechRate, wpm >= TARGET.wordsPerMinuteFloor, "speech_rate_slow"),
  );

  judgements.push(
    binary(
      competencies.pausing,
      pauseRatio(metrics) <= TARGET.pauseRatioMax,
      "long_pauses",
    ),
  );

  judgements.push(
    binary(
      competencies.hesitation,
      hesitationsPer100Words(metrics) <= TARGET.hesitationsPer100Max,
      "filled_pauses",
    ),
  );

  // Only meaningful when the learner was answering something. A latency of zero
  // on the opening turn of a session is an artefact, not confidence.
  if (metrics.responseLatencyMs > 0) {
    judgements.push(
      binary(
        competencies.responseLatency,
        metrics.responseLatencyMs <= TARGET.responseLatencyMaxMs,
        "slow_to_answer",
      ),
    );
  }

  // Sentence structure's measurable half. Whether the sentences are *correct*
  // is the evaluator's call; whether they are sentences at all is arithmetic.
  // One long run-on and a string of three-word fragments both fail here, which
  // is exactly the distinction the dimension is for.
  const sentenceWords = averageSentenceWords(metrics);
  judgements.push(
    binary(
      competencies.sentenceLength,
      sentenceWords >= TARGET.sentenceWordsFloor &&
        sentenceWords <= TARGET.sentenceWordsCeiling,
      sentenceWords > TARGET.sentenceWordsCeiling ? "run_on" : "fragmentary",
    ),
  );

  return judgements;
}

/**
 * Which competency each delivery metric is evidence about.
 *
 * Supplied by the caller from the seeded curriculum rather than hard-coded, so
 * re-pointing a metric at a different competency is a data change. The mapping
 * itself is from ADR 0006.
 */
export interface DeliveryCompetencyMap {
  speechRate: string;
  pausing: string;
  hesitation: string;
  responseLatency: string;
  sentenceLength: string;
}

function binary(
  competencyId: string,
  met: boolean,
  failureTag: string,
): DeliveryJudgement {
  return {
    competencyId,
    opportunities: 1,
    correct: met ? 1 : 0,
    errorTags: met ? [] : [failureTag],
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
