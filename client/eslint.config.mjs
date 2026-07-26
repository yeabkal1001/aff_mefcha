import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    // Screens do not fetch. A route that calls the API directly gets no cache,
    // no retry, no shared invalidation and no consistent error shape — all of
    // which `hooks/queries` already provides, and all of which get quietly
    // reinvented, differently, the second time someone bypasses it.
    //
    // Scoped to `app/` deliberately. Two components under `components/` are
    // infrastructure rather than screens — `auth-bridge` hands Clerk's token to
    // the transport, `profile-sync` replays the onboarding draft once — and
    // both legitimately talk to the API layer.
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/api/endpoints",
              message:
                "Screens do not fetch. Take the data as a prop, or call a hook in hooks/queries.",
            },
            {
              name: "@/lib/api/http",
              message:
                "The transport is not a screen's concern. Add an endpoint, then a hook in hooks/queries.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
