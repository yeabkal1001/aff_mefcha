import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Domain tests are pure and fast; the API tests share one in-memory app.
    // Threads rather than forks keeps startup under a second.
    pool: "threads",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Wiring and vendor adapters. Their correctness is proved by the API
      // tests going through them, not by covering their lines.
      exclude: ["src/main.ts", "src/**/*.test.ts", "src/infra/ai/gemini.ts"],
      thresholds: {
        // Deliberately modest overall, and strict where it matters — see the
        // per-file thresholds below. A high global number is easy to reach by
        // testing getters and tells you nothing.
        lines: 55,
        functions: 55,
        "src/domain/**/*.ts": { lines: 95, functions: 95, branches: 90 },
      },
    },
  },
});
