# AI Communication Coach

An AI speaking coach for Ethiopian students and professionals. No code exists yet; the repo is design documents plus the skills that govern how they become code.

## Read before working

| Question | File |
| --- | --- |
| What does this word mean? | `CONTEXT.md` — binding for code, prompts and UI copy |
| What are we building, and what is out of scope? | `docs/product/vision.md` |
| What must the demo show? | `docs/product/persona.md` |
| How is a session assembled, scored, scheduled? | `docs/architecture/session-engine.md` |
| Which API does what? | `docs/architecture/integrations.md` |
| What content does the demo run on? | `docs/curriculum/content-pack-a2-d01.md` |
| Why was something decided this way? | `docs/adr/` |

On a mechanics conflict, `session-engine.md` wins. On a story conflict, `persona.md` wins. On the meaning of a word, `CONTEXT.md` wins.

## Project skills

`.cursor/skills/` holds four. `coach-canon`, `demo-fidelity` and `voice-pipeline` fire automatically when the work fits; `/demo-rehearsal` is typed by hand before the pitch. Read the matching skill before writing code in its area rather than after.

## Agent skills configuration

### Issue tracker

Issues and specs live as markdown under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
