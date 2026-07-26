import { z } from "zod";

import { sceneIds } from "@/components/session/stimulus/scene-ids";
import type { StimulusSpec } from "@/components/session/stimulus/types";

/**
 * The wire format, validated.
 *
 * Everything crossing the network boundary is parsed here before any component
 * sees it. That is not ceremony: a silently-renamed field surfaces as one
 * legible error at the seam rather than as `undefined` three components deep,
 * and these schemas are the only description of the server's responses that
 * the browser can actually enforce.
 *
 * Where a shape already exists as a hand-written interface — `StimulusSpec` is
 * the big one, and its per-variant documentation is worth keeping — the
 * interface stays authoritative and the schema is pinned to it with
 * `satisfies z.ZodType<T>`. Divergence then fails to compile.
 *
 * Names match the server's JSON exactly. Renaming on the way in would mean two
 * vocabularies for one field and a translation layer nobody maintains.
 */

/* ---------------------------------------------------------------------------
   Shared vocabulary

   These four Skills are fixed. See CONTEXT.md and ADR 0006: they are the
   dimensions the product measures, and nothing else becomes one.
   --------------------------------------------------------------------------- */

export const skillSchema = z.enum([
  "GRAMMAR",
  "VOCABULARY",
  "FLUENCY",
  "SENTENCE_STRUCTURE",
]);
export type Skill = z.infer<typeof skillSchema>;

export const cefrSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type Cefr = z.infer<typeof cefrSchema>;

/* ---------------------------------------------------------------------------
   Stimulus
   --------------------------------------------------------------------------- */

const sceneIdSchema = z.enum(sceneIds);

const baseStimulus = { instruction: z.string() };

export const stimulusSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseStimulus,
    kind: z.literal("image"),
    scene: sceneIdSchema,
    description: z.string(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("image_pair"),
    left: z.object({ scene: sceneIdSchema, label: z.string() }),
    right: z.object({ scene: sceneIdSchema, label: z.string() }),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("image_sequence"),
    steps: z.array(z.object({ scene: sceneIdSchema, caption: z.string() })),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("audio"),
    src: z.string().url().optional(),
    seconds: z.number().positive(),
    transcript: z.string().optional(),
    replaysAllowed: z.number().int().nonnegative(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("audio_question"),
    question: z.string(),
    src: z.string().url().optional(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("text"),
    prompt: z.string(),
    hints: z.array(z.string()).optional(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("choice"),
    situation: z.string(),
    options: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        detail: z.string().optional(),
      }),
    ),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("statement"),
    statement: z.string(),
    assignedSide: z.enum(["for", "against"]).optional(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("topic"),
    topic: z.string(),
    beats: z.array(z.string()),
    prepSeconds: z.number().int().nonnegative(),
  }),
  z.object({
    ...baseStimulus,
    kind: z.literal("scenario"),
    setting: z.string(),
    learnerRole: z.string(),
    coachRole: z.string(),
    objective: z.string(),
  }),
]) satisfies z.ZodType<StimulusSpec>;

/* ---------------------------------------------------------------------------
   The learner — GET/PATCH /v1/me
   --------------------------------------------------------------------------- */

export const learnerProfileSchema = z.object({
  cefr: cefrSchema,
  /** First language, as an ISO code. `am` for the launch cohort. */
  l1: z.string(),
  ageBand: z.enum(["UNDER_18", "AGE_18_24", "AGE_25_34", "AGE_35_49", "AGE_50_PLUS"]).nullable(),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]),
  lifePathId: z.string().nullable(),
  studyField: z.string().nullable(),
  dailyMinutes: z.number().int().positive(),
  /**
   * English only, or English plus the learner's first language. Which second
   * language is not a separate setting — it is `l1`, two fields up.
   */
  feedbackLanguage: z.enum(["ENGLISH", "BILINGUAL"]),
  goalDate: z.string().nullable(),
  timezone: z.string(),
  /** Null until the placement assessment has run. Everything before it is a guess. */
  placedAt: z.string().nullable(),
});
export type LearnerProfile = z.infer<typeof learnerProfileSchema>;

export const learnerSchema = z.object({
  id: z.string().uuid(),
  /** Null in the window between sign-up and Clerk's webhook reaching us. */
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  createdAt: z.string(),
  profile: learnerProfileSchema,
});
export type Learner = z.infer<typeof learnerSchema>;

/** Everything the settings screen may change. Every field optional: it PATCHes. */
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  l1: z.string().min(2).max(8).optional(),
  ageBand: learnerProfileSchema.shape.ageBand.unwrap().optional(),
  gender: learnerProfileSchema.shape.gender.optional(),
  lifePathId: z.string().min(1).max(64).optional(),
  studyField: z.string().max(120).optional(),
  dailyMinutes: z.number().int().min(5).max(120).optional(),
  feedbackLanguage: learnerProfileSchema.shape.feedbackLanguage.optional(),
  goalDate: z.string().optional(),
  timezone: z.string().min(1).max(64).optional(),
  cefr: cefrSchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* ---------------------------------------------------------------------------
   The Communication Profile — GET /v1/me/profile
   --------------------------------------------------------------------------- */

export const dimensionSchema = z.object({
  skill: skillSchema,
  /**
   * Null means "not yet assessed", and it is not the same as zero. Four zeroes
   * on a first visit read as four failures; four dashes read as a beginning.
   */
  percent: z.number().min(0).max(100).nullable(),
  /** How many competencies carry evidence, so the UI can say why it is null. */
  observedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});
export type Dimension = z.infer<typeof dimensionSchema>;

export const communicationProfileSchema = z.object({
  dimensions: z.array(dimensionSchema).length(4),
  totals: z.object({
    sessionsCompleted: z.number().int().nonnegative(),
    turnsSpoken: z.number().int().nonnegative(),
    /** Seconds, not minutes. Rounding is the screen's business, not the wire's. */
    speakingSeconds: z.number().int().nonnegative(),
    corrections: z.number().int().nonnegative(),
    streakDays: z.number().int().nonnegative(),
  }),
});
export type CommunicationProfile = z.infer<typeof communicationProfileSchema>;

/**
 * The label for a dimension, decided here rather than sent by the server.
 *
 * UI copy is not the API's business, and a server that ships display strings is
 * a server you have to redeploy to fix a typo.
 */
export const SKILL_LABEL: Record<Skill, string> = {
  GRAMMAR: "Grammar",
  VOCABULARY: "Vocabulary",
  FLUENCY: "Fluency",
  SENTENCE_STRUCTURE: "Sentence structure",
};

/* ---------------------------------------------------------------------------
   Today's Mission — GET /v1/today
   --------------------------------------------------------------------------- */

export const sessionStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const targetSchema = z.object({
  competencyId: z.string(),
  name: z.string(),
  skill: skillSchema,
  role: z.enum(["CORE", "SUPPORTING", "INCIDENTAL"]),
});
export type Target = z.infer<typeof targetSchema>;

export const activitySchema = z.object({
  id: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  status: sessionStatusSchema,
  /** What the coach opens with. Already substituted with the day's theme. */
  prompt: z.string(),
  /**
   * Nullable because not every template has one. A conversation exercise is a
   * question asked aloud and nothing on screen; only the picture-description
   * and listening families need a stimulus.
   */
  stimulus: stimulusSpecSchema.nullable(),
  templateId: z.string(),
  targets: z.array(targetSchema),
});
export type Activity = z.infer<typeof activitySchema>;

export const todaySchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  /** The substituted Practice Context that gives the day its single story. */
  theme: z.string(),
  completedAt: z.string().nullable(),
  domain: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  activities: z.array(activitySchema).min(1),
});
export type Today = z.infer<typeof todaySchema>;

/* ---------------------------------------------------------------------------
   A turn — POST /v1/sessions/:id/turns, POST /v1/turns/:id/evaluate
   --------------------------------------------------------------------------- */

/**
 * What the browser measured about the utterance.
 *
 * Measured in the browser because that is the only place the timing exists:
 * Web Speech gives a transcript, not word timings, and the gaps between
 * results are the only signal about pausing there is. The server clamps every
 * one of these before believing it — see `sanitiseMetrics` — because they are
 * client-reported numbers that move a score.
 */
export const turnMetricsSchema = z.object({
  wordCount: z.number().int().nonnegative(),
  /** Milliseconds with voice present, excluding pauses. */
  speechMs: z.number().nonnegative(),
  /** Wall-clock length of the whole turn. */
  totalMs: z.number().nonnegative(),
  pauseCount: z.number().int().nonnegative(),
  pauseMs: z.number().nonnegative(),
  /** Occurrences of um/uh/eh, counted from the transcript. */
  hesitationCount: z.number().int().nonnegative(),
  /** Between the coach finishing and the learner starting. */
  responseLatencyMs: z.number().nonnegative(),
  sentenceCount: z.number().int().nonnegative(),
});
export type TurnMetrics = z.infer<typeof turnMetricsSchema>;

export const turnReplySchema = z.object({
  turnId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  /** What the coach says back. This is the text that gets spoken. */
  coachReply: z.string(),
  /** The director thinks the exercise has run its course. */
  suggestsComplete: z.boolean(),
});
export type TurnReply = z.infer<typeof turnReplySchema>;

export const correctionSchema = z.object({
  /** What the learner actually said — the verbatim transcript of the turn. */
  said: z.string(),
  /** The slice of `said` that was wrong. The card highlights it in place. */
  errorSpan: z.string(),
  /** The repaired sentence. */
  corrected: z.string(),
  /** One plain sentence of why, in the learner's feedback language. */
  why: z.string(),
  /** Which sub-competency this judged, such as `G006.01`. */
  competencyId: z.string(),
});
export type Correction = z.infer<typeof correctionSchema>;

export const evaluationSchema = z.object({
  /** The utterance with disfluencies removed, as the transcript panel shows it. */
  cleanedTranscript: z.string(),
  corrections: z.array(correctionSchema),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

/* ---------------------------------------------------------------------------
   History — GET /v1/history, GET /v1/history/corrections
   --------------------------------------------------------------------------- */

export const historyDaySchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  theme: z.string(),
  domain: z.string(),
  completedAt: z.string().nullable(),
  activities: z.array(
    z.object({
      id: z.string().uuid(),
      orderIndex: z.number().int().nonnegative(),
      status: sessionStatusSchema,
      prompt: z.string(),
      turnCount: z.number().int().nonnegative(),
    }),
  ),
});
export type HistoryDay = z.infer<typeof historyDaySchema>;

export const pastCorrectionSchema = z.object({
  id: z.string().uuid(),
  at: z.string(),
  date: z.string(),
  sessionId: z.string().uuid(),
  skill: skillSchema,
  competency: z.string(),
  said: z.string(),
  better: z.string().nullable(),
  errorTags: z.array(z.string()),
  observed: z.number().min(0).max(1).nullable(),
});
export type PastCorrection = z.infer<typeof pastCorrectionSchema>;

/** Cursor pagination, uniform across every list the API returns. */
export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    /** Null at the end of the list. Absent would be indistinguishable from a bug. */
    nextCursor: z.string().nullable(),
  });
}

/* ---------------------------------------------------------------------------
   Session detail — GET /v1/sessions/:id
   --------------------------------------------------------------------------- */

export const sessionDetailSchema = z.object({
  id: z.string().uuid(),
  status: sessionStatusSchema,
  prompt: z.string(),
  spec: stimulusSpecSchema.nullable(),
  theme: z.string(),
  targets: z.array(targetSchema),
  turns: z.array(
    z.object({
      id: z.string().uuid(),
      index: z.number().int().nonnegative(),
      learner: z.string(),
      learnerPolished: z.string().nullable(),
      coach: z.string(),
      graded: z.boolean(),
      at: z.string(),
      attempts: z.array(
        z.object({
          competencyId: z.string(),
          name: z.string(),
          skill: skillSchema,
          opportunities: z.number().int().nonnegative(),
          correct: z.number().int().nonnegative(),
          observed: z.number().min(0).max(1).nullable(),
          errorTags: z.array(z.string()),
        }),
      ),
    }),
  ),
});
export type SessionDetail = z.infer<typeof sessionDetailSchema>;

/* ---------------------------------------------------------------------------
   Speech — GET /v1/speech/capabilities
   --------------------------------------------------------------------------- */

/**
 * What the *server* can add on top of the browser.
 *
 * The browser's own Web Speech support is checked in the browser; this says
 * whether ElevenLabs and Whisper are configured, which is what decides between
 * a coach voice the orb can actually analyse and the flat one it cannot.
 */
export const speechCapabilitiesSchema = z.object({
  synthesis: z.object({ available: z.boolean(), provider: z.string() }),
  transcription: z.object({ available: z.boolean(), provider: z.string() }),
});
export type SpeechCapabilities = z.infer<typeof speechCapabilitiesSchema>;
