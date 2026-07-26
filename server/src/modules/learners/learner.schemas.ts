import { z } from "zod";

import { text } from "../../http/middleware/validate.js";

/**
 * The wire contract for everything learner-shaped.
 *
 * Schemas are the API's type system, and they run in both directions: they
 * validate what comes in and they *shape* what goes out. Deriving the response
 * type from a schema rather than returning a Prisma row is what stops a column
 * added to the database from silently appearing in a public response — the
 * mechanism by which `clerkUserId` or a soft-delete timestamp leaks.
 */

// --- shared enums, mirroring the Prisma ones -------------------------------
//
// Restated rather than imported from `@prisma/client` on purpose. These are the
// public contract; the database enum is an implementation detail. Keeping them
// separate means renaming a database value is not automatically a breaking API
// change, and the compiler catches the mismatch at the mapping site.

export const cefrSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const ageBandSchema = z.enum([
  "UNDER_18",
  "AGE_18_24",
  "AGE_25_34",
  "AGE_35_49",
  "AGE_50_PLUS",
]);

export const genderSchema = z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]);

/** English only, or English plus the learner's first language. See the enum. */
export const feedbackLanguageSchema = z.enum(["ENGLISH", "BILINGUAL"]);

export const skillSchema = z.enum([
  "GRAMMAR",
  "VOCABULARY",
  "FLUENCY",
  "SENTENCE_STRUCTURE",
]);

// --- profile ---------------------------------------------------------------

/**
 * What onboarding writes.
 *
 * Every field optional, because onboarding saves as it goes: a learner who
 * abandons after three questions should keep those three answers. `.strict()`
 * is the mass-assignment guard — an unrecognised key is rejected outright
 * rather than silently dropped, so a client sending `"role": "ADMIN"` gets a
 * 400 that we can see in the logs instead of a quiet no-op we cannot.
 */
export const updateProfileSchema = z
  .object({
    displayName: text(80).nullish(),
    l1: z
      .string()
      .trim()
      .length(2, "must be a two-letter language code")
      .toLowerCase()
      .optional(),
    ageBand: ageBandSchema.nullish(),
    gender: genderSchema.optional(),
    lifePathId: z
      .string()
      .trim()
      .max(64)
      .regex(/^[a-z0-9_]+$/, "is not a valid Life Path")
      .nullish(),
    studyField: text(120).nullish(),
    /**
     * Bounded at both ends. Five minutes is the shortest session that fits a
     * warm-up and one exercise; ninety is past the point where more practice
     * helps, and an unbounded value would let a client ask the planner to
     * assemble an arbitrarily large day.
     */
    dailyMinutes: z.coerce.number().int().min(5).max(90).optional(),
    feedbackLanguage: feedbackLanguageSchema.optional(),
    goalDate: z.coerce
      .date()
      .refine((date) => date.getTime() > Date.now(), "must be in the future")
      .nullish(),
    timezone: z
      .string()
      .trim()
      .max(64)
      // Validated against the runtime's own tz database rather than a regex.
      // A plausible-looking but unknown zone would otherwise be stored and then
      // throw at the point a day plan is built, far from the mistake.
      .refine(isKnownTimezone, "is not a recognised time zone")
      .optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

// --- responses -------------------------------------------------------------

/**
 * The learner as the client sees them.
 *
 * Note what is absent: `clerkUserId`, `deletedAt`, `role`. The first is an
 * internal join key, the second is an implementation detail of deletion, and
 * the third would tell a curious client that elevated roles exist.
 */
export const learnerResponseSchema = z.object({
  id: z.string().uuid(),
  /// Null in the window between provisioning and the Clerk webhook arriving.
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  profile: z.object({
    cefr: cefrSchema,
    l1: z.string(),
    ageBand: ageBandSchema.nullable(),
    gender: genderSchema,
    lifePathId: z.string().nullable(),
    studyField: z.string().nullable(),
    dailyMinutes: z.number().int(),
    feedbackLanguage: feedbackLanguageSchema,
    goalDate: z.string().nullable(),
    timezone: z.string(),
    /** Null until placement has run. The profile screen says so rather than
        implying A2 was measured. */
    placedAt: z.string().datetime().nullable(),
  }),
});

export type LearnerResponse = z.infer<typeof learnerResponseSchema>;

/** One of the four numbers on the dashboard. */
export const dimensionSchema = z.object({
  skill: skillSchema,
  /** Null means "not yet assessed", which is not the same as zero. */
  percent: z.number().int().min(0).max(100).nullable(),
  observedCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
});

export const profileResponseSchema = z.object({
  dimensions: z.array(dimensionSchema),
  /** Totals across the learner's history, for the progress card. */
  totals: z.object({
    sessionsCompleted: z.number().int().min(0),
    turnsSpoken: z.number().int().min(0),
    speakingSeconds: z.number().int().min(0),
    corrections: z.number().int().min(0),
    /** Consecutive days with a completed plan, counting back from today. */
    streakDays: z.number().int().min(0),
  }),
});

export type ProfileResponse = z.infer<typeof profileResponseSchema>;
