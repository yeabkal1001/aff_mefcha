# Integrations

Which provider does what, where the key lives, and what happens when it fails.

Every one of these is reached through a **port** — an interface in
`server/src/infra/ai/ports.ts` — with the vendor SDK confined to one adapter
behind it. That is not ceremony. Two of the four choices below were different
providers a week ago, and the code that consumes them did not change.

## Assignment at a glance

| Job | Provider | Where it runs | Key lives in |
| --- | --- | --- | --- |
| Speech to text | Web Speech API | The browser | — |
| Text to speech | Web Speech API | The browser | — |
| Conversation director | Gemini Flash | The server | `GEMINI_API_KEY` |
| Grading | Gemini Pro | The server | `GEMINI_API_KEY` |
| Speech to text, upgrade | Whisper | The server | `WHISPER_API_KEY` |
| Text to speech, upgrade | ElevenLabs | The server | `ELEVENLABS_API_KEY` |
| Authentication | Clerk | Both | `CLERK_SECRET_KEY` (server) |
| Database, hosting | Render | — | `DATABASE_URL` |

## Speech runs in the browser

The default path for both directions is the Web Speech API, and this is a
design decision rather than a cost saving.

A conversation has a rhythm. Sending audio to a server, waiting for a
transcript, waiting for a reply, waiting for that reply to be synthesised and
streamed back puts two to four seconds between the learner finishing a sentence
and hearing a response. That gap is the difference between practising and
waiting, and no amount of model quality compensates for it.

Recognition also gives us interim results, which is what makes the live
transcript appear word by word as the learner speaks rather than in one block
afterwards.

What we give up: word-level timestamps. Fluency is therefore derived from turn
timing measured on the client — speech start, speech end, pause boundaries from
the same voice activity detection that decides when the turn is over — rather
than from per-word offsets. Good enough for the metrics below, and available
instantly.

**Both server-side providers are optional.** With no ElevenLabs key the coach
uses the browser's voice; with no Whisper key there is no second opinion on a
transcript. Neither absence stops a session, and `.env.example` says so.

### The upgrades, and when they earn the round trip

- **ElevenLabs** for devices whose built-in voices are poor — which in practice
  means most Android browsers. Worth the latency because the coach's voice is
  the product's presence, and a robotic one undoes the rest of it.
- **Whisper** for a turn that matters enough to re-analyse: word timings, and a
  verbatim track that keeps the fillers Web Speech quietly drops.

## Measuring the four dimensions

**Grammar, Vocabulary, Fluency and Sentence Structure.** Nothing on the
dashboard is computed outside the learner model — a Profile Dimension is a
projection of competency mastery, never a separate stored number, which is why
the dashboard cannot drift out of sync with the evidence.

**Delivery metrics** come from turn timing and the transcript, in
`server/src/domain/scoring/delivery.ts`:

- **Speech rate** — words per minute over the speaking portion of the turn.
- **Pause ratio** — silence over total turn duration.
- **Hesitation rate** — `um`, `uh`, `eh` per hundred words.
- **Mean turn length** — words per turn.
- **Response latency** — how long after the coach stopped before the learner started.

Each becomes *evidence* rather than a score. A metric produces an `observed`
for a specific A2-reachable sub-competency — hesitation to `F020.05`, latency to
`F003.*`, turn length to `F002.*` and `F005.*`, pause ratio and speech rate to
`F001.05` — and those update mastery through the normal path, surfacing inside
Fluency. There is no Confidence dimension; the mapping is in
[`session-engine.md`](./session-engine.md) section 8.

**Grammar and vocabulary** are judged by Gemini Pro from the transcript,
returning a structured count per competency — `{ opportunities, correct,
errorTags }` — rather than a score. `observed = correct / opportunities`, and
zero opportunities means *no evidence*, not a zero. That distinction is the
whole reason an unassessed dimension reads "not yet assessed" instead of 0%.

Raw per-turn metrics live on the turn. The turn owns the utterance, its audio
and its transcripts; an `attempt` is one competency judgement pointing at it.

One caveat to respect: `P001`–`P003` — individual consonants, vowels, sound
discrimination — need phoneme-level scoring that nothing in this stack provides.
They are `observable: false` and the engine never targets them.

## Every outbound call is wrapped

`server/src/core/resilience.ts` provides three things, and all four adapters use
all three:

- **Timeout.** A provider that never answers is a request that never completes
  and a connection that never returns to the pool.
- **Retry** with exponential backoff and jitter, on transport errors and 5xx
  only. Never on a 4xx — retrying a rejected request just spends the budget
  again to be told the same thing.
- **Circuit breaker.** After repeated failures the breaker opens and calls fail
  immediately rather than each one waiting out its own timeout. A degraded
  provider should cost one timeout, not one per learner.

When Gemini's director is unavailable, `server/src/infra/ai/fallback.ts` takes
over with a scripted director. It is not as good, and it is much better than a
session that dead-ends mid-conversation.

## Assets ahead, plans not

Seven of the eighteen exercise templates take an image as their stimulus and
three take audio. Those are generated ahead of time into the Stimulus Pool,
keyed by `(template, targetSet, theme)`.

A **Day Plan** is not generated ahead, because it depends on mastery that does
not exist until the learner has done the work. The morning is a database read
against whatever the learner model says is due.

On a pool miss, degrade the key rather than the experience: exact key, then the
same targets under a generic theme, then a text-stimulus template that needs no
asset. See section 12 of [`session-engine.md`](./session-engine.md).

## Authentication

Clerk, verified offline against its JWKS. No network call per request and no
shared session store, which is what makes the API horizontally scalable —
adding an instance requires no coordination.

A learner row is provisioned on the first authenticated request rather than at
sign-up, so a webhook that is late or lost cannot leave someone unable to use
the product. The webhook then reconciles email, name and deletion.

The publishable key's shape is validated at startup. Clerk parses it lazily, on
the first authenticated request, so a truncated one would otherwise give you an
instance that passes its own health check and 500s everything real.

## Hosting

`render.yaml` at the repo root declares the database, the API and the web app.
Migrations run as a pre-deploy step against the built image rather than in the
container entrypoint, because an entrypoint runs per instance and three
instances would race the same schema.

Full deployment, secrets and key-rotation procedure:
[`../ops/deployment.md`](../ops/deployment.md).
