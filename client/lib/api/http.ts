import type { z } from "zod";

import { ApiError, toApiError, type Problem } from "./errors";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Render's free tier spins services down when idle and cold-starts slowly, so
 * this is generous on purpose. Anything longer and the learner has already
 * decided the product is broken.
 */
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * How the request gets its bearer token.
 *
 * A function rather than a token, and installed once at startup rather than
 * passed down, for two reasons. Clerk's tokens are short-lived and refreshed in
 * the background, so anything captured at render time is stale by the time a
 * slow request goes out. And `getToken` only exists inside a React tree, while
 * this module is called from places that are not one.
 */
type TokenSource = () => Promise<string | null>;

let getToken: TokenSource = async () => null;

export function setTokenSource(source: TokenSource) {
  getToken = source;
}

interface RequestOptions<T> {
  path: string;
  schema: z.ZodType<T>;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** React Query hands one in so a superseded request stops immediately. */
  signal?: AbortSignal;
  /**
   * Makes a retry of this exact request a no-op on the server rather than a
   * second one. Required on anything that spends money at a provider or moves
   * mastery — see `idempotent` on the server.
   */
  idempotencyKey?: string;
  /** The AI calls are slower than everything else and need their own ceiling. */
  timeoutMs?: number;
}

/**
 * One typed request.
 *
 * Every response is parsed before it is returned, so a component can trust its
 * argument types at runtime and not only at compile time. A schema mismatch is
 * reported as `invalid_response` rather than crashing somewhere downstream.
 */
export async function request<T>({
  path,
  schema,
  method = "GET",
  body,
  signal,
  idempotencyKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions<T>): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const token = await getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
      // Tokens go in the header, so there is no cookie to send and no reason to
      // let the browser attach one.
      credentials: "omit",
    });
  } catch (error) {
    throw toApiError(error, path);
  }

  if (!response.ok) throw await problemFrom(response, path);

  // 204, which `DELETE /v1/me` returns. Nothing to parse.
  if (response.status === 204) return schema.parse(undefined);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ApiError("invalid_response", "Response was not JSON", {
      path,
      cause: error,
    });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      "invalid_response",
      `Response did not match the contract for ${path}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`,
      { path },
    );
  }

  return parsed.data;
}

/**
 * The speech endpoints, where at least one side of the exchange is bytes.
 *
 * Separate from `request` rather than a flag on it, because nothing about the
 * JSON path applies: the body may be an audio blob, and the response may be an
 * ArrayBuffer bound for the Web Audio API rather than something a schema could
 * describe.
 */
async function sendBytes({
  path,
  body,
  contentType,
  accept,
  signal,
  timeoutMs = 20_000,
}: {
  path: string;
  body: BodyInit;
  contentType: string;
  accept: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  const headers: Record<string, string> = { "content-type": contentType, accept };
  const token = await getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body,
      signal: combined,
      credentials: "omit",
    });
  } catch (error) {
    throw toApiError(error, path);
  }

  if (!response.ok) throw await problemFrom(response, path);
  return response;
}

/** POST bytes or JSON, get audio back. */
export async function requestAudio(options: {
  path: string;
  body: BodyInit;
  contentType: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<ArrayBuffer> {
  const response = await sendBytes({ ...options, accept: "audio/mpeg" });
  return response.arrayBuffer();
}

/** POST bytes, get validated JSON back. */
export async function uploadBytes<T>(options: {
  path: string;
  body: Blob;
  contentType: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<T> {
  const response = await sendBytes({ ...options, accept: "application/json" });
  const parsed = options.schema.safeParse(await response.json());

  if (!parsed.success) {
    throw new ApiError("invalid_response", `Unexpected response from ${options.path}`, {
      path: options.path,
    });
  }

  return parsed.data;
}

/**
 * Turn a failed response into an `ApiError`, keeping the server's explanation.
 *
 * Reading the body can itself fail — a truncated response, a proxy's HTML error
 * page — so every step is guarded. The status is always known; the body is a
 * bonus.
 */
async function problemFrom(response: Response, path: string): Promise<ApiError> {
  let problem: Problem | undefined;

  try {
    const text = await response.text();
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (isProblem(parsed)) problem = parsed;
  } catch {
    // Not JSON, or not our JSON. The status still tells us what to say.
  }

  return new ApiError(kindOf(response.status), problem?.message ?? `HTTP ${response.status}`, {
    status: response.status,
    path,
    problem,
  });
}

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value &&
    typeof (value as Problem).message === "string"
  );
}

function kindOf(status: number): ApiError["kind"] {
  if (status === 400 || status === 422) return "invalid_input";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}
