/**
 * One error type for everything that can go wrong at the boundary.
 *
 * Components should never have to tell a `TypeError: Failed to fetch` from a
 * 500 from a schema mismatch — they need to know whether to say "check your
 * connection", "try again", or "something is wrong on our side". `kind` is
 * that decision, and `userMessage` is the sentence for each.
 */
export type ApiErrorKind =
  | "offline"
  | "timeout"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "invalid_input"
  | "conflict"
  | "rate_limited"
  | "server"
  | "invalid_response"
  | "unknown";

/**
 * The server's error body, RFC 9457 `application/problem+json`.
 *
 * Worth parsing rather than discarding, for one reason: `message` is written
 * for a learner to read. A generic "something went wrong" in place of "That
 * exercise has already finished" turns an explicable state into a mystery.
 */
export interface Problem {
  code: string;
  message: string;
  status: number;
  requestId?: string;
  issues?: { path: string; message: string }[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly path?: string;
  /** The server's own explanation, when it gave one fit to show. */
  readonly problem?: Problem;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options?: {
      status?: number;
      path?: string;
      cause?: unknown;
      problem?: Problem;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options?.status;
    this.path = options?.path;
    this.problem = options?.problem;
  }

  /** Worth a second attempt. A 404 is not; a dropped connection is. */
  get retryable(): boolean {
    return (
      this.kind === "offline" || this.kind === "timeout" || this.kind === "server"
    );
  }

  /**
   * What a learner should read.
   *
   * The server's message wins when there is one, because it is the only party
   * that knows *which* thing went wrong. The fallbacks below cover the cases
   * where no response arrived at all, or arrived without a body — and a 500 is
   * deliberately not among the cases where the server's text is trusted, since
   * that text is a redacted placeholder by design.
   */
  get userMessage(): string {
    if (this.problem && this.problem.status < 500) return this.problem.message;

    switch (this.kind) {
      case "offline":
        return "You appear to be offline. Check your connection and try again.";
      case "timeout":
        return "That took too long. The coach may be waking up — try again.";
      case "not_found":
        return "We couldn't find that.";
      case "unauthorized":
        return "You'll need to sign in again to see this.";
      case "forbidden":
        return "You don't have access to that.";
      case "invalid_input":
        return "Something in that wasn't quite right. Check it and try again.";
      case "conflict":
        return "That has already happened.";
      case "rate_limited":
        return "That's a lot at once. Give it a moment and try again.";
      case "server":
        return "Something went wrong on our side. Trying again usually works.";
      case "invalid_response":
        return "We got an answer we didn't understand. This is our bug, not yours.";
      case "unknown":
        return "Something went wrong. Try again.";
    }
  }
}

export function toApiError(error: unknown, path?: string): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError("timeout", "Request aborted", { path, cause: error });
  }
  if (error instanceof TypeError) {
    // What `fetch` throws when the network is unreachable.
    return new ApiError("offline", "Network request failed", {
      path,
      cause: error,
    });
  }
  return new ApiError("unknown", "Unexpected failure", { path, cause: error });
}
