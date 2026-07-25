---
name: demo-fidelity
description: Classify work as load-bearing, prop, or cut before building it. Use when starting any feature for the hackathon MVP, when deciding whether something can be faked, mocked, stubbed, or hardcoded, and when scoping what is left to build before the pitch.
---

# Demo Fidelity

A hackathon MVP is a stage set. Some walls hold the roof up; the rest are painted flats that read as real **from the seats**. Both are legitimate. Confusing the two loses the pitch.

Classify before writing code. Every piece of work is one of three:

- **Load-bearing** — a judge could poke it and it holds. Real logic, arbitrary input, no scripted path. Reserved for the claims the pitch rests on.
- **Prop** — reads as real from the seats, works on the demo path only. Cheap, fast, and honest as long as it carries no claim.
- **Cut** — not built. Shown as a static screen, or described in a sentence.

## The one rule

**A prop never carries the differentiator.**

The differentiator here is that the numbers are measured and the scheduling is predicted. If a judge asks "is that score real?" and the answer is a fixture, the pitch is dead. Everything else is negotiable.

The test: imagine a judge reaching for the object. If you would invite them to try it, it is load-bearing. If you would steer them away, it is a prop — so check that no claim is resting on it.

## The ledger

Pre-decided for this MVP. Follow it unless the work genuinely falls outside; then classify with the rule above and add a row.

**Load-bearing**

- Microphone capture and the live transcript. Judges will speak into it.
- `fal` Whisper word-timestamp metrics: words per minute, pause count and length, filler rate, mean sentence length.
- Error detection against each competency's `common_errors` tags for the targeted sub-competencies.
- The retry loop and the before/after delta screen.
- The mastery update: `α`-weighted, scaled by the template's observation reliability, written to Postgres.
- **The scheduler** — retrievability decay and the template-variety penalty. This produces Day Three, the strongest claim in the pitch. Build it before anything optional.
- Profile Dimensions computed from competency estimates at read time, never stored.
- **Clock injection for Day Three.** Hana's day-one attempts are real rows written by the real pipeline in rehearsal, and the demo advances `now()` by 72 hours and runs the actual scheduler. The date is the only fake thing in the room, which is why it survives "try four days instead" — take the offset from a visible control rather than hardcoding it.

**Prop**

- The onboarding assessment. Seed the opening profile; spending four minutes of stage time to generate a number the audience never sees is waste.
- Amharic correction audio, pre-rendered through a real Addis AI call. A cached real call is the best kind of prop: it cannot lie, and it cannot fail live.
- Stimulus images, pre-generated at seed time. This is also the real architecture, so the prop and the product agree.
- Exa and Firecrawl content packs, seeded as JSON. The cron does not run during the hackathon.
- Samuel's entire journey — seeded learner state, no live session.
- Week Two and Week Four history, seeded so the progress curve has something to draw.

**Cut**

- Accounts, auth, payments.
- The 29 domains and 15 templates outside the demo slice.
- Realtime free-talk mode.
- Mobile layout.

## Marking

Every prop carries a marker in code at the point of the fake:

```ts
// PROP: seeded from fixtures; the engine that produced this shape is real (see scheduler.ts)
```

The marker states what is fake **and** names the real thing behind it. This is what you read aloud when a judge asks.

Building a prop that survives a poke has its own craft — see [PROPS.md](PROPS.md).

## Narration

Each prop needs one prepared sentence, honest and unapologetic, that converts it into evidence of the bigger system:

> "Samuel's history is seeded. The engine that produced it is the one you just watched run on Hana."

Claiming a prop is live is the only unrecoverable mistake in a demo. Judges forgive scope; they do not forgive being misled, and they ask follow-up questions for a living.

## Done when

- Every item in the current task is classified, out loud, before code is written.
- Each prop has a `// PROP:` marker naming the real thing behind it.
- Each prop has its one-sentence narration written into the demo script at the end of `docs/product/persona.md`.
- No prop carries a measurement claim or the Day Three claim.
