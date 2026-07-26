import type { Learner, LearnerProfile, Prisma } from "@prisma/client";

import {
  isUniqueViolation,
  prisma,
  translatePrismaError,
  type Db,
} from "../../infra/db/prisma.js";

/**
 * Every query about a learner's identity and profile.
 *
 * The repository boundary exists so services never see Prisma. That is not
 * ceremony: it means the mastery update, the plan builder and the evaluator can
 * be unit tested against a fake with no database at all, and it keeps
 * `include`/`select` decisions — the ones that quietly become N+1 problems —
 * inside a layer that can be reviewed as a whole.
 *
 * Every method takes an optional `Db` so it composes into a transaction. A
 * repository that always reaches for the global client cannot participate in
 * one, which forces callers to reimplement its queries inline the first time
 * they need atomicity.
 */

export type LearnerWithProfile = Learner & { profile: LearnerProfile | null };

export const learnerRepository = {
  async findByClerkId(clerkUserId: string, db: Db = prisma): Promise<Learner | null> {
    return db.learner.findFirst({ where: { clerkUserId } });
  },

  async findById(id: string, db: Db = prisma): Promise<LearnerWithProfile | null> {
    return db.learner.findFirst({ where: { id }, include: { profile: true } });
  },

  /**
   * Get the learner for a Clerk ID, creating them if this is the first sight.
   *
   * Provisioning on first authenticated request rather than only on the webhook
   * closes a real race: Clerk issues a valid session the instant a user signs
   * up, and the webhook is asynchronous. Waiting for it would make the first
   * request after signup fail intermittently — on the very first screen, which
   * is the worst possible place for a flaky error.
   *
   * `upsert` rather than find-then-create because two requests can arrive
   * together and both find nothing. The unique index on `clerkUserId` is what
   * actually decides; this just makes losing that race a no-op.
   */
  async findOrCreateByClerkId(clerkUserId: string, db: Db = prisma): Promise<Learner> {
    const existing = await db.learner.findFirst({ where: { clerkUserId } });
    if (existing) return existing;

    try {
      return await db.learner.create({
        // No email: the webhook supplies it, usually within a second or two.
        // Synthesising one from the Clerk ID would put a fake address on the
        // settings screen and in support search, and would make "has this
        // learner given us an address" unanswerable.
        data: { clerkUserId, profile: { create: {} } },
      });
    } catch (error) {
      // Lost the race. The other request created it; read theirs.
      if (isUniqueViolation(error)) {
        const winner = await db.learner.findFirst({ where: { clerkUserId } });
        if (winner) return winner;
      }
      throw translatePrismaError(error);
    }
  },

  /**
   * Reconcile identity from a Clerk webhook.
   *
   * Clerk is the source of truth for email and display name; this table is a
   * read replica of that for display and support search. Keyed on the Clerk ID
   * so an email change in Clerk updates the row rather than creating a second.
   */
  async upsertFromClerk(
    input: {
      clerkUserId: string;
      email: string;
      displayName: string | null;
      imageUrl: string | null;
    },
    db: Db = prisma,
  ): Promise<Learner> {
    return db.learner.upsert({
      where: { clerkUserId: input.clerkUserId },
      create: {
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        profile: { create: {} },
      },
      update: {
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
      },
    });
  },

  async updateProfile(
    learnerId: string,
    data: Prisma.LearnerProfileUpdateInput,
    db: Db = prisma,
  ): Promise<LearnerProfile> {
    // Upsert rather than update: a learner provisioned by a webhook that raced
    // the profile create would otherwise 404 on their first save.
    return db.learnerProfile.upsert({
      where: { learnerId },
      create: { ...(data as Prisma.LearnerProfileCreateInput), learner: { connect: { id: learnerId } } },
      update: data,
    });
  },

  async touchLastSeen(learnerId: string, db: Db = prisma): Promise<void> {
    await db.learner.update({
      where: { id: learnerId },
      data: { lastSeenAt: new Date() },
    });
  },

  /**
   * Mark for deletion. Does not remove anything yet.
   *
   * Soft first, hard later, for two reasons that pull the same way: an
   * accidental deletion is recoverable inside the grace window, and a hard
   * delete of a learner cascades through every turn and attempt they ever
   * produced — a long, lock-heavy transaction that has no business running
   * inside a request.
   */
  async softDelete(learnerId: string, db: Db = prisma): Promise<void> {
    await db.learner.update({
      where: { id: learnerId },
      data: { status: "PENDING_DELETION", deletedAt: new Date() },
    });
  },

  /**
   * Actually remove learners whose grace window has closed.
   *
   * Run from the cleanup job, not from a request. Everything owned by the
   * learner cascades from this one delete, which is why the foreign keys in the
   * schema are declared with `onDelete: Cascade` rather than being cleaned up
   * by hand — a hand-written teardown is one that misses a table.
   */
  async purgeDeletedBefore(cutoff: Date, db: Db = prisma): Promise<number> {
    const { count } = await db.learner.deleteMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    });
    return count;
  },
};

export type LearnerRepository = typeof learnerRepository;
