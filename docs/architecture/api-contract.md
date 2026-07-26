# API contract

What the browser asks for, and what it expects back. This is the hand-off
document: the client is written against these shapes today and serves them from
[`client/lib/api/mock-adapter.ts`](../../client/lib/api/mock-adapter.ts) until
the server answers.

The authoritative definition is
[`client/lib/api/schemas.ts`](../../client/lib/api/schemas.ts). It is Zod, every
response is parsed through it before a component sees it, and the TypeScript
types are inferred from it — so this page is prose about that file rather than a
second definition that can drift from it.

## Switching the client over

```
NEXT_PUBLIC_API_MODE=live
NEXT_PUBLIC_API_URL=https://<render-service>
```

Nothing else changes. [`endpoints.ts`](../../client/lib/api/endpoints.ts) is the
only file that knows which of the two is running, and no component imports
either.

## Rules that hold for every endpoint

- **JSON in, JSON out.** `content-type: application/json`.
- **Unknown fields are ignored.** The schemas strip rather than reject, so
  adding a field to a response never breaks a deployed client.
- **A missing field is an error, not a default.** `invalid_response` is
  surfaced to the learner as "we got an answer we didn't understand", and
  logged with the failing path.
- **No field is optional to save bytes.** Optional means "genuinely absent
  sometimes", and each one is documented below.
- **Timeout is 12s**, one retry on 5xx and on network failure, none on 4xx.
  See [`http.ts`](../../client/lib/api/http.ts).
- **Vocabulary is [`CONTEXT.md`](../../CONTEXT.md).** Field names use the
  glossary's words: `dimensions`, `cefr`, `correction`, `activities`.

## Endpoints

### `GET /learner`

Who is signed in, and who is coaching them.

```json
{ "name": "Hana Bekele", "plan": "Personal", "coachName": "Nero" }
```

### `GET /today`

Today's Mission, plus the counters the sidebar shows. One request, because
every one of these is on screen from the first paint of `/practice`.

```json
{
  "theme": "Your first week on campus",
  "tip": "When you describe a picture, say what is happening right now…",
  "greeting": "Hi, I'm Nero! I'll be your English tutor",
  "progress": {
    "speakingMinutes": 18,
    "speakingGoalMinutes": 30,
    "corrections": 6,
    "newVocabulary": 7,
    "streakDays": 4
  },
  "activities": [
    {
      "templateId": "EX001",
      "label": "Describe the scene",
      "stimulus": { "kind": "image", "scene": "campus_courtyard", "description": "…", "instruction": "…" }
    }
  ],
  "coachLines": ["Good. Now tell me about the person standing up…"]
}
```

`activities` is four to six long, per the load table in
[session-engine.md](session-engine.md) §9. `theme` is the substituted Practice
Context that gives the day its single story — the learner never sees
`templateId`.

`stimulus` is the discriminated union below, and is exactly the `spec_json` the
session engine builds.

### `GET /assessment/prompts`

The three prompts that place the learner. Real templates, so each one carries an
optional `stimulus` rendered by the same dispatcher as a practice activity — a
prompt the coach simply asks aloud has none.

```json
[{ "templateId": "EX001", "kind": "Picture description", "instruction": "…", "seconds": 70, "stimulus": { "…": "…" } }]
```

### `GET /profile`

The Communication Profile: four fixed dimensions plus two from the Life Path.

```json
{
  "placed": true,
  "cefr": "A2",
  "dimensions": [
    { "id": "grammar", "label": "Grammar", "value": 0.62, "fixed": true },
    { "id": "classroom_interaction", "label": "Classroom Interaction", "value": null, "fixed": false }
  ]
}
```

Exactly six dimensions. `value` is `null` when the dimension has no attempted
members, and the UI renders that as "not yet assessed" — never `0%`, which
would be a claim we have not earned. `cefr` is `null` until `placed` is true.

The labels are the learner's own: a Hospitality learner gets Guest Interaction
here, not Classroom Interaction. The mock adapter derives them from the stored
draft precisely so this stays visible before the server exists.

### `GET /sessions/recent`

The Chat History list. Newest first.

```json
[{ "id": "s-301", "title": "Ordering coffee from a cafe", "minutes": 12, "corrections": 3 }]
```

An empty array is a normal answer, and the sidebar has a state for it.

### `GET /sessions/latest/gains`

What the last mission moved. This is the sign-up screen's whole argument.

```json
{
  "dimensions": [{ "label": "Fluency", "from": 0.44, "to": 0.53 }],
  "sentenceLength": { "from": 6, "to": 11 }
}
```

### `POST /onboarding`

Creates the account from the draft the device has been holding since before the
first mission. The whole draft goes up with the email, because the account is
being created *from* it.

```json
{ "email": "hana@example.com", "draft": { "name": "Hana", "lifePath": "university_success", "…": "…" } }
```

```json
{ "learnerId": "lnr_01H…", "cefr": "A2" }
```

The draft's own shape is `onboardingDraftSchema` in
[`onboarding-draft.ts`](../../client/lib/onboarding-draft.ts). The server should
validate it again — it comes from `localStorage`, which is attacker-writable.

## The stimulus union

Discriminated on `kind`, and the one shape worth reading in full before writing
the generator. Every variant carries `instruction`: what the learner is asked to
do, in the coach's voice, spoken once and also shown.

| `kind` | Fields | Used by |
| --- | --- | --- |
| `image` | `scene`, `description` | EX001 |
| `image_pair` | `left{scene,label}`, `right{scene,label}` | EX002 |
| `image_sequence` | `steps[]{scene,caption}` | EX003, EX011 |
| `audio` | `src?`, `seconds`, `transcript?`, `replaysAllowed` | EX004–EX006 |
| `audio_question` | `question`, `src?` | EX007, EX008, EX010 |
| `text` | `prompt`, `hints?` | EX009, EX012 |
| `choice` | `situation`, `options[]{id,label,detail?}` | EX013 |
| `statement` | `statement`, `assignedSide?` | EX015, EX016 |
| `topic` | `topic`, `beats[]`, `prepSeconds` | EX017 |
| `scenario` | `setting`, `learnerRole`, `coachRole`, `objective` | EX014, EX018 |

`src` is absent while fal has not produced the audio yet; the player renders in
its unloaded state rather than erroring. `scene` is a Stimulus Pool identifier;
it becomes an `asset_id` and a URL once the image pipeline is live, and nothing
but this field changes when it does.

## Still to specify: the turn

Corrections and delivery metrics arrive per turn and belong on a socket, not on
`GET`. The shapes are already written down —`correctionSchema` and
`turnMetricsSchema` in `schemas.ts` — because agreeing the field names before
either side is built is the entire point of this document. The transport is not
decided.

```json
{ "id": "c-1", "said": "I see two student sitting in a bench.", "errorSpan": "two student",
  "corrected": "I see two students sitting on a bench.", "why": "After a number, the noun takes an -s…",
  "subCompetency": "G006.01", "errorTag": "missing_plural" }
```

`errorSpan` must appear verbatim in `said`; the correction card marks it up by
substring, and a span that does not match renders the sentence unmarked.
