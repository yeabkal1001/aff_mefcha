import { z } from "zod";

/**
 * Every environment variable the server reads, in one place, validated once.
 *
 * The rule this enforces: `process.env` is touched exactly here and nowhere
 * else. Reading it inline elsewhere means a typo becomes `undefined`, which
 * becomes a default, which becomes a production incident that reproduces on no
 * developer's machine. Here a missing or malformed value is a startup crash
 * with the variable named — the cheapest possible moment to find out.
 *
 * Anything secret is `.min(1)` rather than optional-with-a-default. There is no
 * safe default for a credential.
 */

/**
 * A Clerk publishable key: `pk_test_` or `pk_live_` followed by the base64 of
 * the instance's frontend API host with a `$` terminator.
 *
 * Reimplemented rather than imported from `@clerk/backend` because that module
 * pulls in the whole SDK, and this file is the one thing that must be able to
 * run before anything else is wired up.
 */
function isClerkPublishableKey(value: string): boolean {
  const prefix = ["pk_test_", "pk_live_"].find((p) => value.startsWith(p));
  if (!prefix) return false;

  try {
    return Buffer.from(value.slice(prefix.length), "base64").toString("utf8").endsWith("$");
  } catch {
    return false;
  }
}

/** Comma-separated list, trimmed, empties dropped. */
const csv = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

/**
 * An optional credential, where blank means absent.
 *
 * `.optional()` alone accepts only `undefined`, but a `.env` copied from
 * `.env.example` is full of `KEY=` lines, and dotenv reads those as `""`. The
 * result was a server that refused to start over an *optional* variable,
 * reporting "must contain at least 1 character" about a key nobody needs —
 * which is a confusing error about the wrong problem, and it hid the two real
 * ones underneath it.
 *
 * Required credentials deliberately do not get this treatment. There, blank and
 * absent mean the same thing and both must stop the process.
 */
function optionalSecret() {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(1).optional(),
  );
}

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    /** Render injects this. Locally it is whatever you pick. */
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),

    /**
     * Browser origins allowed to call the API. Not a wildcard, ever: the API
     * is credentialed, and `Access-Control-Allow-Origin: *` with credentials is
     * both refused by browsers and the wrong intent.
     */
    CLIENT_ORIGINS: csv.default("http://localhost:3000"),

    /** Postgres. Render supplies this; `docker-compose.yml` matches it locally. */
    DATABASE_URL: z.string().url(),

    /**
     * Statement timeout applied to every query, in milliseconds.
     *
     * A query with no ceiling is a connection that never returns to the pool,
     * and a pool that never refills is an outage. This is deliberately shorter
     * than the HTTP timeout so the database gives up before the client does.
     */
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(8_000),

    // --- authentication ---------------------------------------------------
    /**
     * Clerk. Verification is offline against Clerk's JWKS, so both are needed.
     *
     * The publishable key is checked for shape, not merely for presence,
     * because Clerk parses it lazily — on the first authenticated request
     * rather than at construction. A typo therefore produces a healthy
     * instance that 500s every real request while passing its own health
     * check, which is the worst of the available failure modes. Ten lines of
     * validation here turns it back into a startup crash.
     */
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .refine(isClerkPublishableKey, {
        message:
          "must be a Clerk publishable key — pk_test_… or pk_live_…, copied whole from the dashboard. " +
          "It is the same value the client uses as NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      }),
    CLERK_SECRET_KEY: z
      .string()
      .refine((value) => /^sk_(test|live)_.+/.test(value), {
        message:
          "must be a Clerk secret key — sk_test_… or sk_live_…, from the same Clerk instance as the publishable key",
      }),
    /** Signing secret for the `/v1/webhooks/clerk` endpoint. */
    CLERK_WEBHOOK_SIGNING_SECRET: optionalSecret(),

    // --- model providers --------------------------------------------------
    /** Gemini runs both the conversation director and the evaluator. */
    GEMINI_API_KEY: z.string().min(1),
    GEMINI_DIRECTOR_MODEL: z.string().min(1).default("gemini-2.5-flash"),
    /**
     * Grading is the one call whose output is written to the learner model, so
     * it gets the stronger model even though it costs more and runs slower —
     * it is off the critical path of the conversation.
     */
    GEMINI_EVALUATOR_MODEL: z.string().min(1).default("gemini-2.5-pro"),

    /**
     * Optional. The browser's own speech synthesis is the default voice; this
     * is the upgrade for learners on a device whose built-in voices are poor.
     */
    ELEVENLABS_API_KEY: optionalSecret(),
    ELEVENLABS_VOICE_ID: z.string().min(1).default("21m00Tcm4TlvDq8ikWAM"),

    /**
     * Optional. Web Speech gives us a transcript but no timings, so fluency is
     * measured from client-side turn timing. Whisper is the upgrade path to
     * word-level timestamps when a turn is worth the round trip.
     */
    WHISPER_API_KEY: optionalSecret(),
    WHISPER_API_URL: z.string().url().default("https://api.openai.com/v1/audio/transcriptions"),

    // --- behaviour --------------------------------------------------------
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    /** Requests per window per principal, applied to the whole API. */
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    /** A much tighter budget for the endpoints that spend money at a provider. */
    RATE_LIMIT_AI_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_AI_MAX: z.coerce.number().int().positive().default(30),

    /** How long to let in-flight requests finish after SIGTERM. */
    SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(15_000),

    /**
     * Trust `X-Forwarded-For` from this many hops of proxy.
     *
     * Must be exact. Too low and every client shares the load balancer's IP,
     * so one abuser rate-limits everybody; too high and a client can spoof the
     * header and get a fresh bucket per request. Render puts one proxy in
     * front of the service.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;

    // Production-only invariants. These are warnings-turned-errors: each one
    // is something that works fine in development and is a real defect live.
    if (value.CLIENT_ORIGINS.some((origin) => origin.includes("localhost"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLIENT_ORIGINS"],
        message: "must not contain localhost in production",
      });
    }
    if (!value.CLERK_SECRET_KEY.startsWith("sk_live_")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLERK_SECRET_KEY"],
        message: "is a test key; production needs sk_live_…",
      });
    }
    if (!value.CLERK_WEBHOOK_SIGNING_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLERK_WEBHOOK_SIGNING_SECRET"],
        message:
          "is required in production, or deleted accounts are never reflected here",
      });
    }
  });

export type Env = z.infer<typeof schema>;

/**
 * Parse and freeze the environment.
 *
 * Exported as a function so tests can build a config without touching the real
 * process environment, and called once at module load for everything else.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);

  if (!result.success) {
    // Deliberately not the logger: this runs before the logger is configured,
    // and a config error that only appears as structured JSON in a log
    // aggregator is a config error nobody reads.
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"} — ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment. The server will not start.\n${problems}\n\n` +
        `Locally these come from server/.env; in production they are the service's\n` +
        `environment variables. server/.env.example documents every one of them.`,
    );
  }

  return Object.freeze(result.data);
}

export const env = parseEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
