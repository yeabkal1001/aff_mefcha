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
[`lib/mock-data.ts`](lib/mock-data.ts), and the conversation loop is driven by
timers in [`hooks/use-session.ts`](hooks/use-session.ts).

Those two files are the whole seam. When the API exists, the exported shapes in
`mock-data.ts` become response bodies, and the timers in `use-session.ts` become
socket events — no component should need to change. Keep new mock shapes honest
for that reason, and resist reaching for mock data from inside a component.

The one genuinely live piece is [`hooks/use-audio-level.ts`](hooks/use-audio-level.ts),
which reads the real microphone through an `AnalyserNode` while the learner is
speaking. When the coach speaks there is no audio to measure yet, so the level
is synthesised; the same fallback covers a learner who refuses mic permission,
because a motionless orb reads as a broken app.

## Screens

The screens are listed in [`../docs/product/vision.md`](../docs/product/vision.md). Build them in the order the demo script at the end of [`../docs/product/persona.md`](../docs/product/persona.md) needs them — that script is the definition of done.

Routes today:

| Route | Screen |
| --- | --- |
| `/` | Landing. One call to action, no account. |
| `/onboarding` | The whole flow, step-machined over `ONBOARDING_STEPS` — seven questions, mic check, three assessment prompts, profile reveal. |
| `/practice` | The live session. |
| `/signup` | Shown after the first mission, never before it. |

Onboarding answers live in `hooks/use-onboarding-draft.ts` — an external store backed by `localStorage`, because there is no account until the very end. Which question feeds which part of the generator is spelled out in [`../docs/product/onboarding.md`](../docs/product/onboarding.md); do not add a question that does not change a generated session.

## Language rules that reach the UI

[`../CONTEXT.md`](../CONTEXT.md) is binding for component names, props and every string a learner reads.

- The person practising is a **learner**. Not a user.
- **Rings** are Speak / Learn / Improve and measure showing up. **Profile Dimensions** measure getting better. Never call a dimension a ring, in code or in copy.
- A **Day Plan** is shown to the learner as "Today's Mission" — `day_plan` in code, "Today's Mission" on screen.
- A dimension with no evidence shows "not yet assessed", never 0%.

## Note on Next.js 16

`AGENTS.md` in this folder warns that this version has breaking changes against most training data. Check `node_modules/next/dist/docs/` before assuming an API works.
