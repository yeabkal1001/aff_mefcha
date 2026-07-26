# Server

The API. Express 5, TypeScript, Prisma, Postgres. Owns the database, every
provider key, and all of the engine logic.

## Run it

```bash
cp .env.example .env   # Clerk and Gemini at minimum
pnpm db:up             # from the repo root — Postgres in Docker, on :55432
pnpm db:deploy         # apply migrations
pnpm db:seed           # load the curriculum
pnpm dev               # http://localhost:4000
```

`curl http://localhost:4000/ready` should return `{"status":"ready",…}`.

A missing or malformed environment variable is a startup crash naming the
variable, not a default. That is the whole design of `src/config/env.ts`: the
cheapest moment to discover a misconfiguration is before the first request.

## Boundary

**This package owns everything the browser must not see** — provider keys, the
database, mastery updates, scheduling, evaluation. The client gets JSON over
HTTP and nothing else. Every provider call is proxied through here, which is
also what makes the circuit breakers and the spend limits possible.

## Layout

```
src/
├── config/      environment, validated once at startup
├── core/        errors, logger, request context, resilience primitives
├── domain/      pure functions: planning, scoring, mastery. No I/O, heavily tested
├── http/        app assembly, middleware, health. Knows HTTP, knows no business rules
├── infra/       adapters: Prisma, and the AI providers behind ports
├── modules/     one folder per bounded context: routes → service → repository
├── jobs/        background sweeps
└── cli/         seed, and anything else run by hand
```

The dependency rule runs one way: `modules` may use `domain`, `infra` and
`core`; `domain` may use nothing. A rule the linter enforces directly is that a
`*.routes.ts` file may not import Prisma — a query in a route is business logic
no test can reach without going through HTTP, and no other caller can reuse.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | tsx watch, restarts on save |
| `pnpm build` / `pnpm start` | compile to `dist/`, run compiled |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | type-aware ESLint |
| `pnpm test` | Vitest — unit, service and API tests against a real database |
| `pnpm test:coverage` | with thresholds; `src/domain` is held to 95% |
| `pnpm db:migrate` | create and apply a migration |
| `pnpm db:deploy` | apply pending migrations, no prompts. What deploys run |
| `pnpm db:seed` | load the curriculum. Idempotent, so safe to re-run |
| `pnpm db:studio` | Prisma Studio |

## The data model

Specified in [`../docs/architecture/session-engine.md`](../docs/architecture/session-engine.md)
section 11, and the names there are binding:

- `learner_*`, never `user_*`
- `turn` holds the utterance, its audio and both transcripts; `attempt` holds one competency judgement pointing at a turn
- `attempt` stores `opportunities` and `correct`; `observed` is computed as their ratio, never stored
- there is no table for a Profile Dimension and no table for a learning plan — both are computed

The `coach-canon` skill fires on naming and will hold you to this.

## Testing

`tests/api.test.ts` runs the real application against the real database with
only Clerk's token verification stubbed. That boundary is chosen deliberately:
authorization bugs live in the wiring between middleware and handler, so
stubbing the service layer instead would leave the part most likely to be wrong
untested.

The domain tests are pure and cover the pedagogy — mastery updates, delivery
scoring, plan selection — because those are the rules that decide what a learner
is asked to do tomorrow, and they should be auditable without a database.
