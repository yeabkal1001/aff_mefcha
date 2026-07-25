# Server

The API. FastAPI, SQLAlchemy 2.0 async, Alembic, PostgreSQL. Owns the database, every
provider key, and all the engine logic.

## Run it

Needs Python 3.12+ and a local PostgreSQL. From the repo root:

```bash
psql -U postgres -h localhost -f server/scripts/create_db.sql   # once, prompts for the superuser password
cd server
python -m venv .venv
.venv/Scripts/python.exe -m pip install -e .                    # or: uv sync
cp .env.example .env                                            # then fill in the provider keys
.venv/Scripts/python.exe -m alembic upgrade head
.venv/Scripts/python.exe -m app.seed.run                        # load the A2-D01 content pack
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 4000
```

On macOS or Linux use `.venv/bin/python` throughout. `curl http://localhost:4000/health`
should answer, and the interactive docs are at `http://localhost:4000/docs`.

`uv` is the intended tool and `pyproject.toml` is the single dependency source, but a
plain venv with pip works and is what the setup fell back to when the hackathon network
could not hold a 27 MB download.

Postgres runs locally. `docker compose up -d postgres` from the root is kept as a
fallback and expects the same role, database and port.

## Scripts

Root-level shortcuts, all of which shell into this package:

| Command | Does |
| --- | --- |
| `pnpm dev:server` | uvicorn with reload on :4000 |
| `pnpm db:create` | create the `coach` role and `english_coach` database |
| `pnpm db:migrate` | apply migrations |
| `pnpm db:revision` | autogenerate a migration from the models |
| `pnpm db:seed` | load the authored content pack, idempotently |
| `pnpm db:reset` | migrations down, up, reseed |
| `pnpm test:server` | pytest |
| `pnpm lint:server` | ruff |

## Boundary

**This package owns everything the browser must not see.** Provider keys, the database,
mastery updates, scheduling, evaluation. The client gets JSON over HTTP and a
short-lived Wispr Flow token, and nothing else.

The rule that matters: the fal SDK warns against exposing `FAL_KEY`, and the Addis docs
show an `apiKey` query parameter that must never reach a browser. Proxy both.

## Layout

```
app/
├── main.py            FastAPI app and /health
├── config.py          settings from .env, nothing hardcoded
├── clock.py           the one clock the engine reads — Day Three lives here
├── db.py              async engine, session factory, Base
├── schemas.py         request and response shapes
├── models/            the data model from session-engine.md section 11
├── engine/            the rules: no HTTP, no framework
│   ├── constants.py     every tunable number, with its source
│   ├── retrievability.py R = exp(-dt/S), due below 0.85
│   ├── mastery.py       the alpha-weighted update — a pure function
│   ├── priority.py      why one competency is practised before another
│   ├── selection.py     candidates from the curriculum and the learner model
│   ├── session_builder.py template scoring and the stimulus fallback chain
│   ├── day_plan.py      Today's Mission
│   ├── evaluator.py     authored error tags to opportunity counts
│   ├── metrics.py       word timestamps to delivery numbers
│   ├── delivery.py      delivery metrics as evidence on competencies
│   ├── placement.py     the global complexity read
│   └── profile.py       Profile Dimensions, computed at read time
├── services/          orchestration that writes: grading, onboarding, reflection
├── routes/            HTTP only — no rules live here
└── seed/              the authored content pack as data
```

`engine/` is deliberately free of FastAPI and mostly free of the database. The mastery
update and the retrievability model are pure functions because they are the two things
a judge is most likely to ask to see.

## The rules that are not negotiable

The model is specified in
[`../docs/architecture/session-engine.md`](../docs/architecture/session-engine.md),
section 11, and the names are binding:

- `learner_*`, never `user_*`
- `turn` holds the utterance, its audio and both transcripts; `attempt` holds one
  competency judgement pointing at a turn
- `attempt` stores `opportunities` and `correct`; `observed` is their ratio, computed on
  read, and zero opportunities means no evidence rather than a zero
- there is no table for a Profile Dimension and none for a learning plan — both are
  computed
- one session-and-competency pair is one piece of evidence, however many retries it took

The `coach-canon` skill fires on naming and will hold you to this.

## What is left to build

Steps 2 to 5 of the build order in the root `README.md`: the provider layer. The
engine, the schema and the content are in place, so what remains is Wispr Flow token
minting, fal Whisper and TTS, the Addis AI Amharic line, and the conversation director.
`POST /sessions/{id}/turns` already accepts word chunks, so the measurement path can be
exercised with a recorded fixture before any provider is wired.
