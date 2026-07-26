# Deployment

Three pieces: a Postgres database, the API, and the Next app. `render.yaml` at
the repo root declares all three. Everything below is what that file cannot
declare — the secrets, and the order things happen in.

## First deploy

1. **Blueprint.** Render → New → Blueprint → point it at this repository. It
   reads `render.yaml` and creates `english-coach-db`, `english-coach-api` and
   `english-coach-web`. It will refuse to finish until the `sync: false`
   variables have values.

2. **Secrets.** Set these by hand, once, on the service that needs them.

   | Variable | Service | Where it comes from |
   | --- | --- | --- |
   | `CLERK_SECRET_KEY` | api | Clerk → API Keys → Secret key |
   | `CLERK_PUBLISHABLE_KEY` | api | Clerk → API Keys → Publishable key |
   | `CLERK_WEBHOOK_SIGNING_SECRET` | api | Clerk → Webhooks → your endpoint → Signing Secret |
   | `GEMINI_API_KEY` | api | Google AI Studio → API keys |
   | `ELEVENLABS_API_KEY` | api | ElevenLabs → Profile → API key |
   | `WHISPER_API_KEY` | api | OpenAI → API keys |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | The same publishable key as above |
   | `NEXT_PUBLIC_SITE_URL` | web | The web service's own URL |

   `ELEVENLABS_API_KEY` and `WHISPER_API_KEY` may be left empty. The coach falls
   back to the browser's own speech synthesis and recognition, which is the
   default path anyway; these two are the upgrade for devices whose built-in
   voices are poor and for turns worth a round trip for word timings.

3. **Clerk webhook.** Clerk → Webhooks → Add Endpoint, pointing at
   `https://<api>.onrender.com/v1/webhooks/clerk`, subscribed to `user.created`,
   `user.updated` and `user.deleted`. Without it, an account deleted in Clerk
   stays live here.

4. **Seed the curriculum.** The migrations create the tables; the curriculum
   rows are separate because they are content, not schema. Once, from a Render
   shell on the API service:

   ```
   node dist/cli/seed.js
   ```

   It is idempotent — an upsert per row — so re-running it after a content
   change is the intended way to publish one.

## Every deploy after that

Push to the tracked branch. Render builds the image, runs
`pnpm --filter server db:deploy` as a pre-deploy step, and only promotes the new
instance once `/ready` answers.

Migrations run in that pre-deploy step rather than in the container's
entrypoint, which matters as soon as there is more than one instance: an
entrypoint runs per instance, and three of them would race the same schema.

The consequence is the usual one, and it is worth stating plainly: **the new
migration runs while the old code is still serving.** Expand and contract, in
separate deploys — add a nullable column, ship code that writes it, backfill,
then make it required. A migration that drops or renames something the running
code still reads is an outage, and Render will not catch it for you.

## Health

- `/health` — the process is alive. Does not touch the database. This is what a
  platform liveness probe should use; a database blip should not restart a
  process that is otherwise fine.
- `/ready` — the process can serve. Checks the database, and answers 503
  `draining` from the moment SIGTERM arrives, so the balancer stops routing
  before the socket closes.

## Rotating a key

Do this on a schedule, and immediately if a key has been pasted anywhere it
should not have been — a chat window, a screenshot, a commit.

Every provider here supports having two live keys at once, so there is no
window where the service is down:

1. Create the new key in the provider's dashboard. Do not delete the old one.
2. Update the variable in Render. The service restarts and picks it up.
3. Confirm: a real session end to end, and the API logs clean of 401s from the
   provider.
4. Revoke the old key at the provider.

`DATABASE_URL` is the exception — Render owns it, and rotation is Render →
database → Rotate password, after which linked services redeploy themselves.

### Keys that need rotating now

The keys currently in `server/.env` were shared over chat during development
and must be treated as compromised before this reaches a real user:

- [ ] Gemini
- [ ] ElevenLabs
- [ ] Whisper
- [ ] The Render Postgres password, if the connection string was ever shared
      outside the dashboard

None of them are in git — `.gitignore` covers `.env` and `.dockerignore` keeps
it out of the image — but "not committed" is not "not exposed".

## Running the image locally

```
docker build -f server/Dockerfile -t english-coach-api .
docker run --rm -p 4000:4000 --env-file server/.env english-coach-api
```

Build context is the repo root, not `server/`, because the pnpm lockfile that
pins the dependency tree lives there.
