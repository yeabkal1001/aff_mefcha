/**
 * The server, typed.
 *
 * These interfaces mirror `server/app/schemas.py` field for field, snake_case
 * included. The wire shape is left exactly as FastAPI sends it so that what you
 * read here, what you see in Swagger, and what arrives in the browser are the
 * same thing — a camelCase translation layer would be one more place for the
 * two halves of the project to drift apart silently.
 *
 * No provider key is reachable from this file. Every model call happens on the
 * server; the browser only ever talks to this API.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`${status}: ${detail}`);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    // fetch only rejects when the server could not be reached at all, which
    // during development almost always means uvicorn is not running.
    throw new ApiError(0, `cannot reach the server at ${BASE_URL}`);
  }

  if (!response.ok) {
    // FastAPI puts the message in `detail`, as a string for HTTPException and
    // as a list of field errors for a 422.
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // A non-JSON error body is not worth a second failure.
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/* -------------------------------------------------------------------------- */
/* Onboarding and the Communication Profile                                    */
/* -------------------------------------------------------------------------- */

export interface OnboardingRequest {
  learner_id: string;
  display_name?: string | null;
  life_path_id: string;
  l1?: string;
  study_field?: string | null;
  daily_minutes?: number;
  feedback_language?: string;
  /** Present only when the assessment ran; placement reads complexity off these. */
  assessment_transcripts?: string[] | null;
  assessment_error_count?: number;
}

export interface PlacementRead {
  mean_sentence_length: number;
  subordination_rate: number;
  lexical_range: number;
  error_density: number;
  composite: number;
  measured_band: string;
  band: string;
  capped_by_content: boolean;
}

export interface OnboardingResponse {
  learner_id: string;
  /** Measured, never declared. */
  cefr: string;
  seeded_competencies: number;
  placement: PlacementRead | null;
}

export interface DimensionResponse {
  id: string;
  name: string;
  fixed: boolean;
  /** null is "not yet assessed". It is never 0%. */
  value: number | null;
  wide_uncertainty: boolean;
  attempted_count: number;
}

export interface ProfileResponse {
  learner_id: string;
  cefr: string;
  life_path_id: string;
  dimensions: DimensionResponse[];
  due_count: number;
}

export function onboard(body: OnboardingRequest): Promise<OnboardingResponse> {
  return post<OnboardingResponse>("/learners", body);
}

export function getProfile(learnerId: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(`/learners/${learnerId}/profile`);
}

/* -------------------------------------------------------------------------- */
/* Today's Mission                                                             */
/* -------------------------------------------------------------------------- */

export interface SessionTargetResponse {
  competency_id: string;
  name: string;
  role: string;
  priority: number | null;
}

export interface SessionResponse {
  id: string;
  position: number;
  template_id: string;
  template_name: string;
  skill_focus: string | null;
  prompt: string;
  learning_objective: string | null;
  expected_duration_minutes: number | null;
  /** `image` puts a stimulus on the screen; `EX007` and `EX018` do not. */
  stimulus_type: string | null;
  stimulus_url: string | null;
  targets: SessionTargetResponse[];
  completed_at: string | null;
}

export interface DayPlanResponse {
  id: string;
  learner_id: string;
  date: string;
  domain_id: string;
  /** Shown to the learner as "Today's Mission". */
  theme: string;
  sessions: SessionResponse[];
}

/** Builds today's mission, or returns the one already built for today. */
export function getDayPlan(learnerId: string): Promise<DayPlanResponse> {
  return request<DayPlanResponse>(`/learners/${learnerId}/day-plan`);
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return request<SessionResponse>(`/sessions/${sessionId}`);
}

/* -------------------------------------------------------------------------- */
/* Running one session                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One word, with the timings every delivery metric is measured from.
 *
 * `type` is present only on transcripts from a Scribe-style provider, where
 * `spacing` and `audio_event` entries are not words; the server drops those.
 */
export interface TimedWord {
  text: string;
  start: number;
  end: number;
  type?: "word" | "spacing" | "audio_event";
}

export interface TurnRequest {
  audio_url?: string | null;
  /** Graded. Keeps the errors in. */
  transcript_verbatim?: string | null;
  /** Displayed. Never graded — it has already repaired what we grade for. */
  transcript_clean?: string | null;
  words?: TimedWord[];
  scaffold_level?: number;
}

export interface JudgementResponse {
  competency_id: string;
  opportunities: number;
  correct: number;
  /** null when there were no opportunities. No evidence is not a zero. */
  observed: number | null;
  error_tags: string[];
  source: string;
}

export interface CorrectionHint {
  competency_id: string;
  tag: string;
  wrong: string;
  right: string;
}

export interface TurnResponse {
  turn_id: string;
  metrics: Record<string, number | null>;
  judgements: JudgementResponse[];
  retry_needed: string[];
  retries_exhausted: boolean;
  /** The next rung of the template's scaffold ladder, when a retry is owed. */
  scaffold_prompt: string | null;
  /** Authored wrong/right forms for every error tag that fired. */
  corrections: CorrectionHint[];
}

export interface MasteryUpdateResponse {
  competency_id: string;
  observed: number;
  alpha: number;
  weight: number;
  scaffolded: boolean;
  mastery_before: number;
  mastery_after: number;
  stability_before: number;
  stability_after: number;
  evidence_count_after: number;
}

export interface SessionOutcomeResponse {
  session_id: string;
  updates: MasteryUpdateResponse[];
  prerequisite_recheck: string[];
  dimensions: DimensionResponse[];
}

export function postTurn(sessionId: string, body: TurnRequest): Promise<TurnResponse> {
  return post<TurnResponse>(`/sessions/${sessionId}/turns`, body);
}

/** Resolves the session into evidence and moves the learner model. */
export function finaliseSession(sessionId: string): Promise<SessionOutcomeResponse> {
  return post<SessionOutcomeResponse>(`/sessions/${sessionId}/finalise`, {});
}

export interface ReflectionResponse {
  session_id: string;
  matched_error_tag: string | null;
  confidence_raised_for: string | null;
}

export function postReflection(
  sessionId: string,
  learnerText: string,
): Promise<ReflectionResponse> {
  return post<ReflectionResponse>(`/sessions/${sessionId}/reflection`, {
    learner_text: learnerText,
  });
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                       */
/* -------------------------------------------------------------------------- */

export interface TranscriptionResponse {
  text: string;
  words: TimedWord[];
  language: string | null;
}

/**
 * A recording in, a verbatim transcript with word timings out.
 *
 * Transcription is a server call rather than a browser one for two reasons: the
 * provider key must not reach the client, and the metrics have to be measured
 * from the same word list the learner is shown.
 */
export async function transcribe(
  audio: Blob,
  language = "en",
): Promise<TranscriptionResponse> {
  const form = new FormData();
  form.append("audio", audio, "turn.webm");
  form.append("language", language);

  // No Content-Type header here on purpose — the browser has to set it so that
  // it can attach the multipart boundary.
  const response = await fetch(`${BASE_URL}/audio/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return response.json() as Promise<TranscriptionResponse>;
}

/** The coach's voice, as a blob URL ready for an `<audio>` element. */
export async function speak(text: string, language = "en"): Promise<string> {
  const response = await fetch(`${BASE_URL}/audio/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return URL.createObjectURL(await response.blob());
}

export interface CoachLineResponse {
  english: string;
  amharic: string | null;
  /** The model sentence alone, for the English voice to read. */
  model_sentence: string | null;
}

/** A correction, explained in Amharic. */
export function getCorrection(right: string, wrong?: string): Promise<CoachLineResponse> {
  return post<CoachLineResponse>("/audio/correction", { right, wrong: wrong ?? null });
}

/** What the coach says next, given the activity and what the learner just said. */
export function getCoachLine(
  sessionId: string,
  learnerSaid: string,
): Promise<CoachLineResponse> {
  return post<CoachLineResponse>(`/sessions/${sessionId}/coach-line`, {
    text: learnerSaid,
  });
}

/* -------------------------------------------------------------------------- */
/* Health                                                                      */
/* -------------------------------------------------------------------------- */

export interface HealthResponse {
  ok: boolean;
  service: string;
  demo_mode: boolean;
  /** The clock the scheduler reads, offset included. */
  engine_time: string;
  clock_offset_hours: number;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}
