# Client

The browser app. Next.js 16, React 19, Tailwind 4, App Router, TypeScript.

## Run it

```bash
cp .env.example .env.local
pnpm dev                  # http://localhost:3000
```

The server needs to be running too — `pnpm dev` from the repo root starts both.

## Boundary

**This package owns the browser and nothing else.** No provider key ever reaches this bundle: not fal, not Addis AI, not Exa, not Firecrawl. Anything prefixed `NEXT_PUBLIC_` ships to the user, so it must never hold a secret.

Everything goes through the server at `NEXT_PUBLIC_API_URL`. The one direct connection by design is the Wispr Flow audio WebSocket, using a short-lived token the server mints.

If you want a database query here, it belongs in the server.

## UI kit

Two registries, both installed through the shadcn CLI, both of which copy source files into this package rather than adding a runtime dependency. Edit the copied files freely — they are ours now.

```bash
pnpm dlx shadcn@latest add <name>                    # shadcn primitive
pnpm dlx shadcn@latest add @react-bits/<Name>-TS-TW  # React Bits animation
```

Always take the `-TS-TW` variant of a React Bits component. The other three variants are JavaScript or plain CSS and will fight the rest of the codebase.

Where things land tells you what they are:

| Path | What lives there |
| --- | --- |
| `components/ui/*.tsx` | shadcn primitives, kebab-case. Style set to `radix-nova`. |
| `components/*.tsx` | React Bits components, PascalCase, dropped at the top level by their registry. |
| `components/<feature>/` | Components we write ourselves. |

Theme tokens are oklch variables in `app/globals.css`, with dark mode behind a `.dark` class. When the Figma design arrives, retheming means editing those variables rather than touching components.

`components/BlurText.tsx` is a React Bits install kept as a working reference for the pattern. Delete it if it goes unused.

## Mock data, and the seam back to the server

Nothing here talks to the server yet. Everything the UI renders comes from
[`lib/mock-data.ts`](lib/mock-data.ts), and the coach's side of the conversation
is driven by [`hooks/use-session.ts`](hooks/use-session.ts).

Those two files are the whole seam. When the API exists, the exported shapes in
`mock-data.ts` become response bodies and the scripted corrections in
`use-session.ts` become socket events — no component should need to change. Keep
new mock shapes honest for that reason, and resist reaching for mock data from
inside a component.

## The microphone is real

[`lib/mic-engine.ts`](lib/mic-engine.ts) is not a prop. It owns one shared,
reference-counted `getUserMedia` stream and does genuine voice activity
detection on it, and the **turn boundary is its verdict, not a timer**: the
learner's turn ends when the microphone stops hearing them. Everything after that
boundary is still faked, but the part the learner controls responds to them.

Three things in there are load-bearing, and each replaced something that was
broken. Read the comments before changing any of them.

- **Thresholds are relative to a learned noise floor, never absolute.** The same
  sentence into a headset and into a laptop array differ by more than a factor
  of ten, so a fixed level cannot work for both. It was fixed, and the mic check
  in onboarding was literally unpassable as a result.
- **The floor is an average of quiet frames, not a minimum, and it does not
  adapt during speech.** Minimum-tracking collapses toward digital silence and
  room tone starts reading as speech; adapting during speech lets a steady
  talker pull the threshold up past their own voice.
- **Every time constant is in milliseconds.** Anything expressed in animation
  frames is a time constant that secretly tracks the machine's frame rate, and
  the analysis loop is a timer rather than `requestAnimationFrame` for the same
  reason — rAF paced by a slow display samples 43ms windows 100ms apart and
  misses most of the audio.

In development, `__mic()` in the console returns the live detector internals —
RMS, floor, threshold, and the current verdict. That is the first thing to look
at for any "it isn't hearing me" report.

[`hooks/use-audio-level.ts`](hooks/use-audio-level.ts) turns the engine's level
into the 0..1 signal the orb and the meter animate, through a ref rather than
state so 60fps of loudness never re-renders React. When the *coach* speaks there
is no audio to measure yet, so that side is synthesised.

A blocked microphone is the one case where the orb deliberately does not fake it.
An orb dancing over a dead mic tells the learner they are being heard when
nothing is being recorded, and they find out four minutes later — so
`components/session/mic-notice.tsx` says it in words instead.

## Screens

The screens are listed in [`../docs/product/vision.md`](../docs/product/vision.md). Build them in the order the demo script at the end of [`../docs/product/persona.md`](../docs/product/persona.md) needs them — that script is the definition of done.

Routes today:

| Route | Screen |
| --- | --- |
| `/` | Landing. One call to action, no account. |
| `/onboarding` | The whole flow, step-machined over `ONBOARDING_STEPS` — nine questions, mic check, three assessment prompts, profile reveal. |
| `/practice` | The live session. |
| `/plan` | The thirty-day outline. |
| `/signup` | Shown after the first mission, never before it. |
| `/dev/stimulus` | Internal. Every stimulus kind on one page, full and compact. Not linked from the product; delete it once all eighteen templates have run in a real session. |

Onboarding answers live in `hooks/use-onboarding-draft.ts` — an external store backed by `localStorage`, because there is no account until the very end. Which question feeds which part of the generator is spelled out in [`../docs/product/onboarding.md`](../docs/product/onboarding.md); do not add a question that does not change a generated session.

Adding a step means adding to `ONBOARDING_STEPS` in `lib/onboarding.ts`, a component under `components/onboarding/steps/`, and a field on `OnboardingDraft`. Everything else — progress, back and forward, persistence — follows from the array.

## The session screen

The middle slot under the orb holds exactly one of three things, and which one is a function of session state rather than a separate flag:

| State | What is in the slot |
| --- | --- |
| `listening` | `LiveTranscript` — words appearing as the learner speaks |
| after a turn | `CorrectionCard` |
| otherwise | `CoachGreeting` |

`LiveTranscript` renders the **Wispr Flow** track, the cleaned-up one meant to be read. The verbatim fal Whisper track is never shown mid-turn: the gap between the two transcripts is what the correction is made of, so putting the verbatim words on screen would give the correction away before the learner has finished the sentence.

## Exercises

There are eighteen exercise templates in [`../docs/curriculum/exercise-templates.md`](../docs/curriculum/exercise-templates.md) and there is one practice screen. The rule that keeps it that way: **nothing in the UI branches on a template id.**

A session carries a `StimulusSpec` — a discriminated union in `components/session/stimulus/types.ts` with one variant per stimulus type in the curriculum. `<Stimulus spec={...} />` dispatches on `spec.kind` through an exhaustive switch, so adding a stimulus type to `lib/templates.ts` produces a compile error at the dispatcher rather than a blank panel at runtime. Adding `EX016 Debate` to the demo is a data change.

| File | What it owns |
| --- | --- |
| `lib/templates.ts` | The eighteen templates: stimulus kind, interaction mode, CEFR range, duration. A thin projection of the engine's descriptors — no `elicits` or `measures`, since the browser never scores anything. |
| `components/session/stimulus/` | One renderer per stimulus kind, plus the dispatcher and the shared `StimulusPanel`. |
| `components/session/stimulus/scenes.tsx` | Drawn stand-ins for Stimulus Pool assets, each with the description that is the ceiling on what the learner can be expected to say. |
| `components/session/exercise-stage.tsx` | Composes stimulus, orb and the feedback slot for any template. |
| `components/session/activity-rail.tsx` | Which of the mission's four to six activities the learner is on. |

Every stimulus takes a `compact` prop. That is the state it enters when a correction is on screen: still visible, because a correction only means something against what the learner was looking at, but no longer competing with it.

## Learner profile and the outline

Two pure functions, both of which move to the server unchanged when it exists.

`lib/learner-profile.ts` turns an `OnboardingDraft` into a `LearnerProfile`. These are deliberately different shapes — the draft is twelve screens of UI state including a half-typed name, the profile is the resolved input set `buildDayPlan` takes. It applies defaults rather than throwing, because it runs mid-onboarding when half the answers are null; check `profile.placed` rather than inspecting fields.

`lib/study-outline.ts` projects the next thirty days. Read [`../docs/adr/0007-the-outline-is-a-projection-not-a-plan.md`](../docs/adr/0007-the-outline-is-a-projection-not-a-plan.md) before changing it. An outline is not a plan: it names domains and objectives, never competencies or templates, because those are chosen the morning of from evidence that does not exist yet. It is stored nowhere and recomputed on every render, which is what stops it drifting from the engine.

## Language rules that reach the UI

[`../CONTEXT.md`](../CONTEXT.md) is binding for component names, props and every string a learner reads.

- The person practising is a **learner**. Not a user.
- **Rings** are Speak / Learn / Improve and measure showing up. **Profile Dimensions** measure getting better. Never call a dimension a ring, in code or in copy.
- A **Day Plan** is shown to the learner as "Today's Mission" — `day_plan` in code, "Today's Mission" on screen.
- A dimension with no evidence shows "not yet assessed", never 0%.

## Note on Next.js 16

`AGENTS.md` in this folder warns that this version has breaking changes against most training data. Check `node_modules/next/dist/docs/` before assuming an API works.
