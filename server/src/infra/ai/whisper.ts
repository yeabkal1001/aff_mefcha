import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import { CircuitBreaker, guard } from "../../core/resilience.js";
import type {
  SpeechTranscriber,
  TranscriptionRequest,
  TranscriptionResult,
} from "./ports.js";

/**
 * Whisper, as the fallback and the verbatim analysis track.
 *
 * Two jobs, both secondary to the browser's own recogniser.
 *
 * The fallback matters more than it sounds: `SpeechRecognition` does not exist
 * in Firefox and is unreliable in several mobile browsers. Without a server
 * path those learners cannot use the product at all, so this is the difference
 * between "works in Chrome" and "works".
 *
 * The analysis track is the upgrade. Web Speech returns text and nothing else;
 * Whisper returns word-level timings, which is what would let fluency be
 * measured from the audio rather than from client-side turn timing.
 */

const breaker = new CircuitBreaker({
  name: "whisper",
  threshold: 4,
  resetMs: 60_000,
});

/**
 * A turn is at most a couple of minutes of speech.
 *
 * Enforced here as well as by the body parser, because this is the bound that
 * protects the *provider* spend and the request duration, and it should not
 * depend on a middleware two layers away staying configured the same way.
 */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const TIMEOUT_MS = 30_000;

/**
 * Only formats a browser's `MediaRecorder` actually produces.
 *
 * An allowlist rather than a denylist: the content type is client-supplied and
 * goes into a multipart body sent to a third party, and "everything except the
 * ones I thought of" is not a security boundary.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

const EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export const whisperTranscriber: SpeechTranscriber = {
  name: "whisper",

  get available() {
    return Boolean(env.WHISPER_API_KEY);
  },

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const apiKey = env.WHISPER_API_KEY;

    if (!apiKey) {
      throw new AppError(
        501,
        "service_unavailable",
        "Server-side transcription isn't configured.",
      );
    }

    if (request.audio.byteLength === 0) {
      throw AppError.badRequest("The audio was empty.");
    }
    if (request.audio.byteLength > MAX_AUDIO_BYTES) {
      throw AppError.badRequest("That recording is too long. Keep turns under two minutes.");
    }

    const baseType = request.contentType.split(";")[0]!.trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(request.contentType) && !ALLOWED_CONTENT_TYPES.has(baseType)) {
      throw AppError.badRequest("That audio format isn't supported.");
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(request.audio)], { type: baseType }),
      `turn.${EXTENSION[baseType] ?? "webm"}`,
    );
    form.append("language", request.language.slice(0, 5));
    // Verbatim, not tidied. The gap between what was said and what it should
    // have been is the evidence we grade on; a cleaned transcript deletes it.
    form.append("task", "transcribe");

    const response = await guard(
      {
        provider: "whisper",
        timeoutMs: TIMEOUT_MS,
        breaker,
        retry: { attempts: 2, baseDelayMs: 600, maxDelayMs: 2_500 },
      },
      (signal) =>
        fetch(env.WHISPER_API_URL, {
          method: "POST",
          signal,
          headers: { authorization: `Bearer ${apiKey}` },
          body: form,
        }).then(assertOk),
    );

    const body = (await response.json()) as {
      text?: string;
      segments?: { words?: { word: string; start: number; end: number }[] }[];
      words?: { word: string; start: number; end: number }[];
    };

    const text = body.text?.trim();
    if (!text) {
      log().warn("transcription returned no text");
      return { text: "" };
    }

    // Word timings are optional and the shape differs between providers, so
    // both known shapes are accepted and neither is required. Nothing depends
    // on them existing.
    const words = body.words ?? body.segments?.flatMap((segment) => segment.words ?? []);

    return {
      text,
      ...(words?.length
        ? {
            words: words.map((word) => ({
              text: word.word,
              startMs: Math.round(word.start * 1000),
              endMs: Math.round(word.end * 1000),
            })),
          }
        : {}),
    };
  },
};

async function assertOk(response: Response): Promise<Response> {
  if (response.ok) return response;

  await response.body?.cancel();

  const error = new Error(`Transcription responded ${response.status}`) as Error & {
    status: number;
  };
  error.status = response.status;
  throw error;
}
