import { pino, stdSerializers } from "pino";

import { env, isProduction, isTest } from "../config/env.js";

/**
 * Structured logging, with redaction that is on by default.
 *
 * Two decisions worth defending.
 *
 * **Redaction is a denylist of paths, not a hope.** Every field below has a
 * plausible route into a log line — `authorization` from a request dump,
 * `apiKey` from a provider SDK error, `DATABASE_URL` from an env dump in a
 * crash handler. Pino applies these before serialisation, so a key cannot leak
 * through a nested object we forgot to shape.
 *
 * **Transcripts are not redacted, and that is deliberate.** They are the
 * product; grading is unfixable without seeing what the learner said. They are
 * instead simply never logged — nothing passes a transcript to the logger, and
 * the review for that is at the call site. Redacting them here would imply
 * logging them is fine as long as this list is right.
 */
const REDACTED = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.secret",
  "*.authorization",
  "*.DATABASE_URL",
  "*.CLERK_SECRET_KEY",
  "*.GEMINI_API_KEY",
  "*.ELEVENLABS_API_KEY",
  "*.WHISPER_API_KEY",
];

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact: { paths: REDACTED, censor: "[redacted]" },

  // Render's log pipeline reads JSON; a terminal reads better with colour.
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
      },

  base: { service: "english-coach-api" },

  // `level` as a word rather than pino's numeric default. Every log viewer can
  // filter on "error"; almost none can filter on 50.
  formatters: {
    level: (label) => ({ level: label }),
  },

  /**
   * Errors serialise with their full cause chain.
   *
   * `AppError` wraps the original failure in `cause`, and pino's default error
   * serialiser drops it — which is exactly the frame that says *why* the
   * provider call failed rather than just that it did.
   */
  serializers: {
    err: stdSerializers.errWithCause,
    error: stdSerializers.errWithCause,
  },
});

export type Logger = typeof logger;
