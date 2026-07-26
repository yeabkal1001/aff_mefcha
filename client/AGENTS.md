<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Client

The browser half of the AI Communication Coach. Next.js 16, React 19, Tailwind 4, App Router.

Repo-wide rules are in `../AGENTS.md` and the glossary in `../CONTEXT.md` is binding for component names, props and UI copy. In particular: a Profile Dimension is never called a ring, and the person practising is a **learner**, not a user.

## Boundary

This package owns the browser and nothing else. **No provider API key ever reaches this bundle.** Every provider call goes through the server. The Clerk *publishable* key is the only credential-shaped thing here, and it is publishable by design.

Speech is the one thing that genuinely runs in the browser — the Web Speech API, which needs no key. ElevenLabs and Whisper are the server-side upgrades behind it.

Talk to the server over HTTP at `NEXT_PUBLIC_API_URL`. If you find yourself wanting a database query here, it belongs in the server.

## UI kit

Before hand-rolling a component, check whether shadcn or React Bits already has it. Both copy source into the repo via the shadcn CLI; neither is a runtime dependency.

```bash
pnpm dlx shadcn@latest add <name>                    # shadcn primitive -> components/ui/
pnpm dlx shadcn@latest add @react-bits/<Name>-TS-TW  # React Bits -> components/
```

React Bits ships four variants per component and only `-TS-TW` belongs here; the others are JavaScript or plain CSS. The `@react-bits` registry is declared in `components.json`.

Style tokens are oklch CSS variables in `app/globals.css`. Reach for a token (`bg-card`, `text-muted-foreground`, `rounded-lg`) rather than a literal colour or radius, so the Figma theme can be applied in one place.

The type scale is named by role — `text-ui`, `text-body`, `text-lead`,
`text-title`, `text-display`. Tailwind's own `text-sm`/`text-lg` are left alone
because the shadcn primitives are built on them, but everything we write uses
the role tokens. Same for shadows: `shadow-panel`, `shadow-raised`,
`shadow-overlay`. Arbitrary values like `text-[0.8125rem]` mean the scale is
missing something; add it to `@theme` rather than working around it.

Every colour token has an authored `.dark` value. If you add one, author both.

## Data

Screens do not fetch — an ESLint rule enforces it. Data comes from
`hooks/queries/*`, typed by the Zod schemas in `lib/api/schemas.ts`, which are
the contract with the server. Add a payload there first and infer the type from
the schema; do not write a type and a validator separately.

Every consumer renders loading, error and empty states. `lib/api/async.ts`
exists so that is four lines rather than a decision.

## Tests

`pnpm test` runs Vitest. Pure logic — the learner profile, the outline
projection, the onboarding replay, the draft store — is tested. Components are
not, deliberately: snapshot tests of animated screens cost more than they catch,
and the behaviour worth protecting is in the functions underneath them.

## Screens to build

Listed in `../docs/product/vision.md`. The demo script at the end of `../docs/product/persona.md` is the definition of done — build the beats it needs, in the order it needs them.

Every screen works to 360px, in both themes. The sidebar is a drawer below
`md`. The vision doc used to cut mobile; it no longer does.
