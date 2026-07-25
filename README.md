# AI Communication Coach

An AI speaking coach for Ethiopian students and professionals. Voice conversations, bilingual correction in Amharic, and a Communication Profile that moves because it is measured rather than asserted.

**Read [`docs/product/persona.md`](./docs/product/persona.md) first.** It is the shortest path to understanding what this is, and it carries the demo script. Then [`docs/architecture/session-engine.md`](./docs/architecture/session-engine.md) if you want to know how it works.

## Getting started

Needs Node 20+, pnpm and Docker Desktop.

```bash
pnpm install                       # install both packages
cp server/.env.example server/.env # then fill in the provider keys
cp client/.env.example client/.env.local
pnpm db:up                         # Postgres in Docker
pnpm --filter server db:generate
pnpm dev                           # client :3000, server :4000
```

`curl http://localhost:4000/health` should answer. Root scripts: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm db:up`, `pnpm db:reset`, `pnpm db:studio`.

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
│   └── integrations.md      which hackathon API does what, and how to wire it
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

## Build order

From [`docs/architecture/integrations.md`](./docs/architecture/integrations.md). Steps 1 to 7 are the demo; everything after is upside.

1. Seed the content tables from `content-pack-a2-d01.md`.
2. Wispr Flow streaming into a live transcript — proves voice input works.
3. fal Whisper word-level analysis writing real metrics — proves the numbers are real.
4. Conversation director with mission context, English TTS from fal — proves it coaches.
5. Amharic correction line through Addis AI TTS — the emotional beat.
6. Retry loop and the before/after delta screen — proves measurable improvement.
7. Scheduler: retrievability decay and the template-variety penalty — produces the Day Three moment.

Step 7 is roughly forty lines against data the earlier steps already write, and it demonstrates more architecture than anything else. Do not let it get cut.

## Current state

Design is complete and internally consistent. **No code has been written yet.**

A grilling session found three real defects — retries inflating `evidence_count` into the promotion floor, placement that could never return a band above the one it probed, and utterance data stored on competency rows — plus the fact that the "30-day plan" the design described could never have been built. Changelog entries 13 to 20 in `session-engine.md` record the fixes; the five decisions carrying real trade-offs are in [`docs/adr/`](./docs/adr/).

**Content authored for the demo.** Fifteen `A2-D01` competency records with success criteria, common errors and Amharic L1 risk, plus full descriptors for `EX001`, `EX007` and `EX018`. `A2-D01` carries requirement roles. All 201 vocabulary sub-competencies have IDs and all 96 competencies have descriptions.

**Still to author:** generation metadata for every sub-competency outside the A2-D01 pack, descriptors for the remaining 15 templates, requirement roles on the other 29 domains, the thresholds that turn a delivery metric into an `observed`, and the `hospitality` Life Path skin for the Samuel half of the demo.

**Known limitations, deliberately accepted:**

- `P001`–`P003` (segmental pronunciation) are `observable: false`. No API in the stack scores phonemes, so the engine never targets them. `P001.08` is the exception: the Amharic confusion set is probed with minimal pairs and judged by the transcriber.
- A1 is out of scope. Every library starts at A2.
- Because only A2 content exists, placement puts every learner at A2 — by a mechanism that will place higher once B1 content is authored.

**The one assumption to test first:** whether Addis AI's `addis-1-alef` can hold an English coaching dialogue, or whether it is Amharic and Afan Oromo only in practice. That decides who runs the conversation director. Test it in their playground before building anything on top of it.
