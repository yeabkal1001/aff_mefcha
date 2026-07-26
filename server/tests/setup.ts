/**
 * Environment for the test run.
 *
 * Set before anything imports `config/env.ts`, because that module validates on
 * load and throws on a missing variable — which would otherwise make every test
 * file fail with a configuration error rather than a useful one.
 *
 * These are obviously fake and are never sent anywhere: the tests that touch a
 * provider use a stub adapter, and the ones that touch the database use the
 * local container.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://coach:coach@localhost:55432/english_coach?schema=public";
// Fake, but well-formed: the config validates the encoding, and a key that
// only satisfies `.min(1)` would mean the tests never exercise the real schema.
// Decodes to "fake.clerk.accounts.dev$".
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_ZmFrZS5jbGVyay5hY2NvdW50cy5kZXYk";
process.env.CLERK_SECRET_KEY ??= "sk_test_fake";
process.env.GEMINI_API_KEY ??= "fake-gemini-key";
process.env.LOG_LEVEL = "silent";
