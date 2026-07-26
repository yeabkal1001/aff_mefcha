# Build context is the repo root, not this directory.
#
# The server is one package in a pnpm workspace, and the lockfile that pins its
# dependencies lives at the root. Building from `server/` would mean copying the
# lockfile in by hand and losing the guarantee it exists to give.
#
#   docker build -f server/Dockerfile -t english-coach-api .

# ---------------------------------------------------------------------------
# base — the toolchain, shared so every stage agrees on the Node and pnpm
# version. Alpine keeps the final image small; openssl is Prisma's query engine
# requirement and is genuinely missing from alpine, not merely unlinked.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — every dependency, including dev ones, because the build needs the
# compiler. Manifests are copied before sources so this layer is cached across
# code changes and only reinstalls when a dependency actually moves.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY server/package.json server/
# --frozen-lockfile: a lockfile that disagrees with the manifests is a failed
# build, not a silently different dependency tree than the one that was tested.
RUN pnpm install --frozen-lockfile --filter server...

# ---------------------------------------------------------------------------
# build — compile TypeScript to dist/. `pnpm build` generates the Prisma client
# first, because the compile needs its types.
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY server/ server/
RUN pnpm --filter server build

# ---------------------------------------------------------------------------
# prod — the dependency tree that ships: production only, generated against.
#
# A separate install rather than pruning the build tree, because pnpm's prune
# reinstalls from the store and the generated Prisma client — which is written
# *into* the installed @prisma/client package, not alongside it — does not
# survive that. Generating again here is a few seconds and removes the whole
# question.
# ---------------------------------------------------------------------------
FROM base AS prod
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --prod --filter server...
COPY server/prisma server/prisma
COPY server/prisma.config.ts server/
RUN pnpm --filter server exec prisma generate

# ---------------------------------------------------------------------------
# runtime — what actually ships.
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

# Unprivileged. The `node` user ships with the image; a container process that
# does not need root should not have it, and this one never writes to disk.
USER node
WORKDIR /app

COPY --from=prod --chown=node:node /app/node_modules ./node_modules
COPY --from=prod --chown=node:node /app/server/node_modules ./server/node_modules
COPY --from=build --chown=node:node /app/server/dist ./server/dist
COPY --from=build --chown=node:node /app/server/package.json ./server/

# Migrations and the Prisma config ship with the image so `prisma migrate
# deploy` can be run against it — Render's pre-deploy step does exactly that,
# which is also why the Prisma CLI is a production dependency.
COPY --from=build --chown=node:node /app/server/prisma ./server/prisma
COPY --from=build --chown=node:node /app/server/prisma.config.ts ./server/

WORKDIR /app/server

# Matches the default in src/config/env.ts. Render overrides PORT; the server
# reads it rather than hardcoding, so this is documentation for a human reading
# `docker inspect`, not configuration.
EXPOSE 4000

# The readiness endpoint, which checks the database rather than only answering.
# A container that is up but cannot reach Postgres is not serving anyone.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# node directly, not `pnpm start`. A package manager in between swallows the
# SIGTERM that main.ts installs a handler for, and graceful shutdown becomes a
# 30-second wait followed by SIGKILL mid-request.
CMD ["node", "dist/main.js"]
