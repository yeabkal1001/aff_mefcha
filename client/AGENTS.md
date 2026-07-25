<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Client

The browser half of the AI Communication Coach. Next.js 16, React 19, Tailwind 4, App Router.

Repo-wide rules are in `../AGENTS.md` and the glossary in `../CONTEXT.md` is binding for component names, props and UI copy. In particular: a Profile Dimension is never called a ring, and the person practising is a **learner**, not a user.

## Boundary

This package owns the browser and nothing else. **No provider API key ever reaches this bundle** — not fal, not Addis AI, not Exa, not Firecrawl. Every provider call goes through the server, which is also where the short-lived Wispr Flow client token is minted. The one exception by design is that the browser streams audio directly to Wispr Flow over WebSocket, using a token the server issued.

Talk to the server over HTTP at `NEXT_PUBLIC_API_URL`. If you find yourself wanting a database query here, it belongs in the server.

## Screens to build

Listed in `../docs/product/vision.md`. The demo script at the end of `../docs/product/persona.md` is the definition of done — build the beats it needs, in the order it needs them.
