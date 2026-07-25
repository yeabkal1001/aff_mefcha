# AI Communication Coach

An AI speaking coach for Ethiopian students and professionals. Voice conversations, bilingual correction in Amharic, and a Communication Profile that moves because it is measured rather than asserted.

Start with `Persona.md` if you want to understand the product in five minutes. Start with `Session_Generation_Engine.md` if you want to understand how it works.

## The five documents

| Document | Answers | Authoritative for |
| --- | --- | --- |
| `AI_Communication_Coach_MVP_Hackathon.md` | What are we building this weekend? | Scope, screens, demo definition |
| `Persona.md` | Why should anyone care? | The narrative, the personas, the demo script |
| `AI English Practice Documentation.md` | What is taught? | The four competency libraries, the CEFR curriculum, the 18 exercise templates |
| `Session_Generation_Engine.md` | How is a session assembled? | Data model, scoring, scheduling, mastery, all runtime mechanics |
| `API_Integration_Plan.md` | What runs it? | Which hackathon API does what, and how to wire each one |

Where two documents disagree on mechanics, `Session_Generation_Engine.md` wins. Where they disagree on story, `Persona.md` wins.

## Agent skills

Project-scoped skills live in `.cursor/skills/`. Three fire automatically when the work fits; one is typed by hand.

| Skill | Fires |
| --- | --- |
| `demo-fidelity` | Before building anything. Classifies work as load-bearing, prop, or cut, and holds the pre-decided ledger for this MVP |
| `coach-canon` | When naming a variable, table, type, or route, so code binds to the terminology table below |
| `voice-pipeline` | When touching audio, transcription, or speech output. Holds the verified API constants that break silently |
| `/demo-rehearsal` | Typed by hand, three hours before the pitch |

## Canonical terminology

The glossary lives in [`CONTEXT.md`](./CONTEXT.md). It is the one binding definition of every domain term, and code, prompts and UI copy all follow it.

The distinction worth knowing before you read anything else: **Rings are about showing up, the Profile is about getting better.** Never call a Profile Dimension a ring.

## The two axes

CEFR level and Life Path are orthogonal, and this is the idea the whole product rests on.

**CEFR sets complexity. The Life Path sets context.**

`A2-D01 Personal Life` is one universal domain. Hana on `university_success` practices it in a lecture hall; Samuel on `hospitality` practices the same competencies in a hotel lobby. Six Life Paths cost six small config files, not six curricula. Adding a seventh path requires no new curriculum authoring at all.

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

## Current state

Design is complete and internally consistent. No code has been written yet.

The design survived a grilling session that found three real defects — retries inflating `evidence_count` into the promotion floor, placement that could never return a band above the one it probed, and utterance data stored on competency rows — plus the fact that the "30-day plan" it described could never have been built. Changelog entries 13 to 20 in `Session_Generation_Engine.md` record the fixes; the five decisions carrying real trade-offs are in [`docs/adr/`](./docs/adr/).

**Content is seeded for the demo.** Appendix A of `AI English Practice Documentation.md` holds the authored pack: fifteen `A2-D01` competency records with success criteria, common errors and Amharic L1 risk, plus full descriptors for `EX001`, `EX007` and `EX018`. `A2-D01` carries requirement roles. All 201 vocabulary sub-competencies now have IDs, and all 96 competencies have descriptions.

**Still to author:** metadata for the remaining 83 competencies, descriptors for the remaining 15 templates, roles on the other 29 domains, and the `hospitality` Life Path skin for the Samuel half of the demo.

**Known limitations, deliberately accepted:**

- `P001.01`–`P003` (segmental pronunciation) are marked `observable: false`. No API in the stack scores phonemes, so the engine never targets them. `P001.08` is the exception: the Amharic confusion set is probed with minimal pairs and judged by the transcriber.
- A1 is out of scope. Every library starts at A2.

**The one assumption to test first:** whether Addis AI's `addis-1-alef` can hold an English coaching dialogue, or whether it is Amharic and Afan Oromo only in practice. That decides who runs the conversation director. Test it in their playground before building anything on top of it.
