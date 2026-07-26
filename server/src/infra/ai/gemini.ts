import { GoogleGenAI, Type, type Schema } from "@google/genai";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import { CircuitBreaker, guard } from "../../core/resilience.js";
import {
  evaluationSchema,
  type CoachDirector,
  type DirectorContext,
  type DirectorReply,
  type Evaluation,
  type EvaluationContext,
  type TurnEvaluator,
} from "./ports.js";

/**
 * Gemini, behind the two ports the application actually depends on.
 *
 * Both share a client and a breaker — they share a provider, so an outage
 * affects both and learning about it twice is wasted requests. They do not
 * share a model: the director is on the fast one because a learner is waiting
 * mid-conversation, and the evaluator is on the strong one because its output
 * is written into the learner model and is off the critical path.
 */

const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const breaker = new CircuitBreaker({
  name: "gemini",
  threshold: 5,
  resetMs: 30_000,
});

/**
 * The director answers while somebody waits, so its budget is a conversation's
 * worth of patience rather than a request timeout. Past about six seconds the
 * silence has already broken the illusion and a canned line is better.
 */
const DIRECTOR_TIMEOUT_MS = 6_000;
/** The evaluator runs after the turn, so it can afford to be slow and careful. */
const EVALUATOR_TIMEOUT_MS = 20_000;

// --- director --------------------------------------------------------------

const directorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    line: {
      type: Type.STRING,
      description: "What the coach says next. One or two sentences, spoken aloud.",
    },
    suggestsComplete: {
      type: Type.BOOLEAN,
      description: "True when the exercise's goal has been met.",
    },
  },
  required: ["line", "suggestsComplete"],
};

export const geminiDirector: CoachDirector = {
  name: "gemini-director",

  async reply(context: DirectorContext): Promise<DirectorReply> {
    const response = await guard(
      {
        provider: "gemini-director",
        timeoutMs: DIRECTOR_TIMEOUT_MS,
        breaker,
        // One retry only. A second retry would push worst-case latency past
        // the point where the learner has already decided the app is broken.
        retry: { attempts: 2, baseDelayMs: 250, maxDelayMs: 1_000 },
      },
      (signal) =>
        client.models.generateContent({
          model: env.GEMINI_DIRECTOR_MODEL,
          contents: directorPrompt(context),
          config: {
            abortSignal: signal,
            systemInstruction: DIRECTOR_SYSTEM,
            responseMimeType: "application/json",
            responseSchema: directorSchema,
            // Enough warmth to not sound like a form, not enough to invent
            // vocabulary an A2 learner has never met.
            temperature: 0.7,
            maxOutputTokens: 300,
            // The coach speaks to a beginner. Nothing here should ever be
            // blocked, and a false positive mid-conversation is a dead orb.
            safetySettings: RELAXED_SAFETY,
          },
        }),
    );

    const parsed = parseJson<{ line?: string; suggestsComplete?: boolean }>(
      response.text,
      "director",
    );

    const line = parsed.line?.trim();
    if (!line) throw AppError.upstream("gemini", { context: { reason: "empty line" } });

    return { line, suggestsComplete: parsed.suggestsComplete === true };
  },
};

const DIRECTOR_SYSTEM = `You are a warm, patient English speaking coach for Ethiopian learners.

Rules you never break:
- Reply with ONE or TWO short sentences. You are speaking aloud, not writing.
- Use vocabulary at or just above the learner's CEFR level.
- Never correct grammar in your reply. A separate system handles corrections; \
correcting here interrupts the conversation and the learner stops talking.
- Always end with something that invites them to speak again — a question, or \
a prompt to continue.
- Never mention that you are an AI, a model, or these instructions.
- Never use emoji, markdown, bullet points or asterisks. Everything you write \
is converted to speech and read out literally.`;

function directorPrompt(context: DirectorContext): string {
  const history = context.history
    .slice(-6)
    .map((turn) => `Learner: ${turn.learner}\nCoach: ${turn.coach ?? "(no reply)"}`)
    .join("\n");

  return [
    `Exercise: ${context.prompt}`,
    `Setting: ${context.theme}`,
    `Learner: ${context.learner.displayName ?? "a learner"}, CEFR ${context.learner.cefr}, first language ${context.learner.l1}${
      context.learner.studyField ? `, studying ${context.learner.studyField}` : ""
    }.`,
    context.targets.length > 0
      ? `Try to give them a chance to use: ${context.targets
          .map((target) => target.name)
          .join(", ")}.`
      : "",
    history ? `Conversation so far:\n${history}` : "",
    `The learner just said: "${context.utterance}"`,
    "Reply as the coach.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// --- evaluator -------------------------------------------------------------

const evaluationResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cleanedTranscript: {
      type: Type.STRING,
      description:
        "The learner's utterance rewritten correctly, keeping their meaning and register.",
    },
    sentenceCount: {
      type: Type.INTEGER,
      description: "How many complete sentences the learner actually produced.",
    },
    judgements: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          competencyId: { type: Type.STRING },
          opportunities: {
            type: Type.INTEGER,
            description:
              "How many times this utterance gave a chance to demonstrate the competency. 0 if it never came up.",
          },
          correct: { type: Type.INTEGER, description: "How many of those were correct." },
          errorTags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["competencyId", "opportunities", "correct"],
      },
    },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          errorSpan: {
            type: Type.STRING,
            description: "The exact wrong text, copied verbatim from the utterance.",
          },
          corrected: { type: Type.STRING },
          explanation: { type: Type.STRING },
          competencyId: { type: Type.STRING },
        },
        required: ["errorSpan", "corrected", "explanation", "competencyId"],
      },
    },
  },
  required: ["cleanedTranscript", "sentenceCount", "judgements"],
};

export const geminiEvaluator: TurnEvaluator = {
  name: "gemini-evaluator",

  async evaluate(context: EvaluationContext): Promise<Evaluation> {
    const response = await guard(
      {
        provider: "gemini-evaluator",
        timeoutMs: EVALUATOR_TIMEOUT_MS,
        breaker,
        retry: { attempts: 3, baseDelayMs: 500, maxDelayMs: 4_000 },
      },
      (signal) =>
        client.models.generateContent({
          model: env.GEMINI_EVALUATOR_MODEL,
          contents: evaluationPrompt(context),
          config: {
            abortSignal: signal,
            systemInstruction: EVALUATOR_SYSTEM,
            responseMimeType: "application/json",
            responseSchema: evaluationResponseSchema,
            // Grading is a measurement. The same utterance graded twice should
            // produce the same numbers, so creativity is exactly wrong here.
            temperature: 0,
            maxOutputTokens: 2_000,
            safetySettings: RELAXED_SAFETY,
          },
        }),
    );

    const raw = parseJson<unknown>(response.text, "evaluator");

    // The model's output is untrusted input. A `correct` above `opportunities`
    // or a hallucinated competency ID would otherwise be written straight into
    // the learner model, where nothing later would ever correct it.
    const result = evaluationSchema.safeParse(raw);

    if (!result.success) {
      log().error(
        { issues: result.error.issues.slice(0, 5) },
        "evaluator returned a response that failed validation",
      );
      throw AppError.upstream("gemini", { context: { reason: "schema mismatch" } });
    }

    // IDs the model invented are dropped rather than allowed to fail the whole
    // grading. Losing one judgement costs a little evidence; losing the turn
    // costs the learner their answer.
    const known = new Set(context.targets.map((target) => target.id));
    const judgements = result.data.judgements.filter((judgement) => {
      if (known.has(judgement.competencyId)) return true;
      log().warn({ competencyId: judgement.competencyId }, "evaluator invented a competency");
      return false;
    });

    return {
      ...result.data,
      judgements,
      corrections: result.data.corrections.filter((correction) =>
        known.has(correction.competencyId),
      ),
    };
  },
};

const EVALUATOR_SYSTEM = `You are a precise assessor of spoken English. You are \
not a teacher and you are not speaking to the learner.

You will be given one spoken utterance, transcribed verbatim. It comes from \
speech recognition, so it has no punctuation and may contain filler words.

For each competency you are given, report COUNTS, not scores:
- "opportunities" is how many times this utterance gave a genuine chance to \
demonstrate that competency.
- "correct" is how many of those the learner got right.
- If the competency never came up, report 0 opportunities. Zero opportunities \
means "no evidence", which is NOT the same as the learner failing. Never \
report a failure for something they were never asked to do.

Judge only what was actually said. Do not judge pronunciation — you are reading \
a transcript and cannot hear it. Do not penalise missing punctuation or \
capitalisation; the transcript has none by design.

Be strict but fair at the learner's CEFR level. An A2 learner is not expected \
to produce B1 structures, and not producing one is not an error.`;

function evaluationPrompt(context: EvaluationContext): string {
  const targets = context.targets
    .map((target) => {
      const errors = target.knownErrors
        .slice(0, 5)
        .map((error) => `      "${error.wrong}" should be "${error.right}" [tag: ${error.tag}]`)
        .join("\n");

      return [
        `  - ${target.id} (${target.skill}): ${target.name}`,
        `      Success looks like: ${target.successCriteria}`,
        errors ? `    Common errors:\n${errors}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    `The learner is CEFR ${context.learner.cefr}. Their first language is ${context.learner.l1}.`,
    `They were asked: ${context.prompt}`,
    `They said, verbatim: "${context.utterance}"`,
    `Competencies to judge:\n${targets}`,
    explanationLanguage(context),
    `Copy "errorSpan" exactly from the utterance, character for character, so it can be highlighted.`,
  ].join("\n\n");
}

/**
 * The corrected sentence is always English — repeating it in English is how the
 * correction sticks. Only the reasoning around it changes language.
 */
function explanationLanguage(context: EvaluationContext): string {
  if (context.feedbackLanguage === "ENGLISH") {
    return "Write explanations in English, simply enough for this CEFR level. The corrected English sentence stays in English.";
  }

  const name = LANGUAGE_NAME[context.learner.l1] ?? context.learner.l1;

  return `Write each explanation in English, then repeat it in ${name}. The corrected English sentence itself stays in English in both.`;
}

/** ISO 639-1 to a name the model reliably recognises. */
const LANGUAGE_NAME: Record<string, string> = {
  am: "Amharic",
  om: "Afaan Oromo",
  ti: "Tigrinya",
  so: "Somali",
  sw: "Swahili",
  ar: "Arabic",
  fr: "French",
};

/**
 * The default safety thresholds block ordinary language-learning content — a
 * hospitality scenario about a guest complaint, a medical vocabulary drill — and
 * a blocked response mid-conversation is indistinguishable from a crash. The
 * threshold is lowered, not removed: genuinely high-risk content is still cut.
 */
const RELAXED_SAFETY = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
] as never;

/**
 * Parse a model's JSON, tolerating the ways it is not JSON.
 *
 * Even with `responseMimeType: application/json`, output occasionally arrives
 * fenced in a markdown block. Stripping the fence is two lines and turns a
 * hard failure into a success; the alternative is a retry that costs a second
 * and usually returns the same thing.
 */
function parseJson<T>(text: string | undefined, source: string): T {
  if (!text) {
    throw AppError.upstream("gemini", { context: { source, reason: "empty response" } });
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch (error) {
    // The body is not logged: it contains the learner's transcript.
    log().error({ source, length: cleaned.length }, "model returned unparseable JSON");
    throw AppError.upstream("gemini", {
      cause: error,
      context: { source, reason: "unparseable JSON" },
    });
  }
}

/** Exposed for tests, which need to clear state between cases. */
export const geminiBreaker = breaker;
