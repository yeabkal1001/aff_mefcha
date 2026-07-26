import { z } from "zod";

import { request, requestAudio, uploadBytes } from "./http";
import {
  communicationProfileSchema,
  evaluationSchema,
  historyDaySchema,
  learnerSchema,
  pageOf,
  pastCorrectionSchema,
  sessionDetailSchema,
  speechCapabilitiesSchema,
  todaySchema,
  turnReplySchema,
  type CommunicationProfile,
  type Evaluation,
  type HistoryDay,
  type Learner,
  type PastCorrection,
  type SessionDetail,
  type SpeechCapabilities,
  type Today,
  type TurnMetrics,
  type TurnReply,
  type UpdateProfileInput,
} from "./schemas";

/**
 * The whole surface the browser is allowed to touch.
 *
 * Nothing else in the app calls `fetch`. The paths are the contract with the
 * server in `../../server`, they are versioned under `/v1`, and every one of
 * them is authenticated — the token is attached by `http.ts`, which the Clerk
 * bridge in `components/auth-bridge.tsx` keeps supplied.
 */

const V1 = "/v1";

/** Reads that a component may need paginated. */
interface Page {
  limit?: number;
  cursor?: string;
}

function query(page?: Page): string {
  if (!page) return "";
  const params = new URLSearchParams();
  if (page.limit !== undefined) params.set("limit", String(page.limit));
  if (page.cursor) params.set("cursor", page.cursor);
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const api = {
  /** GET /v1/me — who is signed in. Provisions the learner on first call. */
  me: (signal?: AbortSignal): Promise<Learner> =>
    request({ path: `${V1}/me`, schema: learnerSchema, signal }),

  /** PATCH /v1/me — the settings screen, and the onboarding hand-off. */
  updateProfile: (input: UpdateProfileInput, signal?: AbortSignal): Promise<Learner> =>
    request({
      path: `${V1}/me`,
      method: "PATCH",
      body: input,
      schema: learnerSchema,
      signal,
    }),

  /** GET /v1/me/profile — the four dimensions, and lifetime totals. */
  communicationProfile: (signal?: AbortSignal): Promise<CommunicationProfile> =>
    request({
      path: `${V1}/me/profile`,
      schema: communicationProfileSchema,
      signal,
    }),

  /** DELETE /v1/me — soft-delete, with a recovery window. */
  deleteAccount: (signal?: AbortSignal): Promise<void> =>
    request({
      path: `${V1}/me`,
      method: "DELETE",
      schema: z.void(),
      signal,
    }),

  /** GET /v1/today — the Day Plan, built on the first call of the day. */
  today: (signal?: AbortSignal): Promise<Today> =>
    request({ path: `${V1}/today`, schema: todaySchema, signal }),

  /** POST /v1/sessions/:id/start — mark an exercise begun. */
  startSession: (sessionId: string, signal?: AbortSignal) =>
    request({
      path: `${V1}/sessions/${sessionId}/start`,
      method: "POST",
      schema: z.object({ id: z.string(), status: z.string(), prompt: z.string() }),
      signal,
    }),

  /**
   * POST /v1/sessions/:id/turns — say something, hear back.
   *
   * The idempotency key is required rather than optional. This is the request a
   * flaky connection retries, and without a key one utterance becomes two
   * turns, two gradings, two provider bills and a learner model that is wrong
   * in a way nothing will correct.
   */
  submitTurn: (
    sessionId: string,
    input: { transcript: string; metrics: TurnMetrics; idempotencyKey: string },
    signal?: AbortSignal,
  ): Promise<TurnReply> =>
    request({
      path: `${V1}/sessions/${sessionId}/turns`,
      method: "POST",
      body: { transcript: input.transcript, metrics: input.metrics },
      schema: turnReplySchema,
      idempotencyKey: input.idempotencyKey,
      // The director calls a model. Slower than a database read, and the
      // learner is sitting in silence waiting for it.
      timeoutMs: 25_000,
      signal,
    }),

  /**
   * POST /v1/turns/:id/evaluate — grade a turn.
   *
   * Deliberately after the reply rather than with it: the coach answers in
   * about a second, and this runs while the learner is already listening.
   */
  evaluateTurn: (turnId: string, signal?: AbortSignal): Promise<Evaluation> =>
    request({
      path: `${V1}/turns/${turnId}/evaluate`,
      method: "POST",
      schema: evaluationSchema,
      timeoutMs: 30_000,
      signal,
    }),

  completeSession: (sessionId: string, signal?: AbortSignal) =>
    request({
      path: `${V1}/sessions/${sessionId}/complete`,
      method: "POST",
      schema: z.object({ id: z.string(), status: z.string() }),
      signal,
    }),

  abandonSession: (sessionId: string, signal?: AbortSignal) =>
    request({
      path: `${V1}/sessions/${sessionId}/abandon`,
      method: "POST",
      schema: z.object({ id: z.string(), status: z.string() }),
      signal,
    }),

  /** GET /v1/sessions/:id — one exercise in full, for the history screen. */
  session: (sessionId: string, signal?: AbortSignal): Promise<SessionDetail> =>
    request({
      path: `${V1}/sessions/${sessionId}`,
      schema: sessionDetailSchema,
      signal,
    }),

  /** GET /v1/history — past days, newest first. */
  history: (page?: Page, signal?: AbortSignal) =>
    request<{ items: HistoryDay[]; nextCursor: string | null }>({
      path: `${V1}/history${query(page)}`,
      schema: pageOf(historyDaySchema),
      signal,
    }),

  /** GET /v1/history/corrections — everything that has been corrected. */
  corrections: (page?: Page, signal?: AbortSignal) =>
    request<{ items: PastCorrection[]; nextCursor: string | null }>({
      path: `${V1}/history/corrections${query(page)}`,
      schema: pageOf(pastCorrectionSchema),
      signal,
    }),

  /** GET /v1/speech/capabilities — which server-side voices are configured. */
  speechCapabilities: (signal?: AbortSignal): Promise<SpeechCapabilities> =>
    request({
      path: `${V1}/speech/capabilities`,
      schema: speechCapabilitiesSchema,
      signal,
    }),

  /**
   * POST /v1/speech/synthesize — the coach's voice as audio bytes.
   *
   * Used when ElevenLabs is configured. The reason to prefer it over the
   * browser's own `speechSynthesis` is not quality: it is that this returns
   * audio we can route through an `AnalyserNode`, which is what lets the orb
   * pulse to the coach's actual voice. Web Speech gives no such stream.
   */
  synthesize: (text: string, signal?: AbortSignal): Promise<ArrayBuffer> =>
    requestAudio({
      path: `${V1}/speech/synthesize`,
      body: JSON.stringify({ text }),
      contentType: "application/json",
      signal,
    }),

  /** POST /v1/speech/transcribe — Whisper, for browsers with no recogniser. */
  transcribe: (audio: Blob, signal?: AbortSignal) =>
    uploadBytes({
      path: `${V1}/speech/transcribe`,
      body: audio,
      contentType: audio.type || "audio/webm",
      schema: z.object({ text: z.string(), durationMs: z.number().nullable() }),
      // Whisper is a round trip to a third party over a file upload. The
      // default ceiling would cut off a normal-length turn.
      timeoutMs: 45_000,
      signal,
    }),
};
