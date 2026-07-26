# AI Communication Coach

An AI speaking coach for Ethiopian students and professionals. Voice conversations, bilingual correction in Amharic, and a Communication Profile that moves because it is measured rather than asserted.

**Read [`docs/product/persona.md`](./docs/product/persona.md) first.** It is the shortest path to understanding what this is, and it carries the demo script. Then [`docs/architecture/session-engine.md`](./docs/architecture/session-engine.md) if you want to know how it works.

## Getting started

Needs Node 20+, pnpm and Docker Desktop.

```bash
pnpm install
cp server/.env.example server/.env        # fill in Clerk and Gemini at minimum
cp client/.env.example client/.env.local  # the Clerk publishable key
pnpm db:up                                # Postgres in Docker, on :55432
pnpm --filter server db:deploy            # apply migrations
pnpm --filter server db:seed              # load the curriculum
pnpm dev                                  # client :3000, server :4000
```

`curl http://localhost:4000/ready` should answer `{"status":"ready"}`. If the
server refuses to start it will name the environment variable it is unhappy
with; that is deliberate, and cheaper than finding out per request.

Root scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `pnpm db:up`, `pnpm db:reset`, `pnpm db:studio`.

Deployment, secrets and key rotation: [`docs/ops/deployment.md`](./docs/ops/deployment.md).

## Client and server are separate

Two packages in one pnpm workspace, so the two halves of the team never block each other.

| | `client/` | `server/` |
| --- | --- | --- |
| Stack | Next.js 16, React 19, Tailwind 4 | Express 5, Prisma, Postgres |
| Port | 3000 | 4000 |
| Owns | Everything the learner sees | The database, every provider key, all engine logic |
| Never has | A provider key, a database query | An opinion about layout |

They meet at exactly one place: HTTP at `NEXT_PUBLIC_API_URL`. Each package has its own README with the rules for that side.

## Where everything lives

```
README.md                    you are here
CONTEXT.md                   the glossary — binding for code, prompts and UI copy
AGENTS.md                    agent configuration
docker-compose.yml           Postgres, and Adminer on :8080
client/                      Next.js app — see client/README.md
server/                      Node API — see server/README.md
docs/
├── product/
│   ├── persona.md           ★ the narrative, the personas, the demo script
│   └── vision.md            scope, screens, what ships this weekend
├── architecture/
│   ├── session-engine.md    ★ data model, scoring, scheduling, mastery
│   ├── learning-engine.md   the eight pedagogical stages behind a session
│   └── integrations.md      which provider does what, and how it is wired
├── ops/
│   └── deployment.md        Render, secrets, migrations, key rotation
├── curriculum/
│   ├── vocabulary.md        V001–V030, 201 sub-competencies
│   ├── grammar.md           G001–G028
│   ├── pronunciation.md     P001–P018
│   ├── fluency.md           F001–F020
│   ├── domains.md           Layer 1 — 30 CEFR domains, A2 to C2
│   ├── exercise-templates.md  Layer 2 — EX001–EX018
│   └── content-pack-a2-d01.md ★ the authored seed data the demo runs on
├── adr/                     five architecture decisions and why
└── agents/                  issue tracker, triage labels, domain doc rules
.cursor/skills/              four project skills
```

The three starred files are the ones you actually need to build the demo.

**Precedence.** On mechanics, `session-engine.md` wins. On story, `persona.md` wins. On the meaning of a word, `CONTEXT.md` wins.

## The two axes

CEFR level and Life Path are orthogonal, and this is the idea the whole product rests on.

**CEFR sets complexity. The Life Path sets context.**

`A2-D01 Personal Life` is one universal domain. Hana on `university_success` practises it in a lecture hall; Samuel on `hospitality` practises the same competencies in a hotel lobby. Six Life Paths cost six small config files, not six curricula. Adding a seventh requires no new curriculum authoring at all.

## How a session gets made

```
Learner Profile ─┐
                 ├─▶ Day Plan ──▶ Session ──▶ Turn ──▶ Attempt ──▶ Learner State
Life Path ───────┤     (theme)    (template   (audio +   (one         (mastery +
Curriculum ──────┤                + stimulus)  metrics)   competency)   stability)
Templates ───────┘                     ▲                                    │
      ▲                                │                                    │
      │                          Stimulus Pool                              │
      └──────────── scheduler: due when R < 0.85 ─────────────────────────────┘
```

Nothing is hardcoded and nothing is generated during a session. **Assets are built ahead, plans are not** — a nightly job tops up the Stimulus Pool, and the Day Plan is assembled each morning from whatever the learner model says is due. Nothing at all is stored above the Day Plan.

The one distinction to carry into every screen: **Rings are about showing up, the Profile is about getting better.** Never call a Profile Dimension a ring.

## Agent skills

Project skills live in `.cursor/skills/`. Three fire automatically when the work fits; one is typed by hand.

| Skill | Fires |
| --- | --- |
| `demo-fidelity` | Before building anything. Classifies work as load-bearing, prop or cut, and holds the pre-decided ledger for this MVP |
| `coach-canon` | When naming a variable, table, type or route, so code binds to `CONTEXT.md` |
| `voice-pipeline` | When touching audio, transcription or speech output. Holds the API constants that break silently |
| `/demo-rehearsal` | Typed by hand, three hours before the pitch |

## The four dimensions

**Grammar, Vocabulary, Fluency and Sentence Structure.** That is the whole list,
and it is a closed one — a Profile Dimension is not something a feature adds.
Sentence Structure replaced Pronunciation because scoring phonemes needs a model
this stack does not have, and a dimension that cannot be measured is a number
that gets asserted. See [`docs/adr/0008`](./docs/adr/).

## Providers

| Job | Runs on | If it is unavailable |
| --- | --- | --- |
| Speech to text | Web Speech API, in the browser | Whisper, server-side, when a turn is worth the round trip |
| Text to speech | Web Speech API, in the browser | ElevenLabs, server-side, for devices with poor built-in voices |
| Conversation director | Gemini Flash | A scripted fallback director, so a session never dead-ends |
| Grading | Gemini Pro | The turn is stored ungraded and retried |

Speech runs in the browser by default. That is a deliberate choice rather than a
cost saving: it removes a round trip from the middle of a conversation, and the
latency of a coach that pauses for a second before every reply is the difference
between practising and waiting. Every outbound provider call is wrapped in a
timeout, bounded retries and a circuit breaker.

## Current state

The backend and the client are both built and wired to each other. Migrations,
seed data, Docker image and Render blueprint are in the repository, and
`pnpm typecheck && pnpm lint && pnpm test` is green across both packages.

**Known limitations, deliberately accepted:**

- `P001`–`P003` (segmental pronunciation) are `observable: false`. No model in the stack scores phonemes, so the engine never targets them.
- A1 is out of scope. Every library starts at A2.
- Because only A2 content exists, placement puts every learner at A2 — by a mechanism that will place higher once B1 content is authored.
- Content beyond the A2-D01 pack is unauthored: descriptors for the remaining templates, requirement roles on the other 29 domains, and the `hospitality` Life Path skin.
