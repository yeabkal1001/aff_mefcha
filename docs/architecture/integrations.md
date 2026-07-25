# API Integration Plan

How the six hackathon APIs map onto the AI Communication Coach: what each one does, why it earns its place, and how to wire it up.

## Assignment at a glance

| API | Job in this product | Why this one |
| --- | --- | --- |
| Addis AI | Amharic feedback voice, English↔Amharic translation, realtime free-talk mode | Only provider here with native Amharic TTS and a sub-300ms voice loop; the bilingual correction moment is the emotional core of the demo |
| Wispr Flow | Live transcript during the conversation | Streaming WebSocket STT built for low latency, plus a "polished" rewrite we turn into a coaching feature |
| fal | English coach voice, verbatim Whisper analysis, scenario images | Whisper with word-level timestamps is how the Communication Profile gets real numbers instead of LLM guesses; also our only source of English TTS |
| Exa | Discovering real-world source material per Life Path | Semantic search finds "what do Ethiopian university presentations actually sound like" better than keyword search |
| Firecrawl | Turning discovered pages into structured mission packs | Schema-based extraction converts messy pages into typed vocabulary, scenarios and question banks |
| Render | FastAPI service, Postgres, cron worker, public webhook URL | Already in the plan; fal's queue webhooks need a public HTTPS endpoint |

## The backend is Python

The API is FastAPI, so provider calls are made with `fal-client`, `exa-py` and
`firecrawl-py`. Two consequences worth knowing before you start wiring:

- **Addis AI publishes a JavaScript SDK, not a Python one.** Call their REST API
  directly with `httpx` and generate the idempotency key yourself — the JS SDK created
  it for you, and `voice.generate` requires one, so a network retry is only safe once
  you are passing your own.
- The snippets below are quoted from the providers' own documentation and show the
  request and response *shapes*, which are language-independent. Read them as the
  contract, not as the code we ship.

## Two corrections to the original plan

**ElevenLabs is not in the key list, and Addis AI cannot replace it.** Addis TTS (`AddisVoice-2`, 28 voices) only speaks Amharic (`am`) and Afan Oromo (`om`). The coach's English voice has to come from fal, which hosts ElevenLabs v3, xAI TTS and Inworld behind one SDK. So voice output is split by language: fal speaks English, Addis speaks Amharic.

**Addis AI's LLM takes `language: "am" | "om"`.** `addis-1-alef` is built for Amharic and Afan Oromo generation, so treat it as the Amharic explanation engine, not the English conversation director. Verify English behaviour in the playground in your first thirty minutes; if it won't hold an English coaching dialogue, fall back to a text model on fal for the director and keep Addis for the Amharic layer. This is risk number one — test it before building on it.

## The dual transcription trick

Wispr Flow is explicitly designed to clean up speech: it strips filler words, applies auto-edits ("let's meet at 6, actually 7" becomes "let's meet at 7"), and returns polished text with no timestamps and no verbatim option. For a dictation product that's the feature. For a speaking coach it would delete the exact evidence we grade on.

So run both transcribers on every turn and use the difference:

- **Wispr Flow** streams over WebSocket during the turn. Its output drives the on-screen live transcript and gets handed to the conversation director immediately, so the coach replies fast.
- **fal Whisper** runs on the recorded turn with `chunk_level: "word"`. Its output is the analysis track: every word with a start and end timestamp.

The gap between the two transcripts *is* a coaching artefact. In the reflection screen, show "what you said" (verbatim, fillers intact) next to "how it could sound" (Flow's polished version). That is a demo moment no competitor built from a single STT call can produce.

Feed Wispr Flow a `dictionary_context` so Ethiopian names and domain terms transcribe correctly:

```js
{
  language: ["en"],
  context: {
    app: { type: "other" },
    dictionary_context: ["Hana Bekele", "Addis Ababa University", "Sheraton Addis", "software engineering"],
    user_first_name: "Hana"
  }
}
```

Auth: mint short-lived client JWTs on the FastAPI backend so the browser streams directly to `wss://platform-api.wisprflow.ai/api/v1/dash/client_ws`. Audio must be base64 16kHz mono PCM16, under 25MB / 6 minutes per turn.

## Measuring the Communication Profile

The story doc promises confidence 39% → 47% and average sentence length 6 → 11 words. Those numbers must be computed, not invented, or judges will notice. Word timestamps from fal Whisper give you all of them:

```js
const { data } = await fal.subscribe("fal-ai/whisper", {
  input: { audio_url, task: "transcribe", language: "en", chunk_level: "word" }
});
```

From `data.chunks` (each `{ text, timestamp: [start, end] }`):

- **Fluency** — words per minute of actual speech, plus count and total length of pauses over 0.7s between words.
- **Hesitation** — occurrences of `um`, `uh`, `eh` in the verbatim track, normalised per 100 words.
- **Average sentence length** — verbatim word count divided by sentence count from the punctuated transcript.
- **Delivery** — pause ratio, hesitation rate, mean turn length and response latency, which become *evidence* rather than a score. Each produces an `observed` for a specific A2-reachable sub-competency — hesitation to `F020.05`, latency to `F003.*`, turn length to `F002.*` and `F005.*`, pause ratio and speech rate to `F001.05` — and those update mastery through the normal path, surfacing inside Fluency. There is no Confidence dimension: these numbers measure delivery, and the mapping is in [`session-engine.md`](./session-engine.md) section 8. Nothing on the dashboard is computed outside the learner model.
- **Grammar and vocabulary** — the LLM judges these from the verbatim transcript, returning a structured count per competency (`{ opportunities, correct, error_tags }`) rather than a score. `observed = correct / opportunities`, and zero opportunities means no evidence rather than a zero.

Store per-turn raw metrics in Postgres as `turn.metrics_json` — the turn owns the utterance, its audio and both transcripts; an `attempt` is one competency judgement pointing at it. These feed the mastery update in [`session-engine.md`](./session-engine.md), weighted by each template's observation reliability — a shadowing exercise and a picture description are not equally good evidence about pronunciation. The displayed percentages are Profile Dimensions computed from the underlying competency estimates, never stored separately, which is why the dashboard can't drift out of sync with the learner model.

One measurement caveat to respect: `P001`–`P003` (individual consonants, vowels, sound discrimination) need phoneme-level scoring that nothing in this stack provides. They are marked `observable: false` and excluded from the Pronunciation dimension. The workable proxy is minimal-pair drills judged by the transcription itself — if the learner targets "ship" and Whisper hears "sheep", that's real evidence — but it only covers sounds you deliberately probe.

Upload the recorded turn with `fal.storage.upload(file)` to get the `audio_url`, and for turns long enough to be slow, submit through `fal.queue.submit` with a `webhookUrl` pointing at Render.

## Voice output, split by language

English coach lines go through a fal TTS endpoint. Amharic correction lines go through Addis AI:

```js
const clip = await addis.voice.generate({
  voiceId: "am-hamen",
  language: "am",
  text: "'I am study software engineering' ከማለት ይልቅ 'I am studying Software Engineering' ማለት ይገባል።",
  outputFormat: "mp3_44100"
});
```

Billing is per generated minute at $0.032 and `voice.generate` requires an idempotency key — the SDK creates one automatically, so a network retry is never charged twice. Two things to respect from the docs: Ge'ez punctuation (`፣` and `።`) drives pausing and intonation, so punctuate the Amharic properly, and mixing English words inside an Amharic sentence pronounces badly. For the correction lines that quote English, keep the English fragment short and let the fal English voice read the model sentence instead.

Amharic explanation text itself comes from either `addis.translate.create({ text, from: "en", to: "am" })` for straightforward feedback, or `addis.chat.completions.create({ language: "am", ... })` when the explanation needs to be composed rather than translated.

## Realtime mode versus graded mode

Addis AI's Realtime API (`wss://relay.addisassistant.com/ws`) does bidirectional voice with server-side VAD, natural interruption and sub-300ms responses. It sends PCM16 at 16kHz up and returns PCM16 at 24kHz down. It's the fastest route to a conversation that *feels* alive.

The catch: it's an audio-in, audio-out black box with no documented transcript events, so you cannot measure a session that runs through it. Use both modes deliberately:

- **Graded missions** use the explicit pipeline (Wispr Flow + fal Whisper → director → TTS). Slower, fully measurable, drives the Communication Profile.
- **Free talk / warm-up** uses Realtime for a fluid, unmeasured conversation that shows off responsiveness.

Note the docs pass `apiKey` as a query parameter straight from the browser. Don't ship that — proxy the socket through Render or issue short-lived credentials. Also convert Float32 to Int16 before sending, or you'll transmit static.

## Content pipeline: Exa finds, Firecrawl extracts

This is what turns Life Paths from a slide into a real feature. Exa and Firecrawl do different halves of the same job, and both run at build time or on a nightly cron — never in the request path.

**Exa discovers.** Neural search retrieves pages by meaning, so you can ask for things a keyword engine would miss:

```js
const res = await exa.searchAndContents(
  "common behavioural interview questions for hotel front desk roles in East Africa",
  { numResults: 10, text: true }
);
```

Good queries for us: real university presentation rubrics, hospitality complaint-handling scripts, visa interview question banks, stand-up meeting phrasing for junior engineers. This is also how "topic of the week" stays current instead of frozen at build time.

**Firecrawl extracts.** Point it at the URLs Exa surfaced and get typed data back:

```js
const doc = await app.scrape(url, {
  formats: [{
    type: "json",
    prompt: "Extract practice scenarios and the vocabulary a learner needs for them.",
    schema: {
      type: "object",
      properties: {
        scenarios: { type: "array", items: { type: "string" } },
        vocabulary: { type: "array", items: { type: "string" } },
        difficulty: { type: "string" }
      }
    }
  }]
});
```

Result lands in `doc.json`. Note the v2 shape: the schema goes inside the format object, and `"json"` as a bare string won't work.

Pipeline end to end: Exa finds candidate URLs → Firecrawl extracts structured scenarios and vocabulary → the LLM reshapes them into mission JSON (goal, target grammar, five vocabulary items, success criteria) → seed Postgres, one pack per Life Path. Ship the demo with pre-seeded packs; run the cron nightly to prove it stays fresh.

## fal for stimulus assets

This is core infrastructure, not polish. Seven of the eighteen exercise templates take an image, two images, or an image sequence as their stimulus (`EX001`, `EX002`, `EX003`, `EX011`, `EX013`, `EX014`, `EX015`), and three take audio (`EX004`, `EX005`, `EX006`). Spaced retrieval compounds this: reviewing a competency "in a new context" means a *new* asset each time.

Generate ahead, never at request time — but generate **assets, not plans**, because a Day Plan depends on mastery that doesn't exist yet. A nightly job projects what each learner will need in the next few days and queues those assets through fal into the Stimulus Pool, keyed by `(template, target_set, theme)`. The learner's morning is a database read. That key is also what makes review work: a competency due in a new context requests a variant of an existing spec rather than a fresh invention — milk spilling after coffee spilling, as the pedagogy document describes.

On a miss, degrade the key rather than the experience: exact key, then the same targets under a generic theme, then a text-stimulus template that needs no asset, queueing the missing one in the background. See section 12 of [`session-engine.md`](./session-engine.md).

`EX006 Shadowing` deserves special mention because it uses three of these APIs at once: fal TTS produces the reference audio, fal Whisper word timestamps come back for both the reference and the learner, and pace matching is scored by comparing the two timelines directly. It is the single best demonstration that the dual-transcription design was worth building.

Life Path cover art and scene backdrops are the genuinely optional part.

## Render setup

- **Web service** — Next.js frontend.
- **Web service** — FastAPI API. Holds every API key, proxies all model calls, receives fal queue webhooks, mints Wispr Flow client tokens.
- **Postgres** — users, sessions, per-turn metrics, competency snapshots, mission packs.
- **Cron job** — nightly Exa + Firecrawl content refresh.

Free-tier services spin down when idle and cold-start slowly. Before you demo, hit the API with a keep-warm ping; a fifteen-second stall on stage costs more than the tier saves.

## Environment variables

```
ADDIS_API_KEY=
WISPR_FLOW_API_KEY=
FAL_KEY=
EXA_API_KEY=
FIRECRAWL_API_KEY=
DATABASE_URL=
```

All server-side. The fal client explicitly warns against exposing `FAL_KEY` in the browser, and the Addis SDK refuses to run client-side unless you force it.

## Verify these before building

1. Does `addis-1-alef` hold an English coaching dialogue, or is it Amharic-only in practice? Determines who runs the conversation director.
2. Does Wispr Flow preserve enough of a beginner's actual errors to be usable as a live transcript, or does it silently correct their grammar too? If it over-corrects, the live transcript becomes the "polished" panel only.
3. Round-trip latency of the graded pipeline end to end. If it exceeds roughly four seconds, move more of the demo into Realtime mode.

## Build order

1. Seed the content tables — the fifteen `A2-D01` competency records from Appendix A, three template descriptors, the `university_success` skin. Content, not code, but nothing below runs without it.
2. Wispr Flow streaming into a live transcript on screen — proves voice input works.
3. fal Whisper word-level analysis writing real metrics into Postgres — proves the numbers are real.
4. Conversation director with mission context, English TTS from fal — proves it coaches.
5. Amharic correction line through Addis TTS — the emotional beat of the demo.
6. Retry loop plus the before/after delta screen — proves measurable improvement.
7. Scheduler: retrievability decay and the template-variety penalty — produces the Day Three moment, which is the strongest technical claim we have.
8. Exa and Firecrawl seeding the `hospitality` skin — proves it scales past one persona.
9. Realtime free-talk mode and generated cover art, if time allows.

Steps one through seven are the demo. Everything after is upside.

Note that step 7 is cheap — it is roughly forty lines of scheduling logic against data the earlier steps already write — and it demonstrates more architecture than any other single step. Do not let it get cut for step 8.
