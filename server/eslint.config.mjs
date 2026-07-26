import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

/**
 * Lint rules for the server.
 *
 * Type-aware linting is on. It costs a few seconds per run and it is the only
 * way to catch the class of bug this codebase is most exposed to: a promise
 * that is never awaited. Every route handler, every Prisma call and every AI
 * call is async, and a dropped `await` inside a transaction silently commits
 * nothing while the request returns 200.
 *
 * The bans below are not style. Each one has a working alternative in the
 * codebase and allowing both would produce two ways to do the same thing.
 */
export default defineConfig([
  // This file is excluded because type-aware linting needs the file in a TS
  // project, and putting a `.mjs` in one means turning on `allowJs` for the
  // build. Linting the lint config is not worth that.
  globalIgnores(["dist/**", "coverage/**", "prisma/migrations/**", "eslint.config.mjs"]),

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      // A lint-only project, because `tsconfig.json` includes `src` alone — it
      // describes what gets compiled into `dist`, and config files and tests
      // are not that. Linting them against the build project makes every one of
      // them a parse error.
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A floating promise in a request handler is a request that returns
      // before its work finished, and an unhandled rejection that takes the
      // process down under load.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // `_` prefix is the documented way to say "deliberately unused" — which
      // Express needs, because an error handler is only an error handler if it
      // declares four parameters.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      // Implementing an async interface with a synchronous body is correct, not
      // a mistake — the fallback director and the capabilities endpoint both do
      // it — so this rule would only ever be satisfied by adding a pointless
      // `await`.
      "@typescript-eslint/require-await": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "dotenv",
              message:
                "Environment parsing lives in src/config/env.ts, which validates. Node loads .env itself via --env-file.",
            },
          ],
        },
      ],
      // `console` bypasses redaction and correlation IDs, so anything it prints
      // is both unsearchable and a candidate for leaking a token into logs.
      "no-console": "error",
    },
  },

  {
    // Route files map URLs to service calls. A query here is business logic
    // that no test can reach without going through HTTP, and no other caller
    // can reuse — which is how the same `include` ends up written twice and
    // drifts.
    // Health is the exception: its whole job is to touch the database, and
    // routing that through a service would add a layer that does nothing.
    ignores: ["src/http/health.routes.ts"],
    files: ["src/**/*.routes.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/infra/db/prisma.js", "**/infra/db/prisma.ts"],
              message:
                "Routes do not query. Put it in the module's service and call that.",
            },
          ],
        },
      ],
    },
  },

  {
    // Command-line scripts and config run outside the server. There is no
    // request to correlate them to and no logger transport configured, and
    // their output is read by a person watching a terminal, not shipped
    // anywhere. `console` is the right tool there and the only one.
    files: ["src/cli/**/*.ts", "prisma/**/*.ts", "*.config.ts", "*.config.mjs"],
    rules: { "no-console": "off" },
  },

  {
    files: ["tests/**/*.ts", "src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },
]);
