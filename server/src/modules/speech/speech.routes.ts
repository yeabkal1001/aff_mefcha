import { Router, raw } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { requireAuth } from "../../http/middleware/auth.js";
import { rateLimit } from "../../http/middleware/rate-limit.js";
import { text } from "../../http/middleware/validate.js";
import { route } from "../../http/route.js";
import { ai } from "../../infra/ai/index.js";

/**
 * `/v1/speech` — the server-side voice, for when the browser's own is not
 * enough.
 *
 * Both endpoints are secondary. The client speaks and listens through the Web
 * Speech API by default, which costs nothing, needs no round trip and works
 * offline. These exist for two specific cases: a device whose built-in voices
 * undercut the product, and a browser with no `SpeechRecognition` at all —
 * which is every Firefox, and is the difference between "works in Chrome" and
 * "works".
 *
 * Both proxy a provider key that must never reach a browser, which is the other
 * reason they are here rather than called directly from the client.
 */
export const speechRouter: Router = Router();

speechRouter.use(requireAuth);

/**
 * Tighter than the general AI limit.
 *
 * Speech is billed per character and per second of audio, and it is the easiest
 * endpoint in the API to turn into a bill. A learner hears at most a few coach
 * lines a minute; anything past this is a loop.
 */
const speechLimit = rateLimit({
  bucket: "speech",
  windowMs: 60_000,
  max: 20,
});

/** Which voices are actually available, so the client can choose sensibly. */
speechRouter.get(
  "/capabilities",
  ...route({
    handler: async () => ({
      // The client checks its own `speechSynthesis` and `SpeechRecognition`
      // support; this reports only what the *server* can add on top.
      synthesis: { available: ai.synthesizer.available, provider: ai.synthesizer.name },
      transcription: { available: ai.transcriber.available, provider: ai.transcriber.name },
    }),
  }),
);

speechRouter.post(
  "/synthesize",
  speechLimit,
  ...route({
    schemas: {
      body: z.object({
        text: text(1_000),
        language: z.string().max(10).default("en-US"),
      }),
    },
    handler: async ({ body, res }) => {
      const result = await ai.synthesizer.synthesize({
        text: body.text,
        language: body.language,
      });

      res
        .status(200)
        .type(result.contentType)
        // Private: this is one learner's coach line, and a shared cache holding
        // it would serve it to somebody else.
        .set("Cache-Control", "private, max-age=3600")
        .send(result.audio);

      // Already written; `route` sees `headersSent` and leaves it alone.
      return undefined;
    },
  }),
);

/**
 * Transcribe an audio turn.
 *
 * `raw` rather than `multipart`, deliberately: the body is one audio blob and
 * nothing else, so a multipart parser would add a file-upload attack surface —
 * temp files, filenames, disk — to buy nothing at all.
 */
speechRouter.post(
  "/transcribe",
  speechLimit,
  raw({ type: "audio/*", limit: "10mb" }),
  ...route({
    schemas: {
      query: z.object({ language: z.string().max(10).default("en") }),
    },
    handler: async ({ req, query }) => {
      const audio = req.body as Buffer;

      if (!Buffer.isBuffer(audio) || audio.byteLength === 0) {
        throw Object.assign(new Error("Send the audio as a raw audio/* body."), {
          status: 400,
        });
      }

      const result = await ai.transcriber.transcribe({
        audio,
        contentType: req.get("content-type") ?? "audio/webm",
        language: query.language,
      });

      return { text: result.text, words: result.words ?? null };
    },
  }),
);

export const speechConfigured = {
  synthesis: Boolean(env.ELEVENLABS_API_KEY),
  transcription: Boolean(env.WHISPER_API_KEY),
};
