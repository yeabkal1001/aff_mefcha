import type { Learner, LearnerProfile } from "@prisma/client";

import { AppError } from "../../core/errors.js";
import { computeProfile, type DimensionInput } from "../../domain/scoring/mastery.js";
import { prisma } from "../../infra/db/prisma.js";
import { recordAudit } from "../audit/audit.service.js";
import { learnerRepository, type LearnerWithProfile } from "./learner.repository.js";
import type {
  LearnerResponse,
  ProfileResponse,
  UpdateProfileInput,
} from "./learner.schemas.js";

/**
 * Learner identity, the onboarding profile, and the Communication Profile.
 *
 * The service layer owns the rules; the repository owns the queries; the route
 * owns HTTP. Nothing here knows what a request or a response is, which is what
 * lets the interesting parts be tested by calling a function.
 */

export const learnerService = {
  async getMe(learner: Learner): Promise<LearnerResponse> {
    const full = await learnerRepository.findById(learner.id);
    if (!full) throw AppError.notFound("Your account");

    return toLearnerResponse(full);
  },

  /**
   * Save onboarding answers, or a later edit from settings.
   *
   * The same endpoint serves both, because they are the same write and a
   * separate "onboarding" write would drift from the settings one within a
   * month. Partial by design — onboarding saves each answer as it is given.
   */
  async updateProfile(
    learner: Learner,
    input: UpdateProfileInput,
  ): Promise<LearnerResponse> {
    // A Life Path with no authored content is selectable in no circumstances.
    // Checked here rather than in the schema because it is a data question, and
    // the set of live paths changes without a deploy.
    if (input.lifePathId) {
      const path = await prisma.lifePath.findUnique({
        where: { id: input.lifePathId },
        select: { isLive: true },
      });

      if (!path) throw AppError.badRequest("That Life Path doesn't exist.");
      if (!path.isLive) {
        throw AppError.badRequest("That Life Path isn't available yet.");
      }
    }

    const { displayName, ...profileFields } = input;

    const updated = await prisma.$transaction(async (tx) => {
      if (displayName !== undefined) {
        await tx.learner.update({
          where: { id: learner.id },
          data: { displayName },
        });
      }

      // Explicit field mapping rather than a spread. A spread of a validated
      // object is safe *today*; it stops being safe the moment somebody adds a
      // field to the schema without thinking about whether it is writable, and
      // that is not a review anybody reliably performs.
      await learnerRepository.updateProfile(
        learner.id,
        {
          ...(profileFields.l1 !== undefined ? { l1: profileFields.l1 } : {}),
          ...(profileFields.ageBand !== undefined ? { ageBand: profileFields.ageBand } : {}),
          ...(profileFields.gender !== undefined ? { gender: profileFields.gender } : {}),
          ...(profileFields.studyField !== undefined
            ? { studyField: profileFields.studyField }
            : {}),
          ...(profileFields.dailyMinutes !== undefined
            ? { dailyMinutes: profileFields.dailyMinutes }
            : {}),
          ...(profileFields.feedbackLanguage !== undefined
            ? { feedbackLanguage: profileFields.feedbackLanguage }
            : {}),
          ...(profileFields.goalDate !== undefined ? { goalDate: profileFields.goalDate } : {}),
          ...(profileFields.timezone !== undefined ? { timezone: profileFields.timezone } : {}),
          ...(profileFields.lifePathId !== undefined
            ? {
                lifePath: profileFields.lifePathId
                  ? { connect: { id: profileFields.lifePathId } }
                  : { disconnect: true },
              }
            : {}),
        },
        tx,
      );

      const full = await tx.learner.findFirst({
        where: { id: learner.id },
        include: { profile: true },
      });
      if (!full) throw AppError.notFound("Your account");
      return full;
    });

    // Audited because a profile change alters what the engine teaches, and
    // "why did my plan change" is a support question that needs an answer.
    await recordAudit({
      learnerId: learner.id,
      action: "learner.profile.updated",
      entity: "learner",
      entityId: learner.id,
      changes: { fields: Object.keys(input) },
    });

    return toLearnerResponse(updated);
  },

  /**
   * The Communication Profile: four dimensions, plus lifetime totals.
   *
   * Everything here is read from `LearnerCompetency` and folded by the pure
   * functions in `domain/scoring`. Nothing is stored pre-computed, which is
   * ADR 0002 — the dashboard cannot disagree with the learner model because
   * there is only one place the numbers can come from.
   */
  async getCommunicationProfile(learnerId: string): Promise<ProfileResponse> {
    const [states, totals] = await Promise.all([
      // One query with the competency joined, not one query per competency.
      // The N+1 here would be per-competency and there are hundreds of them.
      prisma.learnerCompetency.findMany({
        where: { learnerId },
        select: {
          mastery: true,
          evidenceCount: true,
          competency: {
            select: {
              skill: true,
              observable: true,
              domainRequires: { select: { weight: true }, take: 1 },
            },
          },
        },
      }),
      this.getTotals(learnerId),
    ]);

    const inputs: DimensionInput[] = states.map((state) => ({
      skill: state.competency.skill,
      observable: state.competency.observable,
      mastery: state.mastery,
      evidenceCount: state.evidenceCount,
      // A competency not required by any domain still counts, at unit weight.
      weight: state.competency.domainRequires[0]?.weight ?? 1,
    }));

    return { dimensions: computeProfile(inputs), totals };
  },

  /**
   * Lifetime counters for the progress card.
   *
   * Aggregated in the database rather than by loading rows and reducing in
   * Node. The difference is a few hundred bytes over the wire against every
   * turn the learner has ever spoken, and it only diverges as they use the
   * product more.
   */
  async getTotals(learnerId: string): Promise<ProfileResponse["totals"]> {
    const [sessions, turns, corrections, days] = await Promise.all([
      prisma.session.count({
        where: { dayPlan: { learnerId }, status: "COMPLETED" },
      }),
      prisma.turn.aggregate({
        where: { session: { dayPlan: { learnerId } } },
        _count: { id: true },
      }),
      // A correction is an attempt that found at least one error. Counting
      // error tags would over-count a turn with three mistakes in one
      // competency, which is one correction on screen.
      prisma.attempt.count({
        where: {
          turn: { session: { dayPlan: { learnerId } } },
          isFinal: true,
          correct: { lt: prisma.attempt.fields.opportunities },
        },
      }),
      prisma.dayPlan.findMany({
        where: { learnerId, completedAt: { not: null } },
        select: { date: true },
        orderBy: { date: "desc" },
        // A streak longer than a year does not need to be exact, and this
        // bounds the query rather than scanning a lifetime of plans.
        take: 400,
      }),
    ]);

    const speaking = await prisma.$queryRaw<{ seconds: bigint | null }[]>`
      SELECT COALESCE(SUM((t.metrics->>'speechMs')::bigint), 0) / 1000 AS seconds
      FROM turn t
      JOIN session s ON s.id = t.session_id
      JOIN day_plan d ON d.id = s.day_plan_id
      WHERE d.learner_id = ${learnerId}::uuid
    `;

    return {
      sessionsCompleted: sessions,
      turnsSpoken: turns._count.id,
      speakingSeconds: Number(speaking[0]?.seconds ?? 0),
      corrections,
      streakDays: countStreak(days.map((day) => day.date)),
    };
  },

  /**
   * Begin deletion.
   *
   * Soft, then purged by the cleanup job after the grace window. The window is
   * what makes an accidental deletion recoverable; the eventual hard delete is
   * what makes the promise real.
   */
  async requestDeletion(learner: Learner): Promise<void> {
    await learnerRepository.softDelete(learner.id);
    await recordAudit({
      learnerId: learner.id,
      action: "learner.deletion.requested",
      entity: "learner",
      entityId: learner.id,
    });
  },
};

/**
 * Consecutive completed days, counting back from today.
 *
 * Today not yet being complete does not break a streak — it is still today.
 * Starting the count at yesterday when today is missing is the difference
 * between a streak counter that motivates and one that punishes you at 9am.
 */
export function countStreak(dates: readonly Date[], now = new Date()): number {
  if (dates.length === 0) return 0;

  const days = new Set(dates.map(toDayNumber));
  const today = toDayNumber(now);

  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;

  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }

  return streak;
}

/** Whole days since the epoch, in UTC. Dates are stored as `@db.Date`. */
function toDayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000,
  );
}

/**
 * Prisma row to wire shape.
 *
 * The explicit field list is the point. Returning the row directly would mean
 * every column added to `Learner` from now on is published to clients by
 * default, and `clerkUserId` is one of them.
 */
export function toLearnerResponse(
  learner: Learner & { profile: LearnerProfile | null },
): LearnerResponse {
  const profile = learner.profile;

  return {
    id: learner.id,
    email: learner.email,
    displayName: learner.displayName,
    imageUrl: learner.imageUrl,
    createdAt: learner.createdAt.toISOString(),
    profile: {
      cefr: profile?.cefr ?? "A2",
      l1: profile?.l1 ?? "am",
      ageBand: profile?.ageBand ?? null,
      gender: profile?.gender ?? "UNDISCLOSED",
      lifePathId: profile?.lifePathId ?? null,
      studyField: profile?.studyField ?? null,
      dailyMinutes: profile?.dailyMinutes ?? 15,
      feedbackLanguage: profile?.feedbackLanguage ?? "ENGLISH",
      // A date column, so only the date half is meaningful.
      goalDate: profile?.goalDate?.toISOString().slice(0, 10) ?? null,
      timezone: profile?.timezone ?? "Africa/Addis_Ababa",
      placedAt: profile?.placedAt?.toISOString() ?? null,
    },
  };
}

export type { LearnerWithProfile };
