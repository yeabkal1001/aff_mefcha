import { retrievability } from "../scoring/mastery.js";

/**
 * Choosing what to practise today.
 *
 * Pure, like the scoring code and for the same reason: this is the part that
 * would be quietly wrong. A scheduler that always picks the same three
 * competencies still produces a working product — it just stops teaching, and
 * nothing in the response says so.
 */

export interface Candidate {
  competencyId: string;
  skill: string;
  /** Current estimate, 0..1. */
  mastery: number;
  stabilityDays: number;
  lastSeenAt: Date | null;
  evidenceCount: number;
  /** Pull from the domain's requirements. */
  weight: number;
  /** Whether the curriculum considers it a core requirement of this domain. */
  isCore: boolean;
  /** Prerequisites the learner has not yet reached. */
  blockedBy: readonly string[];
}

export interface ScoredCandidate extends Candidate {
  score: number;
  reason: "review" | "new" | "reinforce";
}

/**
 * Mastery above which something is considered learned rather than in progress.
 *
 * Not 1.0, and not 0.9. The estimate is a probability of success on the next
 * attempt, and holding a learner on a competency until they are near-certain is
 * how a curriculum grinds to a halt on its first difficult item.
 */
const LEARNED = 0.8;

/**
 * A prerequisite is satisfied at a lower bar than "learned".
 *
 * Gating new material on full mastery of everything beneath it means a learner
 * who is merely competent at the basics never sees anything new, which is the
 * most common way an adaptive curriculum stalls.
 */
export const PREREQ_THRESHOLD = 0.6;

/**
 * Retrievability below which a competency is genuinely due.
 *
 * Matches the 0.9 that anchors the stability scale: at exactly one stability
 * interval since the last review, retrievability is 0.9 by construction, so
 * "due" means "past its interval" without a second constant to keep in step.
 */
const DUE_BELOW = 0.9;

/**
 * Score one candidate for inclusion in today's plan.
 *
 * Three cases, in priority order, and the ordering is the pedagogy.
 *
 * **Review comes first.** A competency about to be forgotten is the highest
 * value thing a learner can spend a minute on — recovering it is cheap now and
 * expensive later. The urgency scales with how far past due it is.
 *
 * **Then new material**, gated on prerequisites. Introducing something whose
 * foundations are missing produces a failure that teaches nothing.
 *
 * **Then reinforcement** of things in progress, ordered so the ones closest to
 * the threshold go first — finishing something is worth more than nudging four
 * things along.
 */
export function scoreCandidate(candidate: Candidate, now: Date): ScoredCandidate {
  // Blocked by an unmet prerequisite: not eligible at any price.
  if (candidate.blockedBy.length > 0) {
    return { ...candidate, score: 0, reason: "new" };
  }

  const recall = retrievability(candidate.lastSeenAt, candidate.stabilityDays, now);
  const seen = candidate.evidenceCount > 0;

  if (seen && candidate.mastery >= LEARNED && recall < DUE_BELOW) {
    // Due for review. The further it has decayed the more urgent, and a core
    // requirement of the current domain outranks an incidental one.
    const urgency = 1 - recall;
    return {
      ...candidate,
      score: (100 + urgency * 100) * candidate.weight,
      reason: "review",
    };
  }

  if (!seen) {
    // New. Core requirements of the domain first; everything else is filler
    // that only appears when there is room.
    return {
      ...candidate,
      score: (candidate.isCore ? 60 : 30) * candidate.weight,
      reason: "new",
    };
  }

  if (candidate.mastery < LEARNED) {
    // In progress. Closest to the finish line first.
    const proximity = candidate.mastery / LEARNED;
    return {
      ...candidate,
      score: (40 + proximity * 30) * candidate.weight,
      reason: "reinforce",
    };
  }

  // Learned and not yet due. Nothing to gain today.
  return { ...candidate, score: 1 * candidate.weight, reason: "review" };
}

export interface SelectionOptions {
  /** How many competencies the day has room for. */
  limit: number;
  now: Date;
  /**
   * How many of one skill may appear.
   *
   * Without a cap, a learner weak in grammar gets a day of nothing but grammar
   * — technically optimal against the model and miserable to sit through, and
   * it starves the other three dimensions of the evidence they need to move at
   * all.
   */
  maxPerSkill: number;
}

/**
 * Pick the day's targets.
 *
 * Sorted by score, then filtered for balance. The tie-break on competency ID is
 * not cosmetic: without a total order, two builds of the same plan from the same
 * data can differ, which makes the whole thing untestable and makes "why did my
 * plan change" unanswerable.
 */
export function selectTargets(
  candidates: readonly Candidate[],
  options: SelectionOptions,
): ScoredCandidate[] {
  const scored = candidates
    .map((candidate) => scoreCandidate(candidate, options.now))
    .filter((candidate) => candidate.score > 0 && candidate.blockedBy.length === 0)
    .sort((a, b) => b.score - a.score || a.competencyId.localeCompare(b.competencyId));

  const perSkill = new Map<string, number>();
  const chosen: ScoredCandidate[] = [];

  for (const candidate of scored) {
    if (chosen.length >= options.limit) break;

    const used = perSkill.get(candidate.skill) ?? 0;
    if (used >= options.maxPerSkill) continue;

    perSkill.set(candidate.skill, used + 1);
    chosen.push(candidate);
  }

  return chosen;
}

/**
 * How many exercises fit in the learner's daily budget.
 *
 * Deliberately conservative. A plan that overruns is a plan the learner
 * abandons halfway, and an abandoned session is worse than a short one: it
 * produces less evidence *and* it teaches them that the app wastes their time.
 */
export function exerciseCount(dailyMinutes: number, averageExerciseSeconds = 150): number {
  const budget = Math.max(5, Math.min(90, dailyMinutes)) * 60;
  // A minute of the budget goes on greeting, settling in and the closing
  // reflection, none of which are exercises.
  const usable = Math.max(60, budget - 60);

  return Math.max(1, Math.min(8, Math.floor(usable / averageExerciseSeconds)));
}

/** The competency IDs a set of chosen targets is blocked on, for diagnostics. */
export function unmetPrerequisites(
  competencyId: string,
  prereqs: ReadonlyMap<string, readonly string[]>,
  masteryOf: (id: string) => number,
): string[] {
  return (prereqs.get(competencyId) ?? []).filter(
    (required) => masteryOf(required) < PREREQ_THRESHOLD,
  );
}
