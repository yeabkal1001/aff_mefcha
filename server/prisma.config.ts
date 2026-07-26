import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

/**
 * Prisma's own configuration, replacing the deprecated `package.json#prisma`
 * block. Only the seed command needs declaring; everything else is defaulted.
 *
 * Declaring a config file switches off Prisma's automatic `.env` loading, so
 * the CLI would otherwise not see `DATABASE_URL`. Loading it here keeps
 * `prisma migrate` working from a bare shell. Guarded because CI and Render
 * supply the variable through the real environment and have no `.env` at all.
 */
if (existsSync(".env")) process.loadEnvFile(".env");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx src/cli/seed.ts",
  },
});
