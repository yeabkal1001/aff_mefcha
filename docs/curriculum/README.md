# Curriculum

What is taught. These files are content, not mechanics — they define the material, and [`../architecture/session-engine.md`](../architecture/session-engine.md) defines how a session is assembled from it. Where the two disagree, the engine wins.

They were one 4,900-line document until the repo was reorganised; splitting changed nothing but the filenames and the heading levels.

## The four competency libraries

Every addressable unit of learning is a **sub-competency** with an ID of the form `X###.##`. Everything that targets, scores, schedules or stores addresses this level; the parent competency appears only in curriculum requirements and template `elicits` rows.

| File | Covers | Parents |
| --- | --- | --- |
| [`vocabulary.md`](./vocabulary.md) | `V001`–`V030`, 201 sub-competencies | 30 |
| [`grammar.md`](./grammar.md) | `G001`–`G028`, with a prerequisite graph | 28 |
| [`pronunciation.md`](./pronunciation.md) | `P001`–`P018`, with a prerequisite graph | 18 |
| [`fluency.md`](./fluency.md) | `F001`–`F020`, with a prerequisite graph | 20 |

## The two static layers

**[`domains.md`](./domains.md) is Layer 1** — thirty CEFR domains, six each for A2 through C2. A domain is a unit of *what is practised*, and it lists the competencies it requires. `A2-D01` additionally carries requirement **roles** (`core`, `supporting`, `incidental`), which is what makes "has she finished this domain?" answerable. The other 29 still need roles assigned.

**[`exercise-templates.md`](./exercise-templates.md) is Layer 2** — eighteen exercise forms, `EX001`–`EX018`, grouped into eight families. The prose here is human documentation; the machine-readable capability descriptors that the engine actually reads live in the content pack.

There is no Layer 3 or Layer 4 document. Earlier drafts described a session generator and a learning record as further layers; both are now specified as runtime mechanics in `session-engine.md`, and the multi-week learning plan they assumed was dropped entirely — see [`../adr/0001-stimulus-pool-not-prebuilt-plans.md`](../adr/0001-stimulus-pool-not-prebuilt-plans.md).

## The seed data

**[`content-pack-a2-d01.md`](./content-pack-a2-d01.md) is the only file the demo strictly depends on.** It holds fifteen fully authored `A2-D01` sub-competency records — prerequisites, elicitation cues, success criteria, common errors, and Amharic L1 risk — plus complete descriptors for `EX001`, `EX007` and `EX018`. Three templates is the minimum that makes template *selection* visible rather than trivial.

Everything else in this folder is the roadmap.

## A note on the CEFR floor

A1 is deliberately absent. Every library starts at A2, because the product assumes a learner who has had English at school and cannot yet speak it under pressure — which is the actual problem, and not the same as having no English.
