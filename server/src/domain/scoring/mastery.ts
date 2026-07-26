import type { Skill } from "@prisma/client";

/**
 * The learner model: how one piece of evidence changes one estimate.
 *
 * Pure functions over plain data. Nothing here touches the database, the clock
 * or a provider, which is what makes the pedagogy the most heavily tested part
 * of the codebase — and it should be, because it is the part that would be
 * silently wrong. A broken endpoint throws; a broken mastery update just
 * produces numbers, and nobody can tell by looking that they are the wrong ones.
 */

/** One graded competency judgement, as stored on an `Attempt`. */
export interface Evidence {
  /** How many chances the learner had to demonstrate it in this turn. */
  opportunities: number;
  /** How many they took. */
  correct: number;
  /** 0 unaided, higher with more help showing. */
  scaffoldLevel: number;
  /** How well this template measures this skill, 0..1. */
  reliability: number;
  /** Same template as last time? Same backdrop? Weaker evidence if so. */
  repeatedTemplate: boolean;
  repeatedTheme: boolean;
}

export interface MasteryState {
  /** Probability of success next time, 0..1. */
  mastery: number;
  /** Days until this needs review. Grows with successful recall. */
  stabilityDays: number;
  /** Final attempts that have contributed. */
  evidenceCount: number;
}

/**
 * Below this many observations, a competency has an estimate but not a claim.
 *
 * The dashboard shows "not yet assessed" rather than a number, because two
 * correct answers out of two is 100% and saying so is a lie the learner will
 * catch. This is the honesty threshold, not a tuning parameter.
 */
export const MIN_EVIDENCE_FOR_DISPLAY = 3;

/**
 * How fast an estimate moves.
 *
 * Decays with evidence: the first observation about a competency should move
 * the estimate a long way, the twentieth should barely nudge it. Without the
 * decay a learner who has demonstrated something fifteen times drops to
 * "struggling" on one bad morning, which is both wrong and demoralising.
 *
 * The constant sets how quickly confidence accumulates. At `evidenceCount` 0
 * the rate is 0.5, at 3 it is 0.25, at 9 it is 0.1 — roughly a week of
 * practice to settle.
 */
function learningRate(evidenceCount: number): number {
  return 3 / (3 + evidenceCount) / 2;
}

/**
 * What this evidence is worth, 0..1.
 *
 * Four independent discounts, multiplied. Each one answers "would a teacher
 * count this as fully as an unaided answer on fresh material?" and the answer
 * is no in all four cases.
 */
export function evidenceWeight(evidence: Evidence): number {
  // How well the exercise measures the skill at all.
  let weight = clamp01(evidence.reliability);

  // Help showing. A correct answer with the sentence frame on screen is real
  // but partial evidence; by the third rung it is close to a reading exercise.
  weight *= Math.max(0.25, 1 - 0.25 * evidence.scaffoldLevel);

  // Variety penalties. The same competency, drilled through the same template
  // against the same backdrop, increasingly measures familiarity with the
  // exercise rather than command of the language — which is the exact failure
  // mode of every app that drills one sentence pattern to death.
  if (evidence.repeatedTemplate) weight *= 0.8;
  if (evidence.repeatedTheme) weight *= 0.9;

  return clamp01(weight);
}

/**
 * Fold one attempt into an estimate.
 *
 * Zero opportunities returns the state untouched. That is the important case:
 * it means the turn produced no evidence about this competency, which is not
 * the same as evidence of failure, and treating it as a zero is how a learner
 * gets marked down for a question that never came up.
 */
export function applyEvidence(state: MasteryState, evidence: Evidence): MasteryState {
  if (evidence.opportunities <= 0) return state;

  const observed = clamp01(evidence.correct / evidence.opportunities);
  const weight = evidenceWeight(evidence);
  const rate = learningRate(state.evidenceCount) * weight;

  const mastery = clamp01(state.mastery + rate * (observed - state.mastery));

  return {
    mastery,
    stabilityDays: nextStability(state, observed, weight),
    // Counted in whole observations regardless of weight: this measures how
    // much we have seen, and the weight already discounts how much it moved.
    evidenceCount: state.evidenceCount + 1,
  };
}

/**
 * How long before this needs revisiting.
 *
 * Spaced repetition, in the shape everything since SM-2 has used: a successful
 * recall multiplies the interval, a failure collapses it. The multiplier is
 * scaled by how convincing the success was, so a shaky pass extends the
 * interval less than a clean one — which is what stops the schedule racing
 * ahead of a learner who is technically passing.
 */
function nextStability(state: MasteryState, observed: number, weight: number): number {
  const PASS = 0.7;

  if (observed < PASS) {
    // Failure resets hard but never to zero: even a failed recall is a
    // rehearsal, and re-showing it in an hour is not how anybody learns.
    return Math.max(1, state.stabilityDays * 0.4);
  }

  // Between 1.3x on a bare pass and 2.5x on a confident one.
  const growth = 1.3 + 1.2 * ((observed - PASS) / (1 - PASS)) * weight;

  // Six months is enough. Beyond it the estimate is stale rather than strong,
  // and the curriculum will have moved on anyway.
  return Math.min(180, state.stabilityDays * growth);
}

/**
 * When this competency should next be reviewed.
 *
 * Materialised onto `LearnerCompetency.dueAt` so the scheduler's "what is due"
 * query is an index seek. Computed in the same transaction as its inputs, so
 * it cannot drift out of step with them.
 */
export function dueAtFrom(lastSeenAt: Date, stabilityDays: number): Date {
  return new Date(lastSeenAt.getTime() + stabilityDays * 24 * 60 * 60 * 1000);
}

/**
 * How likely the learner is to still have it, right now.
 *
 * The exponential forgetting curve, normalised so that retrievability is
 * exactly 0.9 when the interval equals stability — which is what makes
 * "stability" mean something concrete rather than being an arbitrary scale.
 * Used to order the day's review, not displayed.
 */
export function retrievability(
  lastSeenAt: Date | null,
  stabilityDays: number,
  now: Date,
): number {
  if (!lastSeenAt) return 0;

  const elapsedDays = (now.getTime() - lastSeenAt.getTime()) / (24 * 60 * 60 * 1000);
  if (elapsedDays <= 0) return 1;

  return Math.exp((Math.log(0.9) * elapsedDays) / Math.max(0.5, stabilityDays));
}

// --- Profile Dimensions ----------------------------------------------------

/** One competency's contribution to a dimension. */
export interface DimensionInput {
  skill: Skill;
  observable: boolean;
  mastery: number;
  evidenceCount: number;
  /** Pull within the dimension. Core curriculum competencies weigh more. */
  weight: number;
}

export interface DimensionScore {
  skill: Skill;
  /**
   * 0..100, or null for "not yet assessed".
   *
   * Null rather than 0 because they mean opposite things to a learner, and a
   * dashboard that opens on four zeroes reads as failure before they have said
   * a word.
   */
  percent: number | null;
  /** How many competencies actually contributed. */
  observedCount: number;
  /** How many exist in this dimension at the learner's level. */
  totalCount: number;
}

/**
 * Roll competency estimates up into the four numbers on the dashboard.
 *
 * Three rules, all of which exist to stop the screen lying.
 *
 * Unobservable competencies are excluded rather than counted as zero — nothing
 * in this stack can produce evidence for them, and a permanent zero dragging
 * down a dimension is a score for our tooling, not the learner.
 *
 * Competencies below the evidence threshold are excluded too, so a dimension
 * is computed from what has actually been measured.
 *
 * And a dimension with nothing left after both filters reports null. It says
 * "not yet assessed", which is true, instead of 0%, which is not.
 *
 * Nothing reaches this function except mastery. That is ADR 0002, and it is why
 * the dashboard cannot drift out of sync with the learner model: there is no
 * second path for a number to arrive by.
 */
export function computeDimension(
  skill: Skill,
  inputs: readonly DimensionInput[],
): DimensionScore {
  const eligible = inputs.filter((input) => input.skill === skill && input.observable);
  const assessed = eligible.filter(
    (input) => input.evidenceCount >= MIN_EVIDENCE_FOR_DISPLAY,
  );

  if (assessed.length === 0) {
    return { skill, percent: null, observedCount: 0, totalCount: eligible.length };
  }

  const totalWeight = assessed.reduce((sum, input) => sum + input.weight, 0);

  // Guard against an authoring mistake — a set of competencies all weighted
  // zero would otherwise divide by zero and put NaN on the dashboard.
  if (totalWeight <= 0) {
    return { skill, percent: null, observedCount: 0, totalCount: eligible.length };
  }

  const weighted = assessed.reduce(
    (sum, input) => sum + input.mastery * input.weight,
    0,
  );

  return {
    skill,
    percent: Math.round((weighted / totalWeight) * 100),
    observedCount: assessed.length,
    totalCount: eligible.length,
  };
}

/** All four, in the order the dashboard shows them. */
export const DISPLAY_ORDER: readonly Skill[] = [
  "GRAMMAR",
  "VOCABULARY",
  "FLUENCY",
  "SENTENCE_STRUCTURE",
] as const;

export function computeProfile(inputs: readonly DimensionInput[]): DimensionScore[] {
  return DISPLAY_ORDER.map((skill) => computeDimension(skill, inputs));
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
