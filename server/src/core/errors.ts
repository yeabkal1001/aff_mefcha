/**
 * The error model.
 *
 * One class, one shape on the wire, one place that decides what a client is
 * allowed to see. The alternative — throwing strings, or plain `Error`s that a
 * handler tries to classify by reading their message — leaks internals the
 * moment somebody rewords a message, and makes "which of these is a 4xx"
 * unanswerable.
 *
 * The wire format is RFC 9457 `application/problem+json`, because it already
 * exists, clients can parse it generically, and it has a slot for the
 * machine-readable code the UI actually branches on.
 */

/**
 * Stable, machine-readable failure codes.
 *
 * Clients branch on these; they are API surface and renaming one is a breaking
 * change. HTTP status alone is not enough — a 409 on a session start and a 409
 * on a duplicate turn need different handling in the UI.
 */
export const ErrorCode = {
  VALIDATION_FAILED: "validation_failed",
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",
  /** The request was valid but the resource is in the wrong state for it. */
  INVALID_STATE: "invalid_state",
  RATE_LIMITED: "rate_limited",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  UNSUPPORTED_MEDIA_TYPE: "unsupported_media_type",
  /** A provider we depend on failed, timed out, or is being shed by a breaker. */
  UPSTREAM_UNAVAILABLE: "upstream_unavailable",
  INTERNAL: "internal",
  SERVICE_UNAVAILABLE: "service_unavailable",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level detail for a failed validation, in the order the client should show it. */
export interface FieldIssue {
  /** Dotted path into the request body, query or params. */
  path: string;
  message: string;
}

export interface AppErrorOptions {
  /** Structured detail attached to logs. Never sent to the client. */
  context?: Record<string, unknown>;
  /** The original failure, preserved for the log. */
  cause?: unknown;
  /** Per-field messages, for `VALIDATION_FAILED`. These *are* sent. */
  issues?: FieldIssue[];
  /** Seconds until the client may retry. Emitted as `Retry-After`. */
  retryAfterSeconds?: number;
}

/**
 * An error whose message is safe to show a user.
 *
 * That is the whole distinction this type carries. Anything thrown that is not
 * an `AppError` is treated as a bug: it is logged in full and reported to the
 * client as a bare 500 with no detail, because we cannot know whether its
 * message contains a connection string, a prompt, or somebody's transcript.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;
  readonly issues?: FieldIssue[];
  readonly retryAfterSeconds?: number;
  /**
   * Whether this is worth waking someone for.
   *
   * 4xx are the client's problem and are logged at `warn`; 5xx are ours and are
   * logged at `error`. Splitting on the status rather than on a hand-set flag
   * means a new error type cannot accidentally arrive as un-alertable.
   */
  readonly expected: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.context = options.context;
    this.issues = options.issues;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.expected = status < 500;

    // Keeps the constructor itself out of the stack, so the top frame is the
    // line that actually failed.
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, options?: AppErrorOptions) {
    return new AppError(400, ErrorCode.VALIDATION_FAILED, message, options);
  }

  static validation(issues: FieldIssue[], options?: AppErrorOptions) {
    return new AppError(
      400,
      ErrorCode.VALIDATION_FAILED,
      "The request body did not match what this endpoint expects.",
      { ...options, issues },
    );
  }

  static unauthenticated(
    message = "You need to be signed in to do this.",
    options?: AppErrorOptions,
  ) {
    return new AppError(401, ErrorCode.UNAUTHENTICATED, message, options);
  }

  /**
   * Deliberately vague, and deliberately the same message for "you may not" and
   * "it is not yours". Distinguishing them turns any authorization check into
   * an existence oracle: try IDs until the message changes and you have
   * enumerated another learner's sessions.
   */
  static forbidden(
    message = "You don't have access to this.",
    options?: AppErrorOptions,
  ) {
    return new AppError(403, ErrorCode.FORBIDDEN, message, options);
  }

  static notFound(what = "That", options?: AppErrorOptions) {
    return new AppError(404, ErrorCode.NOT_FOUND, `${what} could not be found.`, options);
  }

  static conflict(message: string, options?: AppErrorOptions) {
    return new AppError(409, ErrorCode.CONFLICT, message, options);
  }

  /** Right resource, wrong state — finishing a session that already finished. */
  static invalidState(message: string, options?: AppErrorOptions) {
    return new AppError(409, ErrorCode.INVALID_STATE, message, options);
  }

  static rateLimited(retryAfterSeconds: number, options?: AppErrorOptions) {
    return new AppError(
      429,
      ErrorCode.RATE_LIMITED,
      "You're going too fast. Wait a moment and try again.",
      { ...options, retryAfterSeconds },
    );
  }

  static upstream(provider: string, options?: AppErrorOptions) {
    return new AppError(
      503,
      ErrorCode.UPSTREAM_UNAVAILABLE,
      "The coach is briefly unavailable. Your progress is saved — try again in a moment.",
      { ...options, context: { provider, ...options?.context } },
    );
  }

  static internal(message: string, options?: AppErrorOptions) {
    return new AppError(500, ErrorCode.INTERNAL, message, options);
  }
}

/** RFC 9457 problem detail. The only error shape this API emits. */
export interface ProblemDetail {
  /** Stable code the client branches on. */
  code: ErrorCode;
  /** Human-readable, safe to display. */
  message: string;
  status: number;
  /** Echoed from the request, so a user can quote it in a bug report. */
  requestId: string;
  issues?: FieldIssue[];
}

/**
 * Everything that is not an `AppError` becomes an opaque 500.
 *
 * This is the containment boundary: a Prisma error mentioning a column, a
 * provider SDK error quoting a URL with a key in it, a `TypeError` from our own
 * bug — all of them arrive here and leave as the same seven words.
 */
export function toProblem(error: unknown, requestId: string): ProblemDetail {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      requestId,
      ...(error.issues ? { issues: error.issues } : {}),
    };
  }

  return {
    code: ErrorCode.INTERNAL,
    message: "Something went wrong on our end. This has been logged.",
    status: 500,
    requestId,
  };
}
