import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { CircuitBreaker, guard } from "../../core/resilience.js";
import type {
  SpeechSynthesizer,
  SynthesisRequest,
  SynthesisResult,
} from "./ports.js";

/**
 * ElevenLabs, as the optional upgrade to the browser's own voice.
 *
 * Optional is load-bearing. The client speaks through `speechSynthesis` by
 * default: free, instant, no round trip, works offline, and available on every
 * device the learners here actually use. This exists for the case where the
 * built-in voices are bad enough to undercut a coaching product, and it is
 * called explicitly rather than automatically — a per-turn TTS round trip on a
 * slow connection is a worse experience than a mediocre local voice, not a
 * better one.
 *
 * With no key configured, `available` is false and the route returns 501. It
 * does not throw at startup: a missing optional provider is a configuration
 * choice, not a failure.
 */

const breaker = new CircuitBreaker({
  name: "elevenlabs",
  threshold: 4,
  resetMs: 60_000,
});

/** A coach line is a sentence or two. Anything longer is a bug or an abuse. */
const MAX_CHARACTERS = 1_000;

/** Audio generation is slower than text; this is generous but still bounded. */
const TIMEOUT_MS = 15_000;

export const elevenLabsSynthesizer: SpeechSynthesizer = {
  name: "elevenlabs",

  get available() {
    return Boolean(env.ELEVENLABS_API_KEY);
  },

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const apiKey = env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new AppError(
        501,
        "service_unavailable",
        "Server-side speech isn't configured. The browser's own voice is used instead.",
      );
    }

    const text = request.text.trim();
    if (!text) throw AppError.badRequest("There is nothing to speak.");
    if (text.length > MAX_CHARACTERS) {
      throw AppError.badRequest(
        `Text for speech must be ${MAX_CHARACTERS} characters or fewer.`,
      );
    }

    const response = await guard(
      {
        provider: "elevenlabs",
        timeoutMs: TIMEOUT_MS,
        breaker,
        retry: { attempts: 2, baseDelayMs: 400, maxDelayMs: 1_500 },
      },
      (signal) =>
        fetch(
          // The voice ID is from validated configuration, never from a request.
          // Interpolating a client-supplied value here would be a path traversal
          // into ElevenLabs' API surface.
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}`,
          {
            method: "POST",
            signal,
            headers: {
              "xi-api-key": apiKey,
              "content-type": "application/json",
              accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_turbo_v2_5",
              voice_settings: {
                // Steadier than the default. A coach that varies its delivery
                // sentence to sentence sounds unwell rather than expressive.
                stability: 0.55,
                similarity_boost: 0.75,
                speed: 0.95,
              },
            }),
          },
        ).then(assertOk),
    );

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
    };
  },
};

/**
 * Turn a non-2xx into something `isTransient` can classify.
 *
 * `fetch` only rejects on a network failure, so without this a 500 from the
 * provider looks like a successful call returning a body of error JSON — which
 * then gets sent to the browser as audio.
 */
async function assertOk(response: Response): Promise<Response> {
  if (response.ok) return response;

  // The body is read and discarded rather than logged: a provider error body
  // can echo the request, and the request contains what the coach was about to
  // say to this learner.
  await response.body?.cancel();

  const error = new Error(`ElevenLabs responded ${response.status}`) as Error & {
    status: number;
  };
  error.status = response.status;
  throw error;
}
