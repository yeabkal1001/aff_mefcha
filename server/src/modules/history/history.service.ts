import { paginate } from "../../http/route.js";
import { prisma } from "../../infra/db/prisma.js";

/**
 * Reading back what a learner has done.
 *
 * Cursor-paginated, not offset. `OFFSET n` makes Postgres walk and discard n
 * rows, so a learner three months in pays for their whole history to read the
 * oldest page — and a session finishing mid-scroll shifts every page after it.
 * Seeking on the ordered key is constant time and stable under concurrent
 * writes. Both queries order on `(sort key, id)` because the sort key alone is
 * not unique, and a cursor over a non-unique key silently skips rows.
 */

export interface PageQuery {
  limit: number;
  cursor?: string;
}

export const historyService = {
  /** Day plans, newest first, with a turn count per session. */
  async listDays(learnerId: string, query: PageQuery) {
    const plans = await prisma.dayPlan.findMany({
      where: { learnerId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      // One over the page size, so "is there more" needs no second COUNT(*)
      // over the same predicate.
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        domain: { select: { name: true } },
        sessions: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            status: true,
            prompt: true,
            orderIndex: true,
            // Aggregated by the database rather than by loading every turn and
            // counting in Node. This endpoint would otherwise pull a learner's
            // entire transcript history to render a summary list.
            _count: { select: { turns: true } },
          },
        },
      },
    });

    const page = paginate(plans, query.limit);

    return {
      items: page.items.map((plan) => ({
        id: plan.id,
        date: plan.date.toISOString().slice(0, 10),
        theme: plan.theme,
        domain: plan.domain.name,
        completedAt: plan.completedAt?.toISOString() ?? null,
        activities: plan.sessions.map((session) => ({
          id: session.id,
          orderIndex: session.orderIndex,
          status: session.status,
          prompt: session.prompt,
          turnCount: session._count.turns,
        })),
      })),
      nextCursor: page.nextCursor,
    };
  },

  /**
   * The corrections the learner has collected, most recent first.
   *
   * Read from attempts rather than from a separate corrections table: there is
   * one record of what went wrong and it is the same one that moved mastery, so
   * the screen showing improvement cannot disagree with the score.
   */
  async listCorrections(learnerId: string, query: PageQuery) {
    const attempts = await prisma.attempt.findMany({
      where: {
        turn: { session: { dayPlan: { learnerId } } },
        isFinal: true,
        errorTags: { isEmpty: false },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        competencyId: true,
        opportunities: true,
        correct: true,
        errorTags: true,
        createdAt: true,
        competency: { select: { name: true, skill: true } },
        turn: {
          select: {
            transcriptVerbatim: true,
            transcriptClean: true,
            session: { select: { id: true, dayPlan: { select: { date: true } } } },
          },
        },
      },
    });

    const page = paginate(attempts, query.limit);

    return {
      items: page.items.map((attempt) => ({
        id: attempt.id,
        at: attempt.createdAt.toISOString(),
        date: attempt.turn.session.dayPlan.date.toISOString().slice(0, 10),
        sessionId: attempt.turn.session.id,
        skill: attempt.competency.skill,
        competency: attempt.competency.name,
        said: attempt.turn.transcriptVerbatim,
        better: attempt.turn.transcriptClean,
        errorTags: attempt.errorTags,
        observed:
          attempt.opportunities > 0 ? attempt.correct / attempt.opportunities : null,
      })),
      nextCursor: page.nextCursor,
    };
  },
};
