# Client

The browser app. Next.js 16, React 19, Tailwind 4, App Router, TypeScript.

## Run it

```bash
cp .env.example .env.local   # API origin and the Clerk publishable key
pnpm dev                     # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

The client needs the server. `pnpm dev` from the repo root starts both, and
without a Clerk publishable key the app renders a page saying so rather than a
stack trace.

## Boundary

**This package owns the browser and nothing else.** No provider key ever reaches
this bundle. Anything prefixed `NEXT_PUBLIC_` ships to the user, so it must
never hold a secret — the Clerk *publishable* key is the only credential-shaped
thing here, and it is publishable by design.

Everything else goes through the server at `NEXT_PUBLIC_API_URL`. Speech is the
one thing that genuinely runs in the browser, because it is the Web Speech API
and there is no key involved.

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

## The data layer

Everything the UI renders arrives through one path:

```
component -> hooks/queries/* -> lib/api/endpoints.ts -> lib/api/http.ts -> the server
```

The contract is one file. [`lib/api/schemas.ts`](lib/api/schemas.ts) holds Zod
schemas for every payload and the TypeScript types are *inferred from them*, so
there is one definition rather than a type and a validator that can disagree.
Every response is parsed, which means a server that drifts from the contract
fails loudly at the boundary instead of quietly three components deep.

[`lib/api/errors.ts`](lib/api/errors.ts) normalises every failure into an
`ApiError` with a message a learner can read, parsing the server's RFC 9457
`application/problem+json` bodies. `lib/api/http.ts` attaches the Clerk bearer
token — through `components/auth-bridge.tsx`, which is the only place the two
systems touch.

`lib/api/async.ts` gives every consumer the same four states — loading, error,
empty, ready — through one `Async<T>` type, which is why no screen in the app
renders a spinner that never resolves.

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
state so 60fps of loudness never re-renders React. When the *coach* speaks the
signal comes from `lib/speech/coach-level.ts` instead — measured from the
ElevenLabs audio when that is in use, and synthesised from utterance boundaries
when the browser's own voice is, because `speechSynthesis` exposes no waveform.

A blocked microphone is the one case where the orb deliberately does not fake it.
An orb dancing over a dead mic tells the learner they are being heard when
nothing is being recorded, and they find out four minutes later — so
`components/session/mic-notice.tsx` says it in words instead.

## Screens

The screens are listed in [`../docs/product/vision.md`](../docs/product/vision.md). Build them in the order the demo script at the end of [`../docs/product/persona.md`](../docs/product/persona.md) needs them — that script is the definition of done.

Routes today:

| Route | Screen |
| --- | --- |
| `/` | Landing. A server component with one client island for the animated hero. One call to action, no account. |
| `/onboarding` | The whole flow, step-machined over `ONBOARDING_STEPS` — nine questions, mic check, three assessment prompts, profile reveal. |
| `/(app)/practice` | The live session. |
| `/(app)/plan` | The thirty-day outline. |
| `/(app)/progress` | The Communication Profile and past corrections. |
| `/(app)/settings` | The learner profile — every field that changes tomorrow's plan. |
| `/save-progress` | The account, asked for last. Where onboarding lands. |
| `/sign-in`, `/sign-up` | Clerk's own screens. |
| `/dev/stimulus` | Internal. Every stimulus kind on one page. 404s in production. |

`/save-progress` rather than `/signup`, because `/sign-up` next to `/signup` is
a trap for whoever writes the next redirect.

`app/(app)/` is a route group, not a URL segment: the four app screens share one
layout that owns the ambient background and the sidebar. They used to build
their own, which meant collapsing the sidebar and navigating silently expanded
it again. Anything the shell owns now lives in
`components/shell/shell-context.tsx`.

That layout is `force-dynamic`. Every screen under it is one learner's, so there
is no build-time version of it to prerender, and marking it so also keeps the
production build free of runtime secrets.

Every route has `loading.tsx` and `error.tsx`, and the app has `not-found.tsx`
and `global-error.tsx`. A screen that can fail renders the failure.

## Responsive and dark mode

The app works from 360px up. The sidebar is an inline panel at `md` and above
and a `Sheet` drawer below it, triggered by the brand mark; the display type
scale is fluid `clamp()` so headlines are never re-specified per breakpoint;
and stimulus widths are preferences capped at the column rather than fixed
pixels. Check 360 / 768 / 1024 / 1440 before calling a screen done.

Dark mode is real, not inverted: every coach token — the ambient field, the orb
gradients, the frosted panels — has an authored `.dark` value. `next-themes`
mounts in `app/providers.tsx` and the toggle is in the sidebar.

Motion respects `prefers-reduced-motion`, and that includes the JavaScript. The
global CSS rule only neuters CSS animations, so `use-audio-level.ts` and
`voice-orb.tsx` gate their `requestAnimationFrame` loops on it directly.

## Onboarding

Answers live in `hooks/use-onboarding-draft.ts` — an external store backed by
`localStorage`, because there is no account until the very end. So does the
step the learner is on: persisting the answers but not the position sent
someone who closed the tab back to the name screen with a full draft. Storage
is attacker-writable and outlives deploys, so the stored blob is Zod-parsed
against the same option lists the screens render and anything unrecognised is
dropped rather than spread into the draft.

Which question feeds which part of the generator is spelled out in
[`../docs/product/onboarding.md`](../docs/product/onboarding.md); do not add a
question that does not change a generated session.

Adding a step means adding to `ONBOARDING_STEPS` in `lib/onboarding.ts`, a
component under `components/onboarding/steps/`, and a field on
`OnboardingDraft`. The screen registry is typed `Record<OnboardingStep, ...>`,
so forgetting the component is a compile error. Everything else — progress,
back and forward, persistence — follows from the array.

Most steps ask one question and take one answer, and those are one component:
`<ChoiceStep>`, driven by data. It carries the radiogroup semantics, the roving
tabindex and the validation message, which are exactly the things that get
added to one screen and forgotten on the other seven.

## The session screen

The middle slot under the orb holds exactly one of three things, and which one is a function of session state rather than a separate flag:

| State | What is in the slot |
| --- | --- |
| `listening` | `LiveTranscript` — words appearing as the learner speaks |
| after a turn | `CorrectionCard` |
| otherwise | `CoachGreeting` |

`LiveTranscript` renders the Web Speech API's interim results as the learner
speaks. The correction is withheld until the turn ends: the gap between what was
said and what was meant is what the correction is made of, and putting it on
screen mid-sentence gives it away before the learner has finished trying.

## Exercises

There are eighteen exercise templates in [`../docs/curriculum/exercise-templates.md`](../docs/curriculum/exercise-templates.md) and there is one practice screen. The rule that keeps it that way: **nothing in the UI branches on a template id.**

A session carries a `StimulusSpec` — a discriminated union in `components/session/stimulus/types.ts` with one variant per stimulus type in the curriculum. `<Stimulus spec={...} />` dispatches on `spec.kind` through an exhaustive switch, so adding a stimulus type to `lib/templates.ts` produces a compile error at the dispatcher rather than a blank panel at runtime. Adding `EX016 Debate` to the demo is a data change.

| File | What it owns |
| --- | --- |
| `lib/templates.ts` | The eighteen templates: stimulus kind, interaction mode, CEFR range, duration. A thin projection of the engine's descriptors — no `elicits` or `measures`, since the browser never scores anything. |
| `components/session/stimulus/` | One renderer per stimulus kind, plus the dispatcher and the shared `StimulusPanel`. |
| `components/session/stimulus/scenes.tsx` | Drawn stand-ins for Stimulus Pool assets, each with the description that is the ceiling on what the learner can be expected to say. |
| `components/session/exercise-stage.tsx` | Composes stimulus, orb and the feedback slot for any template. |
| `components/session/activity-rail.tsx` | Which of the Day Plan's four to six activities the learner is on. |

Every stimulus takes a `compact` prop. That is the state it enters when a correction is on screen: still visible, because a correction only means something against what the learner was looking at, but no longer competing with it.

## The turn loop

[`hooks/use-live-session.ts`](hooks/use-live-session.ts) runs the conversation:
it starts a session on the server, speaks the coach's line, listens, submits the
turn, and renders whatever comes back. The microphone decides when a turn ends —
voice activity detection, not a timer — so the learner controls the pace.

Speech is three small modules, and the split is what keeps the orb honest:

| File | Owns |
| --- | --- |
| `lib/speech/recognition.ts` | Web Speech recognition, voice activity, and the timing that fluency is derived from |
| `lib/speech/synthesis.ts` | The coach's voice — browser-native, or ElevenLabs audio proxied by the server |
| `lib/speech/coach-level.ts` | A module-level store of the coach's current amplitude |

The orb reads that last one, so when the coach is speaking the orb is moving to
the actual waveform rather than to a plausible-looking sine wave. When the
learner is speaking it reads the microphone. It is never animating over silence.

## Learner profile and the outline

`lib/learner-profile.ts` turns an `OnboardingDraft` into a `LearnerProfile` for
the reveal screen. These are deliberately different shapes — the draft is twelve
screens of UI state including a half-typed name. It applies defaults rather than
throwing, because it runs mid-onboarding when half the answers are null; check
`profile.placed` rather than inspecting fields.

`lib/onboarding-replay.ts` is the other direction: it converts the local draft
into the server's `UpdateProfileInput`, which `components/profile-sync.tsx`
sends once on the first authenticated render. That is how eleven answers given
before an account existed end up attached to one.

`lib/study-outline.ts` projects the next thirty days. Read [`../docs/adr/0007-the-outline-is-a-projection-not-a-plan.md`](../docs/adr/0007-the-outline-is-a-projection-not-a-plan.md) before changing it. An outline is not a plan: it names domains and objectives, never competencies or templates, because those are chosen the morning of from evidence that does not exist yet. It is stored nowhere and recomputed on every render, which is what stops it drifting from the engine.

## Language rules that reach the UI

[`../CONTEXT.md`](../CONTEXT.md) is binding for component names, props and every string a learner reads.

- The person practising is a **learner**. Not a user.
- **Rings** are Speak / Learn / Improve and measure showing up. **Profile Dimensions** measure getting better. Never call a dimension a ring, in code or in copy.
- A **Day Plan** is shown to the learner as "Today's Mission" — `day_plan` in code, "Today's Mission" on screen.
- A dimension with no evidence shows "not yet assessed", never 0%.

## Note on Next.js 16

`AGENTS.md` in this folder warns that this version has breaking changes against most training data. Check `node_modules/next/dist/docs/` before assuming an API works.
