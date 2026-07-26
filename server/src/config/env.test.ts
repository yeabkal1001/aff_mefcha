import { describe, expect, it } from "vitest";

import { parseEnv } from "./env.js";

/**
 * The configuration gate.
 *
 * Worth testing carefully despite being "just parsing", because everything it
 * catches is something that would otherwise be caught in production: a key
 * pasted half-way, a test credential promoted by accident, a proxy count that
 * hands anyone a fresh rate-limit bucket. Each case below is a real way to
 * deploy a broken instance that passes its own health check.
 */

/** Decodes to `fake.clerk.accounts.dev$`, which is the shape Clerk expects. */
const PUBLISHABLE = "pk_test_ZmFrZS5jbGVyay5hY2NvdW50cy5kZXYk";
const LIVE_PUBLISHABLE = "pk_live_ZmFrZS5jbGVyay5hY2NvdW50cy5kZXYk";

function base(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgresql://coach:coach@localhost:55432/english_coach",
    CLERK_PUBLISHABLE_KEY: PUBLISHABLE,
    CLERK_SECRET_KEY: "sk_test_fake",
    GEMINI_API_KEY: "fake",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

describe("required values", () => {
  it("parses a minimal development environment", () => {
    const env = parseEnv(base());

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.CLIENT_ORIGINS).toEqual(["http://localhost:3000"]);
  });

  it("refuses to start without a database", () => {
    expect(() => parseEnv(base({ DATABASE_URL: undefined }))).toThrow(/DATABASE_URL/);
  });

  it("names every problem at once rather than one per restart", () => {
    // Reporting the first failure only turns configuring a new environment
    // into a guessing game of restart, read, fix, restart.
    const attempt = () =>
      parseEnv(base({ DATABASE_URL: undefined, GEMINI_API_KEY: undefined }));

    expect(attempt).toThrow(/DATABASE_URL/);
    expect(attempt).toThrow(/GEMINI_API_KEY/);
  });
});

describe("the Clerk publishable key", () => {
  it("accepts a well-formed key", () => {
    expect(parseEnv(base()).CLERK_PUBLISHABLE_KEY).toBe(PUBLISHABLE);
  });

  it("rejects one that is merely non-empty", () => {
    // The failure this prevents: Clerk parses the key on the first
    // authenticated request, not at construction, so a typo yields an instance
    // that is healthy by its own health check and 500s every real request.
    expect(() => parseEnv(base({ CLERK_PUBLISHABLE_KEY: "pk_test_placeholder" }))).toThrow(
      /CLERK_PUBLISHABLE_KEY/,
    );
  });

  it("rejects a secret key pasted into the publishable slot", () => {
    expect(() => parseEnv(base({ CLERK_PUBLISHABLE_KEY: "sk_test_fake" }))).toThrow(
      /CLERK_PUBLISHABLE_KEY/,
    );
  });
});

describe("production invariants", () => {
  function production(overrides: Record<string, string | undefined> = {}) {
    return base({
      NODE_ENV: "production",
      CLIENT_ORIGINS: "https://coach.example.com",
      CLERK_PUBLISHABLE_KEY: LIVE_PUBLISHABLE,
      CLERK_SECRET_KEY: "sk_live_fake",
      CLERK_WEBHOOK_SIGNING_SECRET: "whsec_fake",
      ...overrides,
    });
  }

  it("accepts a complete production environment", () => {
    expect(parseEnv(production()).NODE_ENV).toBe("production");
  });

  it("refuses a test secret key", () => {
    expect(() => parseEnv(production({ CLERK_SECRET_KEY: "sk_test_fake" }))).toThrow(
      /CLERK_SECRET_KEY/,
    );
  });

  it("refuses a localhost origin", () => {
    // A developer's origin left in the allowlist is a credentialed API that
    // trusts anything running on the reader's own machine.
    expect(() =>
      parseEnv(production({ CLIENT_ORIGINS: "https://coach.example.com,http://localhost:3000" })),
    ).toThrow(/CLIENT_ORIGINS/);
  });

  it("refuses a missing webhook secret", () => {
    // Without it, deleting an account in Clerk leaves the learner live here.
    expect(() => parseEnv(production({ CLERK_WEBHOOK_SIGNING_SECRET: undefined }))).toThrow(
      /CLERK_WEBHOOK_SIGNING_SECRET/,
    );
  });

  it("allows all of it in development, where none of it is a defect", () => {
    const env = parseEnv(
      base({ CLIENT_ORIGINS: "http://localhost:3000", CLERK_SECRET_KEY: "sk_test_fake" }),
    );

    expect(env.CLERK_WEBHOOK_SIGNING_SECRET).toBeUndefined();
  });
});

describe("values that are dangerous when wrong rather than absent", () => {
  it("parses the origin list into entries, trimming as it goes", () => {
    const env = parseEnv(
      base({ CLIENT_ORIGINS: " https://a.example.com , https://b.example.com ," }),
    );

    expect(env.CLIENT_ORIGINS).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("holds the proxy count to a plausible range", () => {
    // Too high and a client spoofs X-Forwarded-For for a fresh rate-limit
    // bucket per request. There is no deployment with eleven proxies in it.
    expect(() => parseEnv(base({ TRUST_PROXY_HOPS: "40" }))).toThrow(/TRUST_PROXY_HOPS/);
    expect(parseEnv(base({ TRUST_PROXY_HOPS: "0" })).TRUST_PROXY_HOPS).toBe(0);
  });

  it("rejects a non-numeric port rather than defaulting past it", () => {
    expect(() => parseEnv(base({ PORT: "not-a-port" }))).toThrow(/PORT/);
  });

  it("freezes the result, so nothing can reconfigure the process at runtime", () => {
    const env = parseEnv(base());

    expect(Object.isFrozen(env)).toBe(true);
  });
});
