import { z } from "zod";

/**
 * What the application needs from a model, stated without naming one.
 *
 * These interfaces are the dependency inversion boundary. Services depend on
 * `CoachDirector` and `TurnEvaluator`; Gemini depends on them too, by
 * implementing them. Nothing above this file imports a provider SDK, which buys
 * three concrete things: the session logic is testable against a deterministic
 * fake, swapping provider is one adapter and one line of wiring, and a provider
 * outage degrades to a fallback implementation rather than a 500.
 */

// --- the director ----------------------------------------------------------

/** Everything the coach knows going into a reply. */
export interface DirectorContext {
  /** What the learner is being asked to do this session. */
  prompt: string;
  /** The competencies this exercise is trying to elicit, by name. */
  targets: { id: string; name: string; successCriteria: string; cues: string[] }[];
  /** The setting, from the Life Path. */
  theme: string;
  learner: {
    displayName: string | null;
    cefr: string;
    /** First language, for interference-aware phrasing. */
    l1: string;
    studyField: string | null;
  };
  /** Prior turns this session, oldest first. Bounded by the caller. */
  history: { learner: string; coach: string | null }[];
  /** The utterance being replied to. */
  utterance: string;
}

export interface DirectorReply {
  /** What the coach says next. Spoken aloud, so it must read aloud. */
  line: string;
  /**
   * Whether the coach thinks the exercise is finished.
   *
   * Advisory. The session service decides, using this plus the turn count and
   * the time budget — a model that never says "done" must not be able to trap
   * a learner in one exercise.
   */
  suggestsComplete: boolean;
}

export interface CoachDirector {
  readonly name: string;
  reply(context: DirectorContext): Promise<DirectorReply>;
}

// --- the evaluator ---------------------------------------------------------

/**
 * The evaluator's output, validated before anything is written.
 *
 * A model's structured output is *untrusted input* — it will occasionally
 * return `correct` greater than `opportunities`, a competency ID that does not
 * exist, or a percentage where a count was asked for. Parsing it through a
 * schema at the boundary is the difference between a bad grading and corrupt
 * mastery data that no later run will fix.
 */
export const evaluationSchema = z.object({
  /** The utterance tidied up — the "how it could sound" half of the reflection. */
  cleanedTranscript: z.string().max(4_000),

  judgements: z
    .array(
      z
        .object({
          competencyId: z.string().max(32),
          /** Chances the learner had to demonstrate it in this utterance. */
          opportunities: z.number().int().min(0).max(50),
          /** How many they took. Cannot exceed the chances; enforced below. */
          correct: z.number().int().min(0).max(50),
          errorTags: z.array(z.string().max(64)).max(10).default([]),
        })
        .refine((j) => j.correct <= j.opportunities, {
          message: "correct cannot exceed opportunities",
          path: ["correct"],
        }),
    )
    .max(20),

  /** At most one correction is surfaced per turn; the rest inform mastery. */
  corrections: z
    .array(
      z.object({
        /** The exact substring that was wrong, for highlighting. */
        errorSpan: z.string().max(300),
        corrected: z.string().max(300),
        /** One sentence, in the learner's feedback language. */
        explanation: z.string().max(400),
        competencyId: z.string().max(32),
      }),
    )
    .max(5)
    .default([]),

  /** How many sentences the evaluator found. Feeds the structure metric. */
  sentenceCount: z.number().int().min(0).max(100),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export interface EvaluationContext {
  utterance: string;
  prompt: string;
  targets: {
    id: string;
    name: string;
    skill: string;
    successCriteria: string;
    knownErrors: { wrong: string; right: string; tag: string }[];
  }[];
  learner: { cefr: string; l1: string };
  /**
   * Whether the explanation is English-only or English plus `learner.l1`.
   *
   * The second language is not named here because it is not a separate choice:
   * it is the learner's first language, which is already in this context.
   */
  feedbackLanguage: "ENGLISH" | "BILINGUAL";
}

export interface TurnEvaluator {
  readonly name: string;
  evaluate(context: EvaluationContext): Promise<Evaluation>;
}

// --- speech ----------------------------------------------------------------

export interface SynthesisRequest {
  text: string;
  /** BCP-47. The coach speaks English; explanations may not. */
  language: string;
}

export interface SynthesisResult {
  audio: Buffer;
  contentType: string;
}

/**
 * Server-side text to speech.
 *
 * Optional throughout. The browser's own `speechSynthesis` is the default voice
 * — it is free, instant, needs no round trip and works offline — and this is
 * the upgrade for devices whose built-in voices are poor. Any code path that
 * depends on this existing is a code path that breaks for most learners.
 */
export interface SpeechSynthesizer {
  readonly name: string;
  readonly available: boolean;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}

export interface TranscriptionRequest {
  audio: Buffer;
  contentType: string;
  language: string;
}

export interface TranscriptionResult {
  text: string;
  /** Word timings, when the provider returns them. Web Speech does not. */
  words?: { text: string; startMs: number; endMs: number }[];
}

/**
 * Server-side speech to text.
 *
 * Also optional, and for the same reason: the browser recognises speech
 * locally. This is the verbatim analysis track for turns worth a round trip,
 * and the fallback for browsers with no `SpeechRecognition` at all — which is
 * every Firefox, and matters more than it sounds.
 */
export interface SpeechTranscriber {
  readonly name: string;
  readonly available: boolean;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}
