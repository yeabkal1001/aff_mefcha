import { createHash } from "node:crypto";

import { log } from "../../core/request-context.js";
import type {
  CoachDirector,
  DirectorContext,
  DirectorReply,
} from "./ports.js";

/**
 * A coach that needs no model.
 *
 * Used when Gemini is unavailable. The alternative is a 503 mid-conversation,
 * and the difference matters more than it looks: a learner who is speaking and
 * gets an error has lost their turn and their nerve, whereas one who gets a
 * slightly generic "tell me more about that" keeps talking. Their audio is
 * still recorded, the turn is still stored, and grading — which is
 * asynchronous — catches up when the provider returns.
 *
 * This is a real fallback and not a stub. It must never sound like an error.
 */

/**
 * Deliberately open-ended. Every line works after any utterance, invites more
 * speech, and never claims to have understood something specific — a canned
 * line that pretends to comprehend is worse than one that plainly does not.
 */
const CONTINUATIONS = [
  "Good. Tell me a little more about that.",
  "Thank you. Can you say that again with more detail?",
  "I see. What happened next?",
  "Nice work. Can you describe that in another way?",
  "Good try. Add one more sentence for me.",
  "Right. And how did you feel about it?",
] as const;

/** Said when the learner has clearly finished the exercise. */
const CLOSINGS = [
  "That was good work. Let's move on.",
  "Well done. That's this one finished.",
] as const;

/**
 * Enough turns that the learner has produced evidence, few enough that a
 * conversation with no real director does not wander.
 */
const MAX_TURNS_WITHOUT_DIRECTOR = 4;

export const fallbackDirector: CoachDirector = {
  name: "fallback-director",

  async reply(context: DirectorContext): Promise<DirectorReply> {
    log().warn("using fallback director; the model is unavailable");

    const done = context.history.length >= MAX_TURNS_WITHOUT_DIRECTOR;
    const pool = done ? CLOSINGS : CONTINUATIONS;

    // Chosen by hashing the utterance rather than at random, so a retried
    // request produces the same reply. A learner who reconnects and hears a
    // different sentence for the same turn is being shown that something went
    // wrong; one who hears the same sentence is not.
    const index = hashToIndex(context.utterance, pool.length);

    return { line: pool[index]!, suggestsComplete: done };
  },
};

function hashToIndex(input: string, modulo: number): number {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0) % modulo;
}

/**
 * Try the real director; fall back rather than fail.
 *
 * The composition is the point: every caller gets resilience without knowing
 * about it, and there is exactly one place that decides a model outage is
 * survivable. Only the *reply* degrades — grading is not wrapped like this,
 * because a fabricated grade is far worse than a missing one.
 */
export function withFallback(primary: CoachDirector): CoachDirector {
  return {
    name: `${primary.name}+fallback`,

    async reply(context: DirectorContext): Promise<DirectorReply> {
      try {
        return await primary.reply(context);
      } catch (error) {
        log().error({ err: error }, "director failed; falling back");
        return fallbackDirector.reply(context);
      }
    },
  };
}
