/**
 * The learner profile, derived from onboarding.
 *
 * `OnboardingDraft` is what the learner answered. `LearnerProfile` is what the
 * engine reads. They are not the same object and should not be: the draft is
 * twelve screens of UI state including a half-typed name, and the profile is
 * the resolved set of inputs `buildDayPlan` takes — the `learner_profile` row
 * in `session-engine.md` §11 plus the two things always read alongside it, the
 * Life Path overlay and the load budget.
 *
 * Everything here is a pure function of the draft. There is no state, no
 * fetch, and no storage: when the server exists, `buildLearnerProfile` runs
 * there against the replayed draft and returns this same shape over the wire.
 */

import {
  dailyBudgets,
  lifePathById,
  nativeLanguageById,
  type FeedbackLanguage,
  type Gender,
  type LifePath,
  type LifePathId,
  type OnboardingDraft,
} from "./onboarding";
import type { Cefr } from "./templates";

/**
 * A row of the load table in `session-engine.md` §9.
 *
 * The learner picks minutes; everything else here is derived. The new/review
 * split widens with the budget rather than scaling evenly, because review is
 * what a longer session buys you — ten minutes has no room for it.
 */
export interface LoadBudget {
  minutes: number;
  sessions: number;
  newConcepts: number;
  reviews: number;
}

const LOAD_TABLE: Record<number, Omit<LoadBudget, "minutes">> = {
  10: { sessions: 2, newConcepts: 1, reviews: 1 },
  20: { sessions: 4, newConcepts: 2, reviews: 2 },
  30: { sessions: 5, newConcepts: 2, reviews: 3 },
  45: { sessions: 6, newConcepts: 3, reviews: 3 },
};

export interface LearnerProfile {
  name: string;
  ageBand: string;
  gender: Gender;
  /** ISO code from the native-language list. */
  l1: string;
  /**
   * Pronunciation contrasts this L1 makes hard, carried through from the
   * language entry. Contributes 10% of competency priority, so it changes
   * ordering rather than content.
   */
  l1Risk: string[];
  lifePathId: LifePathId;
  /** Resolved overlay. Custom and planned paths fall back — see `resolvePath`. */
  lifePath: LifePath;
  /** Course, target role, or the goal the learner wrote themselves. */
  studyField: string;
  budget: LoadBudget;
  feedbackLanguage: FeedbackLanguage;
  /** Months to the learner's deadline, or null. */
  goalMonths: number | null;
  /** Measured by the assessment. Never declared. */
  cefr: Cefr;
  /** The six Profile Dimensions: four fixed, two from the path. */
  dimensions: string[];
  /**
   * Whether placement has actually run. Everything downstream is a guess until
   * it has, and the UI is required to say so.
   */
  placed: boolean;
}

/** The four dimensions every learner has, whatever they are practising for. */
export const FIXED_DIMENSIONS = ["Grammar", "Vocabulary", "Pronunciation", "Fluency"];

/**
 * Only A2 content is authored, so placement can only land at A2 today. This is
 * the one constant to change when B1 exists — see ADR 0005, which keeps
 * placement decoupled from seeding precisely so that change is a one-liner.
 */
const MVP_PLACEMENT: Cefr = "A2";

/**
 * A path that can actually supply an overlay.
 *
 * The custom path has no authored config, and the four planned paths have none
 * either, so both inherit Everyday English. This is the single place that
 * fallback happens: a caller that reads `profile.lifePath` always gets
 * something with a real overlay behind it, and `lifePathId` still records what
 * the learner picked so the UI can be honest about it.
 */
function resolvePath(id: LifePathId | null): LifePath {
  const chosen = id ? lifePathById(id) : null;
  const fallback = lifePathById("general_english");

  if (!fallback) throw new Error("general_english must exist as the fallback path");
  if (!chosen || !chosen.live || chosen.id === "custom") return fallback;
  return chosen;
}

function resolveBudget(minutes: number | null): LoadBudget {
  const chosen = minutes ?? dailyBudgets[1].minutes;
  const row = LOAD_TABLE[chosen] ?? LOAD_TABLE[20];
  return { minutes: chosen, ...row };
}

/**
 * Build the profile from what onboarding collected.
 *
 * Defaults are applied rather than errors thrown, because this runs on every
 * render of every screen that reads the profile, including mid-onboarding when
 * half the answers are still null. A screen that wants to know whether the
 * learner has finished should check `placed`, not inspect the fields.
 */
export function buildLearnerProfile(draft: OnboardingDraft): LearnerProfile {
  const lifePath = resolvePath(draft.lifePath);
  const language = draft.l1 ? nativeLanguageById(draft.l1) : null;

  return {
    name: draft.name.trim(),
    ageBand: draft.ageBand ?? "18_24",
    gender: draft.gender ?? "unspecified",
    l1: language?.id ?? "other",
    l1Risk: language?.interference ?? [],
    lifePathId: draft.lifePath ?? "general_english",
    lifePath,
    studyField: draft.studyField.trim(),
    budget: resolveBudget(draft.dailyMinutes),
    feedbackLanguage: draft.feedbackLanguage ?? "english",
    goalMonths: goalMonths(draft.goalHorizon),
    cefr: (draft.cefr as Cefr | null) ?? MVP_PLACEMENT,
    dimensions: [...FIXED_DIMENSIONS, ...lifePath.dimensions],
    placed: draft.assessmentComplete,
  };
}

function goalMonths(horizon: string | null): number | null {
  switch (horizon) {
    case "weeks":
      return 1;
    case "quarter":
      return 3;
    case "half":
      return 6;
    default:
      return null;
  }
}

/**
 * How the learner should be referred to in generated copy.
 *
 * The only thing the gender answer is used for, kept in one function so that
 * stays true and is checkable.
 */
export function pronouns(profile: LearnerProfile): {
  subject: string;
  object: string;
  possessive: string;
} {
  switch (profile.gender) {
    case "woman":
      return { subject: "she", object: "her", possessive: "her" };
    case "man":
      return { subject: "he", object: "him", possessive: "his" };
    default:
      return { subject: "they", object: "them", possessive: "their" };
  }
}
