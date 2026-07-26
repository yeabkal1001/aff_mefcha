import type { Learner, UpdateProfileInput } from "@/lib/api/schemas";
import { emptyDraft, goalHorizons, type OnboardingDraft } from "@/lib/onboarding";

/**
 * Turn eleven answers on a device into one profile update.
 *
 * The translation is here rather than at either end because neither end should
 * own it. The onboarding vocabulary is the product's — `35_plus`, `woman`,
 * `both` — chosen because those are the words on the buttons. The server's is
 * the domain's, and it is an enum. Letting either leak into the other would
 * mean renaming a button becomes a database migration.
 *
 * Only fields the learner actually answered are included, because the endpoint
 * PATCHes: sending `null` for a skipped question would overwrite a real answer
 * from a previous device with an absence.
 */

const AGE_BANDS: Record<string, NonNullable<UpdateProfileInput["ageBand"]>> = {
  "13_17": "UNDER_18",
  "18_24": "AGE_18_24",
  "25_34": "AGE_25_34",
  "35_plus": "AGE_35_49",
};

const GENDERS: Record<string, NonNullable<UpdateProfileInput["gender"]>> = {
  woman: "FEMALE",
  man: "MALE",
  unspecified: "UNDISCLOSED",
};

const FEEDBACK: Record<string, NonNullable<UpdateProfileInput["feedbackLanguage"]>> = {
  english: "ENGLISH",
  both: "BILINGUAL",
};

export function draftToProfile(draft: OnboardingDraft): UpdateProfileInput {
  const update: UpdateProfileInput = {};

  if (draft.name.trim()) update.displayName = draft.name.trim();
  if (draft.l1) update.l1 = draft.l1;
  if (draft.ageBand && AGE_BANDS[draft.ageBand]) update.ageBand = AGE_BANDS[draft.ageBand];
  if (draft.gender && GENDERS[draft.gender]) update.gender = GENDERS[draft.gender];
  if (draft.lifePath) update.lifePathId = draft.lifePath;
  if (draft.studyField.trim()) update.studyField = draft.studyField.trim();
  if (draft.dailyMinutes) update.dailyMinutes = draft.dailyMinutes;
  if (draft.feedbackLanguage && FEEDBACK[draft.feedbackLanguage]) {
    update.feedbackLanguage = FEEDBACK[draft.feedbackLanguage];
  }

  // The placement assessment's result. Only sent once it has actually run —
  // before that the level on the device is a default, and writing it would
  // record a guess as a measurement.
  if (draft.assessmentComplete && isCefr(draft.cefr)) update.cefr = draft.cefr;

  const goal = goalDate(draft.goalHorizon);
  if (goal) update.goalDate = goal;

  // The browser knows the learner's timezone and the server has to guess it.
  // It decides when "today" starts, which decides when a streak breaks.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone) update.timezone = timezone;

  return update;
}

/**
 * The same translation backwards, for screens that project from a profile.
 *
 * The thirty-day outline is derived from the learner's own answers, and before
 * an account exists those answers are the local draft. Afterwards they are the
 * server's, which may have been changed in settings or set on another device —
 * so the outline has to be able to read either, and this is the adapter that
 * lets one projection serve both.
 */
export function profileToDraft(learner: Learner): OnboardingDraft {
  const { profile } = learner;

  return {
    ...emptyDraft,
    name: learner.displayName ?? "",
    ageBand: reverse(AGE_BANDS, profile.ageBand),
    gender: reverse(GENDERS, profile.gender),
    l1: profile.l1,
    lifePath: profile.lifePathId,
    studyField: profile.studyField ?? "",
    dailyMinutes: profile.dailyMinutes,
    feedbackLanguage: reverse(FEEDBACK, profile.feedbackLanguage) as
      | "english"
      | "both"
      | null,
    // `placedAt` is the only honest source for this. A CEFR is stored from the
    // moment the account exists — it defaults to A2 — so treating its presence
    // as placement would report every new learner as measured.
    assessmentComplete: profile.placedAt !== null,
    cefr: profile.placedAt ? profile.cefr : null,
  } as OnboardingDraft;
}

/** Look up the product's word for one of the domain's enum values. */
function reverse<T extends string>(
  map: Record<string, T>,
  value: T | null,
): string | null {
  if (value === null) return null;
  return Object.entries(map).find(([, mapped]) => mapped === value)?.[0] ?? null;
}

/**
 * The draft's CEFR is a plain string on the way in — it comes from storage,
 * which anything can write to. Narrowing here rather than asserting means a
 * tampered value is dropped instead of being sent to the server.
 */
function isCefr(value: string | null): value is NonNullable<UpdateProfileInput["cefr"]> {
  return value !== null && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(value);
}

/** "One to three months" as a date, since the server stores a deadline. */
function goalDate(horizonId: string | null): string | undefined {
  if (!horizonId) return undefined;

  const months = goalHorizons.find((horizon) => horizon.id === horizonId)?.months;
  if (months == null) return undefined;

  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}
