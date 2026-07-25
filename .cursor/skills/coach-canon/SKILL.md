---
name: coach-canon
description: Apply the project's canonical vocabulary, IDs, and schema when writing code for the AI Communication Coach. Use when naming a variable, table, type, or route, when writing schema, seed data, or prompts, and when a term from the design documents reaches the codebase.
---

# Coach Canon

The design documents already fixed the vocabulary of this product. Code that renames those concepts forces a translation step in every future session and quietly splits the model in two. Bind to the canon at the moment of naming.

`CONTEXT.md` at the repo root holds the full glossary. The bindings below are the ones code gets wrong.

## Naming bindings

| Concept | In code | Not |
| --- | --- | --- |
| CEFR band | `cefr` | `level`, `difficulty`, `grade` |
| Addressable unit of learning | `competency_id`, always a sub-competency | `topic`, `skill_id`, `concept` |
| One activity | `session` | `exercise`, `lesson`, `task` |
| A day of 4–6 sessions | `day_plan`, shown to the learner as "Today's Mission" | `lesson`, `module` |
| Layer 1 curriculum unit | `domain`, e.g. `A2-D01` | `unit`, `chapter`, `course` |
| Layer 2 exercise form | `template`, e.g. `EX001` | `exercise_type`, `activity` |
| Why the learner is here | `life_path` | `goal`, `track`, `persona` |
| Dashboard competency score | `profile_dimension` | `ring`, `score`, `stat` |
| Speak / Learn / Improve | `ring` | anything else |
| The person practising | `learner`, `learner_id`, `learner_profile` | `user`, `student` |
| One utterance, with its audio and transcripts | `turn` | `attempt`, `utterance`, `recording` |
| One competency judgement about a turn | `attempt` | `score`, `result` |
| Pre-generated stimulus assets | `stimulus_pool` | `cache`, `assets` |

`ring` and `profile_dimension` are different objects. Rings measure showing up; dimensions measure getting better. Keep the two words apart everywhere, including in prompts and UI copy.

## IDs

Every addressable unit is `X###.##` where `X` is one of `V G P F`:

```
V001.05  G006.01  P005.01  F002.01
```

Parent competencies (`G006`) appear in curriculum requirements and template `elicits` rows. Everything that targets, scores, schedules, or stores addresses the sub-competency. A function that accepts a bare `G006` where a sub-competency belongs is a bug.

## Where truth lives

| Question | Read |
| --- | --- |
| What a word means | `CONTEXT.md` |
| The seed data the demo runs on | `docs/curriculum/content-pack-a2-d01.md` |
| What is taught, in full | `docs/curriculum/` |
| How a session is assembled, scored, scheduled | `docs/architecture/session-engine.md` |
| Which API to call and how | `docs/architecture/integrations.md` |
| What the demo must show | `docs/product/persona.md` |
| Why a decision was made | `docs/adr/` |

On a mechanics conflict, `session-engine.md` wins. On a story conflict, `persona.md` wins. On the meaning of a word, `CONTEXT.md` wins.

## Computed, never stored

Profile Dimensions are derived from `learner_competency` rows at read time. Storing them creates a second source of truth that drifts from the learner model within a day, and the drift shows up on the one screen the pitch ends on.

The same holds for `observed`, which is `correct / opportunities` off the `attempt` row, and for the mission theme, which comes from the Life Path context substitution rather than a column on `day_plan`.

Nothing reaches a Profile Dimension except through mastery. A delivery metric becomes evidence on a competency first; it is never read straight onto the dashboard. See `docs/adr/0002-profile-reads-only-mastery.md`.

## Done when

- Every new identifier matches the bindings table, or the table gains a row because a genuinely new concept appeared.
- Every learning target in the change is a sub-competency ID, not a parent.
- No Profile Dimension is persisted.
