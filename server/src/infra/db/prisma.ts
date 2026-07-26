import { Prisma, PrismaClient } from "@prisma/client";

import { env, isProduction } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../core/logger.js";
import { log } from "../../core/request-context.js";

/**
 * The database client, and the translation from Prisma's errors into ours.
 *
 * One instance for the process. Prisma pools connections internally, so a
 * second client is a second pool against the same Postgres — which is how a
 * service with a generous-looking connection limit runs out of connections.
 */

/**
 * Survives module reload in `tsx watch`.
 *
 * Without this, every save during development opens a fresh pool and leaks the
 * old one, and after twenty edits Postgres refuses new connections. The global
 * is deliberately absent in production, where modules are loaded once.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Put a hard ceiling on every statement, at the connection.
 *
 * A query with no timeout is a pooled connection that never comes back, and a
 * pool that never refills is an outage caused by one pathological plan. This
 * has to be Postgres's own `statement_timeout` rather than a JavaScript race:
 * a timer that rejects the promise abandons the caller but leaves the query
 * running, still holding its connection and its locks, which is the failure we
 * were trying to prevent.
 *
 * Passed as a libpq `options` parameter so it is applied when the connection is
 * established. That survives PgBouncer, which resets anything set later with a
 * `SET` between checkouts.
 */
function withStatementTimeout(url: string, timeoutMs: number): string {
  const parsed = new URL(url);
  const existing = parsed.searchParams.get("options");
  const flag = `-c statement_timeout=${timeoutMs}`;
  parsed.searchParams.set("options", existing ? `${existing} ${flag}` : flag);
  return parsed.toString();
}

function createClient() {
  const client = new PrismaClient({
    datasourceUrl: withStatementTimeout(
      env.DATABASE_URL,
      env.DATABASE_STATEMENT_TIMEOUT_MS,
    ),
    // Query logs go through pino as events rather than to stdout, so they carry
    // the request ID and obey the configured level like everything else.
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("warn", (event) => logger.warn({ prisma: event }, "prisma warning"));
  client.$on("error", (event) => logger.error({ prisma: event }, "prisma error"));

  client.$on("query", (event) => {
    // Only the slow ones, and never the parameters — those are learner data.
    // A query log that includes `params` is a transcript log with extra steps.
    if (event.duration < 200) return;
    log().warn(
      { durationMs: event.duration, query: event.query },
      "slow query",
    );
  });

  return client.$extends(softDeleteLearners) as unknown as PrismaClient;
}

/**
 * A deleted learner is invisible to ordinary reads.
 *
 * Enforced here rather than at each call site, because "filter on deletedAt"
 * is exactly the kind of thing that is remembered in ninety-five per cent of
 * queries — and the five per cent is a deleted account still receiving day
 * plans. Writes are left alone: the purge job has to be able to see them.
 */
const softDeleteLearners = Prisma.defineExtension({
  name: "softDeleteLearners",
  query: {
    learner: {
      async findMany({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
      async count({ args, query }) {
        args.where = { deletedAt: null, ...args.where };
        return query(args);
      },
    },
  },
});

export const prisma = globalForPrisma.prisma ?? createClient();

if (!isProduction) globalForPrisma.prisma = prisma;

/** A transaction handle. Repositories accept this so they compose. */
export type Tx = Prisma.TransactionClient;

/** Either the shared client or an open transaction. */
export type Db = PrismaClient | Tx;

/**
 * Turn a Prisma failure into an `AppError`.
 *
 * The point is containment. A raw `PrismaClientKnownRequestError` reaching the
 * error handler would be reported as a bare 500, losing the fact that a unique
 * violation is a 409 the client can act on — and its message names tables and
 * columns, which is schema disclosure we have no reason to hand out.
 */
export function translatePrismaError(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return error;

  switch (error.code) {
    // Unique constraint. Concurrent creates of the same day plan land here,
    // and the caller usually wants to re-read rather than fail.
    case "P2002":
      return AppError.conflict("That already exists.", {
        cause: error,
        context: { target: error.meta?.target },
      });

    // Foreign key violation — pointing at something that is not there.
    case "P2003":
      return AppError.badRequest("That refers to something that doesn't exist.", {
        cause: error,
        context: { field: error.meta?.field_name },
      });

    // Update or delete of a row that is not there.
    case "P2025":
      return AppError.notFound("That", { cause: error });

    // Statement timeout, or the pool is exhausted. Both are load, not a bug in
    // the request, so the client is told to come back rather than told it erred.
    case "P2024":
      return new AppError(
        503,
        "service_unavailable",
        "We're busy right now. Try again in a moment.",
        { cause: error, retryAfterSeconds: 2 },
      );

    default:
      return error;
  }
}

/**
 * Did this failure come from a unique index?
 *
 * Callers that race deliberately — provisioning a learner, building today's
 * plan — need to tell "someone else got there first, re-read theirs" from a
 * real fault. They cannot test for `PrismaClientKnownRequestError` directly,
 * because anything that has passed through `transaction` or a repository has
 * already been translated into an `AppError` and the original is only reachable
 * through `cause`. Both shapes are the same event, so both answer true here.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2002";
  if (error instanceof AppError) return isUniqueViolation(error.cause);
  return false;
}

/**
 * Run work inside a transaction, with Prisma's errors already translated.
 *
 * `Serializable` is not the default here: the writes that need it say so. The
 * one that does is the mastery update, where two turns graded concurrently
 * would otherwise read the same prior mastery and one update would be lost.
 */
export async function transaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number },
): Promise<T> {
  try {
    return await prisma.$transaction(fn, {
      isolationLevel: options?.isolationLevel,
      timeout: options?.timeoutMs ?? 10_000,
    });
  } catch (error) {
    throw translatePrismaError(error);
  }
}

/** Liveness of the database itself, for the readiness probe. */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
