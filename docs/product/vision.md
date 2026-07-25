# Vision and Scope

What we are building this weekend, and where it stops. For *why anyone should care*, read [`persona.md`](./persona.md). For *how it works*, read [`../architecture/session-engine.md`](../architecture/session-engine.md).

## The product

An AI Communication Coach that helps Ethiopian students and professionals improve real-world spoken English through personalised voice conversations and measurable communication growth.

The loop: **Assess → Coach → Practice → Correct → Retry → Measure → Personalise.**

Three principles from learning science hold it together. **Immediate feedback** — the learner is corrected and retries in the same breath, not in a report afterwards. **Metacognition** — the learner names their own error rather than being told it. **Spaced retrieval in a new context** — the same weakness returns days later inside a different scene, because a competency you can only produce in the setting you learned it in is not one you have.

## Who it is for

**Hana**, eighteen, starting university, native Amharic, reads and writes English well and freezes when she has to speak it. Primary persona and the demo.

**Samuel**, a graduate preparing for hospitality job interviews. Secondary persona, and the proof that the same engine serves a different life without a second curriculum.

## The journey

Landing → Onboarding → Life Path → Assessment → Dashboard → Today's Mission → Live voice conversation → Reflection → Communication Profile.

## Screens

1. **Landing** — one call to action.
2. **Onboarding** — native language, Life Path, study field, daily time, feedback language. We never ask the learner to declare a CEFR level; most don't know it and the ones who think they do guess high.
3. **Assessment** — four minutes of speech places the learner and seeds the opening profile.
4. **Dashboard** — Today's Mission, the Communication Rings, and the due count.
5. **Live coaching** — voice conversation with a running transcript.
6. **Reflection and retry** — what you said beside how it could sound, and the learner naming what changed.
7. **Communication Profile** — the eight dimensions.

## What sits underneath

Four skill libraries — Vocabulary, Grammar, Pronunciation, Fluency — in [`../curriculum/`](../curriculum/). Every addressable unit is a sub-competency such as `G006.01`.

On the surface, the Communication Profile shows **eight dimensions**. Five are fixed for every learner: Grammar, Vocabulary, Pronunciation, Fluency and Confidence. Three come from the Life Path, so Hana sees Presentation, Academic Discussion and Classroom Interaction while Samuel sees Guest Interaction, Complaint Handling and Interview Readiness.

A dimension is a named weighted bundle of sub-competency IDs, never a separate score. Every session updates the underlying competencies and the dimensions are recomputed from them, which is why the dashboard cannot drift away from the learner model — it *is* the learner model.

## The voice loop

Speech → **dual transcription** (Wispr Flow for the live clean transcript, fal Whisper at word-chunk level for the verbatim analysis track) → Conversation Director → Context Builder → LLM → Response Validator → English coach voice via fal TTS, Amharic correction voice via Addis AI TTS.

Two transcribers, because Wispr Flow is designed to *clean up* speech and a coaching product grades exactly what it would delete. The gap between the two transcripts becomes the reflection screen.

## Today's Mission

One themed day of practice: four to six short activities inside a single story, twenty to forty-five minutes depending on level. The learner sees one scene, never a list of exercises.

The mission arc is Greeting → Warm-up → Vocabulary → Scenario → Challenge → Correction → Retry → Reflection → Summary. Each activity inside it runs the eight-stage learning loop in [`../architecture/learning-engine.md`](../architecture/learning-engine.md).

Missions are assembled automatically from the learner's profile — nothing here is hand-written per learner.

## Motivation

No XP, coins, badges or global leaderboards.

Two separate things that must not be confused. The Communication **Rings** — Speak, Learn, Improve — track daily activity and weekly consistency. The Communication **Profile** tracks competency growth. **Rings are about showing up; the Profile is about getting better.**

## Tech stack

Next.js, Tailwind, Node.js, PostgreSQL on Render. Every hackathon API has a job: Addis AI for Amharic voice, translation and realtime free talk; Wispr Flow for low-latency live transcription; fal for English TTS, verbatim Whisper analysis and stimulus images; Exa and Firecrawl for the Life Path content pipeline; Render for the API, Postgres and cron. Endpoints and wiring are in [`../architecture/integrations.md`](../architecture/integrations.md).

## The demo

Hana completes one personalised mission, gets bilingual feedback, retries successfully, and sees her Communication Profile move.

Then **Day Three**: the same grammar returns inside a different scene and a different activity type, because the scheduler predicted she was about to forget it. Nobody wrote Day Three. That single beat demonstrates the competency library, the curriculum, the template matrix, the learner model and the scheduler all working as one system.

Full script at the end of [`persona.md`](./persona.md).

## Out of scope, deliberately

Accounts, auth and payments. A1 content. Mobile layout. The 29 domains and 15 templates outside the demo slice. Realtime free-talk mode unless there is time left over.

The classification of everything else as load-bearing, prop or cut lives in the `demo-fidelity` skill.
