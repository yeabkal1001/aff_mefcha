/**
 * The thirty-day outline.
 *
 * Read `docs/adr/0007-the-outline-is-a-projection.md` before changing
 * anything here, because there is a decision underneath this file that is easy
 * to undo by accident.
 *
 * The short version: a thirty-day *plan* cannot exist. `buildDayPlan` reads
 * mastery, retrievability and prerequisite state, none of which are knowable
 * for day nine on day one, and ADR 0001 removed the stored plan for exactly
 * that reason. What *can* exist — and what the engine already says is computed
 * on demand — is the arc: which domains, in which order, and what the learner
 * will be able to do at the end of each. That is a projection over the
 * curriculum, not a schedule of sessions.
 *
 * Three properties keep it honest, and each is load-bearing:
 *
 *   1. It is a pure function. Nothing is stored, so nothing can go stale.
 *   2. It names domains and objectives, never competencies or templates. Those
 *      are chosen the morning of, from evidence that does not exist yet.
 *   3. It reshapes as the learner practises. Pass real progress and the same
 *      function returns a different arc — faster if they are ahead, longer if
 *      a domain is taking them time. The screen says so out loud.
 */

import { orderedDomains, type Domain } from "./domains";
import type { LearnerProfile } from "./learner-profile";

export interface OutlinePhase {
  /** 1-indexed, inclusive. */
  startDay: number;
  endDay: number;
  domain: Domain;
  /** The domain's contexts after the Life Path renames them. */
  theme: string;
  /** What the learner will be able to do by `endDay`. */
  objectives: string[];
  /** Activities across the phase, from the daily budget. */
  activities: number;
}

export interface StudyOutline {
  days: number;
  phases: OutlinePhase[];
  /** Total practice minutes if the learner keeps to their budget. */
  totalMinutes: number;
  totalActivities: number;
  /**
   * Whether the band underneath this is measured or assumed. False until the
   * assessment has run, and the screen is required to say so — an outline
   * built on a guessed level is a guess.
   */
  placed: boolean;
  /** True when the learner's daily budget reaches B1 territory within the window. */
  reachesNextBand: boolean;
}

const OUTLINE_DAYS = 30;

/**
 * Domain length scales with the daily budget, but sub-linearly.
 *
 * Someone practising 45 minutes a day does not finish a domain three times
 * faster than someone doing 10 — the limit is consolidation and spaced
 * retrieval, not minutes on the clock, and `R(c, date)` decays on wall-clock
 * days regardless of how hard the learner worked. So the exponent is well
 * under 1, and a bigger budget buys depth and review rather than speed.
 */
function daysForDomain(domain: Domain, minutesPerDay: number): number {
  const ratio = minutesPerDay / 20;
  const scaled = domain.estimatedDays / Math.pow(ratio, 0.45);
  return Math.max(3, Math.round(scaled));
}

/**
 * Apply the Life Path to a domain's practice contexts.
 *
 * The engine does this through `context_substitutions`, authored per path. The
 * client has no substitution table, so it composes the domain's own context
 * with the learner's field — the same shape of output, from data the browser
 * actually has. When the server owns this, the function goes away.
 */
function themeFor(domain: Domain, profile: LearnerProfile): string {
  const context = domain.contexts[0];
  if (!profile.studyField) return context;

  switch (profile.lifePathId) {
    case "university_success":
      return `${context}, on campus and in ${profile.studyField} classes`;
    case "hospitality":
      return `${context}, as a ${profile.studyField.toLowerCase()}`;
    default:
      return `${context}, around ${profile.studyField.toLowerCase()}`;
  }
}

/**
 * Project the next thirty days.
 *
 * `completedDomainIds` is how the outline reshapes: pass what the learner has
 * finished and the projection starts from where they actually are. Empty on
 * day one, and that is the only reason day one looks tidy.
 */
export function projectOutline(
  profile: LearnerProfile,
  completedDomainIds: string[] = [],
): StudyOutline {
  const completed = new Set(completedDomainIds);
  const remaining = orderedDomains(profile.lifePathId, profile.cefr).filter(
    (domain) => !completed.has(domain.id),
  );

  const phases: OutlinePhase[] = [];
  let day = 1;

  for (const domain of remaining) {
    if (day > OUTLINE_DAYS) break;

    const length = daysForDomain(domain, profile.budget.minutes);
    const endDay = Math.min(OUTLINE_DAYS, day + length - 1);

    phases.push({
      startDay: day,
      endDay,
      domain,
      theme: themeFor(domain, profile),
      objectives: domain.objectives,
      activities: (endDay - day + 1) * profile.budget.sessions,
    });

    day = endDay + 1;
  }

  const totalActivities = phases.reduce((sum, phase) => sum + phase.activities, 0);

  return {
    days: OUTLINE_DAYS,
    phases,
    totalMinutes: OUTLINE_DAYS * profile.budget.minutes,
    totalActivities,
    placed: profile.placed,
    /**
     * Promotion needs every `core` competency in the band's domains at mastery
     * ≥ 0.75 with `evidence_count` ≥ 3. Covering all six A2 domains inside the
     * window is the necessary condition, not the sufficient one, so this is
     * phrased as a possibility on screen rather than a promise.
     */
    reachesNextBand: phases.length === orderedDomains(profile.lifePathId, profile.cefr).length,
  };
}

/** "Days 1–7", for a phase header. */
export function phaseRange(phase: OutlinePhase): string {
  return phase.startDay === phase.endDay
    ? `Day ${phase.startDay}`
    : `Days ${phase.startDay}–${phase.endDay}`;
}
