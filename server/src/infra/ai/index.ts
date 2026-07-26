import { elevenLabsSynthesizer } from "./elevenlabs.js";
import { withFallback } from "./fallback.js";
import { geminiDirector, geminiEvaluator } from "./gemini.js";
import type {
  CoachDirector,
  SpeechSynthesizer,
  SpeechTranscriber,
  TurnEvaluator,
} from "./ports.js";
import { whisperTranscriber } from "./whisper.js";

/**
 * Which adapter serves which port.
 *
 * The composition root for the model layer, and the only file that mentions
 * both an application concept and a vendor. Everything upstream imports from
 * here or from `ports.js`, so changing provider is a change to these four
 * lines.
 */
export const ai = {
  /**
   * Wrapped, so a Gemini outage degrades the conversation instead of ending it.
   *
   * Note that the evaluator is deliberately *not* wrapped. A generic coach line
   * during an outage is a small loss; a fabricated grade written into the
   * learner model is a permanent one, and there is no later run that would
   * notice and correct it.
   */
  director: withFallback(geminiDirector) satisfies CoachDirector,
  evaluator: geminiEvaluator satisfies TurnEvaluator,
  synthesizer: elevenLabsSynthesizer satisfies SpeechSynthesizer,
  transcriber: whisperTranscriber satisfies SpeechTranscriber,
};

export type AiRegistry = typeof ai;

export * from "./ports.js";
