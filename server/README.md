# Server

The Node API. Express 5, TypeScript, Prisma, Postgres. Owns the database, every provider key, and all the engine logic.

## Run it

```bash
cp .env.example .env      # then fill in the provider keys
pnpm db:up                # from the repo root — starts Postgres in Docker
pnpm db:generate
pnpm dev                  # http://localhost:4000
```

`curl http://localhost:4000/health` should return `{"ok":true,...}`.

## Boundary

**This package owns everything the browser must not see.** Provider keys, the database, mastery updates, scheduling, evaluation. The client gets JSON over HTTP and a short-lived Wispr Flow token, and nothing else.

The rule that matters: the fal SDK warns against exposing `FAL_KEY`, and the Addis docs show an `apiKey` query parameter that must never reach a browser. Proxy both.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | tsx watch, restarts on save |
| `pnpm build` / `pnpm start` | compile to `dist/`, run compiled |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:migrate` | create and apply a migration |
| `pnpm db:push` | push schema without a migration, for fast iteration |
| `pnpm db:studio` | Prisma Studio — the fastest way to show a judge the rows are real |

## What to build, in order

Steps 1 to 7 of the build order in the root `README.md`. The short version: prove the measurement path works before writing a single line of conversation logic. A working analysis track with no coach is a demo; a coach with invented numbers is a liability.

## Before you write the schema

`prisma/schema.prisma` has a datasource and nothing else, deliberately. The model is specified in [`../docs/architecture/session-engine.md`](../docs/architecture/session-engine.md), section 11, and the names are binding:

- `learner_*`, never `user_*`
- `turn` holds the utterance, its audio and both transcripts; `attempt` holds one competency judgement pointing at a turn
- `attempt` stores `opportunities` and `correct`; `observed` is computed as their ratio, never stored
- there is no table for a Profile Dimension and no table for a learning plan — both are computed

The `coach-canon` skill fires on naming and will hold you to this.
