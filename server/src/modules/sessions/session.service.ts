import type { Learner } from "@prisma/client";

import { AppError } from "../../core/errors.js";
import { assertOwnership } from "../../http/middleware/auth.js";
import { prisma } from "../../infra/db/prisma.js";
import { planService } from "../plans/plan.service.js";

/**
 * The lifecycle of one exercise: start it, run turns against it, finish it.
 *
 * Every method here begins by loading the session *with its owner* and calling
 * `assertOwnership`. That is repetitive on purpose. The alternative — trusting
 * that the route checked — is how the one endpoint added in a hurry becomes the
 * one that lets any learner read any session.
 */

/** Nothing useful comes after this many turns; it is a stop, not a target. */
const MAX_TURNS = 20;

export const sessionService = {
  /**
   * Load a session and prove the caller owns it.
   *
   * The single authorization gate for this module. Returns the session with
   * everything the callers need, so ownership and loading cannot drift apart
   * into two calls where only one of them happens.
   */
  async loadOwned(sessionId: string, learner: Learner) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        dayPlan: { select: { id: true, learnerId: true, theme: true } },
        template: true,
        targets: {
          orderBy: { priority: "asc" },
          include: { competency: true },
        },
      },
    });

    // 404 before the ownership check would be an existence oracle; 403 after it
    // for a row that does not exist would be a lie. A missing row is a 404 and
    // someone else's row is a 403 with a message that says nothing about which.
    if (!session) throw AppError.notFound("That session");

    assertOwnership(learner, session.dayPlan.learnerId);
    return session;
  },

  /**
   * Begin, or resume.
   *
   * Idempotent: starting an in-progress session returns it unchanged rather
   * than resetting it. A learner who refreshes mid-exercise keeps their turns.
   */
  async start(sessionId: string, learner: Learner) {
    const session = await this.loadOwned(sessionId, learner);

    if (session.status === "COMPLETED") {
      throw AppError.invalidState("That exercise is already finished.");
    }

    if (session.status === "IN_PROGRESS") return session;

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });

    return { ...session, status: "IN_PROGRESS" as const, startedAt: new Date() };
  },

  /**
   * Finish, and roll the plan up if this was the last one.
   *
   * The plan's completion is derived from its sessions rather than set by the
   * client, so a client that never sends the final call cannot leave a plan
   * permanently open — and one that sends it twice cannot double-count a streak.
   */
  async complete(sessionId: string, learner: Learner) {
    const session = await this.loadOwned(sessionId, learner);

    if (session.status === "COMPLETED") return session;

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await planService.completeIfFinished(session.dayPlan.id);

    return { ...session, status: "COMPLETED" as const };
  },

  /**
   * Abandon. Kept, not deleted.
   *
   * An abandoned session is evidence about difficulty. Deleting it would bias
   * the learner model toward whatever the learner found easy enough to finish,
   * which is the opposite of what an adaptive system needs to know.
   */
  async abandon(sessionId: string, learner: Learner) {
    const session = await this.loadOwned(sessionId, learner);
    if (session.status === "COMPLETED") return session;

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "ABANDONED", completedAt: new Date() },
    });

    return { ...session, status: "ABANDONED" as const };
  },

  /**
   * The next turn index, and the check that there is room for one.
   *
   * Reads the maximum rather than counting, so a deleted turn cannot cause a
   * collision with the unique index on `(sessionId, index)`.
   */
  async nextTurnIndex(sessionId: string): Promise<number> {
    const last = await prisma.turn.findFirst({
      where: { sessionId },
      orderBy: { index: "desc" },
      select: { index: true },
    });

    const next = (last?.index ?? -1) + 1;

    if (next >= MAX_TURNS) {
      throw AppError.invalidState(
        "This exercise has gone on long enough. Finish it and start the next one.",
      );
    }

    return next;
  },

  /** Prior turns, for the director's context. Bounded — a prompt is not a log. */
  async recentTurns(sessionId: string, limit = 6) {
    const turns = await prisma.turn.findMany({
      where: { sessionId },
      orderBy: { index: "desc" },
      take: limit,
      select: { transcriptVerbatim: true, coachReply: true },
    });

    return turns
      .reverse()
      .map((turn) => ({ learner: turn.transcriptVerbatim, coach: turn.coachReply }));
  },

  /**
   * One exercise in full: what was said, what came back, and how it was graded.
   *
   * Ownership is checked first and separately, so an unauthorised caller never
   * causes the expensive read. `observed` is derived here rather than stored,
   * for the same reason the four dimensions are: a stored ratio can drift out
   * of agreement with the counts it came from, and then two screens disagree.
   */
  async transcript(sessionId: string, learner: Learner) {
    const session = await this.loadOwned(sessionId, learner);

    const turns = await prisma.turn.findMany({
      where: { sessionId: session.id },
      orderBy: { index: "asc" },
      select: {
        id: true,
        index: true,
        transcriptVerbatim: true,
        transcriptClean: true,
        coachReply: true,
        evaluatedAt: true,
        createdAt: true,
        attempts: {
          select: {
            competencyId: true,
            opportunities: true,
            correct: true,
            errorTags: true,
            competency: { select: { name: true, skill: true } },
          },
        },
      },
    });

    return {
      id: session.id,
      status: session.status,
      prompt: session.prompt,
      spec: session.spec,
      theme: session.dayPlan.theme,
      targets: session.targets.map((target) => ({
        competencyId: target.competencyId,
        name: target.competency.name,
        skill: target.competency.skill,
        role: target.role,
      })),
      turns: turns.map((turn) => ({
        id: turn.id,
        index: turn.index,
        learner: turn.transcriptVerbatim,
        learnerPolished: turn.transcriptClean,
        coach: turn.coachReply,
        graded: turn.evaluatedAt !== null,
        at: turn.createdAt.toISOString(),
        attempts: turn.attempts.map((attempt) => ({
          competencyId: attempt.competencyId,
          name: attempt.competency.name,
          skill: attempt.competency.skill,
          opportunities: attempt.opportunities,
          correct: attempt.correct,
          observed:
            attempt.opportunities > 0 ? attempt.correct / attempt.opportunities : null,
          errorTags: attempt.errorTags,
        })),
      })),
    };
  },
};
