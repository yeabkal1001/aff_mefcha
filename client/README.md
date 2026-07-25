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

## Screens

The seven screens are listed in [`../docs/product/vision.md`](../docs/product/vision.md). Build them in the order the demo script at the end of [`../docs/product/persona.md`](../docs/product/persona.md) needs them — that script is the definition of done.

## Language rules that reach the UI

[`../CONTEXT.md`](../CONTEXT.md) is binding for component names, props and every string a learner reads.

- The person practising is a **learner**. Not a user.
- **Rings** are Speak / Learn / Improve and measure showing up. **Profile Dimensions** measure getting better. Never call a dimension a ring, in code or in copy.
- A **Day Plan** is shown to the learner as "Today's Mission" — `day_plan` in code, "Today's Mission" on screen.
- A dimension with no evidence shows "not yet assessed", never 0%.

## Note on Next.js 16

`AGENTS.md` in this folder warns that this version has breaking changes against most training data. Check `node_modules/next/dist/docs/` before assuming an API works.
