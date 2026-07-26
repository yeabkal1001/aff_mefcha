import type { Learner, LearnerProfile } from "@prisma/client";

import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import {
  exerciseCount,
  selectTargets,
  unmetPrerequisites,
  type Candidate,
  type ScoredCandidate,
} from "../../domain/planning/select.js";
import { isUniqueViolation, prisma, transaction, type Tx } from "../../infra/db/prisma.js";

/**
 * Building a day's work from the learner model.
 *
 * The rule from section 9 of the session engine doc: there is no stored
 * learning plan. A Day Plan is generated on the morning it is needed, from
 * mastery that only exists once the learner has practised. Pre-computing a
 * week of them would mean day three was planned against day one's knowledge —
 * which is precisely the adaptive behaviour the product claims to have.
 */

export interface PlanTarget {
  competencyId: string;
  name: string;
  skill: string;
  role: "CORE" | "SUPPORTING" | "INCIDENTAL";
  reason: "review" | "new" | "reinforce";
}

export const planService = {
  /**
   * Today's plan, built if it does not exist.
   *
   * Idempotent by construction: the unique index on `(learnerId, date)` decides,
   * not a check-then-insert. Two requests arriving together — which happens
   * routinely, because the dashboard and the practice screen both ask on load —
   * produce one plan and both callers get it.
   */
  async getOrCreateToday(learner: Learner & { profile: LearnerProfile | null }) {
    const date = localDate(learner.profile?.timezone ?? "Africa/Addis_Ababa");

    const existing = await this.findByDate(learner.id, date);
    if (existing) return existing;

    try {
      return await this.build(learner, date);
    } catch (error) {
      // Lost the race to a concurrent build. Theirs is as good as ours.
      if (isUniqueViolation(error)) {
        const winner = await this.findByDate(learner.id, date);
        if (winner) return winner;
      }
      throw error;
    }
  },

  async findByDate(learnerId: string, date: Date) {
    return prisma.dayPlan.findUnique({
      where: { learnerId_date: { learnerId, date } },
      include: {
        domain: { select: { id: true, name: true, description: true } },
        sessions: {
          orderBy: { orderIndex: "asc" },
          include: {
            targets: {
              include: { competency: { select: { id: true, name: true, skill: true } } },
            },
          },
        },
      },
    });
  },

  /**
   * Assemble a plan.
   *
   * One transaction, because a plan with some of its sessions written is worse
   * than no plan: the learner sees a short day and the unique index then
   * prevents it ever being completed.
   */
  async build(learner: Learner & { profile: LearnerProfile | null }, date: Date) {
    const profile = learner.profile;
    const domain = await this.pickDomain(profile?.lifePathId ?? null, profile?.cefr ?? "A2");

    if (!domain) {
      // The curriculum has not been seeded. A clear operational error beats an
      // empty plan that looks like the learner has finished everything.
      throw AppError.internal("No curriculum is available for this learner's level.", {
        context: { cefr: profile?.cefr, lifePathId: profile?.lifePathId },
      });
    }

    const theme = await this.pickTheme(profile?.lifePathId ?? null);
    const candidates = await this.loadCandidates(learner.id, domain.id);

    const count = exerciseCount(profile?.dailyMinutes ?? 15);
    const chosen = selectTargets(candidates, {
      limit: count * 2,
      now: new Date(),
      // At most half the day on any one skill, so all four dimensions keep
      // receiving evidence.
      maxPerSkill: Math.max(1, Math.ceil(count / 2)),
    });

    if (chosen.length === 0) {
      throw AppError.internal("Nothing to practise; the curriculum may be incomplete.", {
        context: { domainId: domain.id, candidates: candidates.length },
      });
    }

    return transaction(async (tx) => {
      const plan = await tx.dayPlan.create({
        data: { learnerId: learner.id, date, domainId: domain.id, theme },
      });

      const groups = groupIntoExercises(chosen, count);

      for (const [index, group] of groups.entries()) {
        await this.createSession(tx, {
          dayPlanId: plan.id,
          orderIndex: index,
          targets: group,
          theme,
          cefr: profile?.cefr ?? "A2",
        });
      }

      const built = await tx.dayPlan.findUnique({
        where: { id: plan.id },
        include: {
          domain: { select: { id: true, name: true, description: true } },
          sessions: {
            orderBy: { orderIndex: "asc" },
            include: {
              targets: {
                include: { competency: { select: { id: true, name: true, skill: true } } },
              },
            },
          },
        },
      });

      log().info(
        { planId: plan.id, sessions: groups.length, domainId: domain.id },
        "built day plan",
      );

      return built!;
    });
  },

  /** The highest-priority domain for the learner's path at their level. */
  async pickDomain(lifePathId: string | null, cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2") {
    if (lifePathId) {
      const link = await prisma.lifePathDomain.findFirst({
        where: { lifePathId, domain: { cefr } },
        orderBy: { priority: "asc" },
        include: { domain: true },
      });
      if (link) return link.domain;
    }

    // No path chosen, or the path has nothing at this level. Any domain at the
    // right level still teaches the right thing — the path only skins it.
    return prisma.domain.findFirst({ where: { cefr }, orderBy: { id: "asc" } });
  },

  async pickTheme(lifePathId: string | null): Promise<string> {
    if (!lifePathId) return "everyday";
    const path = await prisma.lifePath.findUnique({
      where: { id: lifePathId },
      select: { theme: true },
    });
    return path?.theme ?? "everyday";
  },

  /**
   * Everything the learner could practise in this domain, with their state.
   *
   * Two queries, not one per competency: the requirements with their
   * competencies joined, and the learner's states for the same set. Joining in
   * memory afterwards is cheaper than a correlated subquery and far cheaper
   * than the loop it replaces.
   */
  async loadCandidates(learnerId: string, domainId: string): Promise<Candidate[]> {
    const [requirements, states] = await Promise.all([
      prisma.domainRequirement.findMany({
        where: { domainId },
        include: {
          competency: {
            select: {
              id: true,
              skill: true,
              observable: true,
              prereqs: { select: { requiresId: true } },
            },
          },
        },
      }),
      prisma.learnerCompetency.findMany({ where: { learnerId } }),
    ]);

    const stateOf = new Map(states.map((state) => [state.competencyId, state]));
    const masteryOf = (id: string) => stateOf.get(id)?.mastery ?? 0;

    const prereqs = new Map<string, string[]>(
      requirements.map((requirement) => [
        requirement.competencyId,
        requirement.competency.prereqs.map((prereq) => prereq.requiresId),
      ]),
    );

    return requirements
      // Unobservable competencies are excluded from the profile, so practising
      // them produces evidence that goes nowhere.
      .filter((requirement) => requirement.competency.observable)
      .map((requirement) => {
        const state = stateOf.get(requirement.competencyId);

        return {
          competencyId: requirement.competencyId,
          skill: requirement.competency.skill,
          mastery: state?.mastery ?? 0,
          stabilityDays: state?.stabilityDays ?? 1,
          lastSeenAt: state?.lastSeenAt ?? null,
          evidenceCount: state?.evidenceCount ?? 0,
          weight: requirement.weight,
          isCore: requirement.role === "CORE",
          blockedBy: unmetPrerequisites(requirement.competencyId, prereqs, masteryOf),
        } satisfies Candidate;
      });
  },

  /**
   * One exercise: a template that can elicit the targets, and a stimulus for it.
   */
  async createSession(
    tx: Tx,
    input: {
      dayPlanId: string;
      orderIndex: number;
      targets: ScoredCandidate[];
      theme: string;
      cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
    },
  ) {
    const ids = input.targets.map((target) => target.competencyId);

    // Templates that can elicit any of these targets, with their strengths.
    //
    // Queried from the join table rather than filtered on the template's CEFR
    // range in SQL, because `Cefr` is a Postgres enum and an enum has no order
    // Prisma can express — `lte` on it is a type error, and comparing the
    // string labels would put A10 before A2 the moment the scale grows. The
    // range check happens below against an explicit rank, which is the only
    // place the ordering of the scale is written down.
    const links = await tx.templateElicits.findMany({
      where: { competencyId: { in: ids } },
      include: { template: true },
    });

    const rank = CEFR_RANK[input.cefr];

    const coverage = new Map<string, { template: (typeof links)[number]["template"]; score: number }>();

    for (const link of links) {
      if (CEFR_RANK[link.template.cefrMin] > rank) continue;
      if (CEFR_RANK[link.template.cefrMax] < rank) continue;

      const entry = coverage.get(link.templateId);
      if (entry) entry.score += link.strength;
      else coverage.set(link.templateId, { template: link.template, score: link.strength });
    }

    // Most coverage wins; the ID breaks ties so the same inputs always produce
    // the same plan.
    const template = [...coverage.values()].sort(
      (a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id),
    )[0]?.template;

    if (!template) {
      throw AppError.internal("No template can elicit these competencies.", {
        context: { competencyIds: ids, cefr: input.cefr },
      });
    }

    const stimulus = await findStimulus(tx, template.id, ids, input.theme);

    const session = await tx.session.create({
      data: {
        dayPlanId: input.dayPlanId,
        templateId: template.id,
        stimulusId: stimulus?.id ?? null,
        orderIndex: input.orderIndex,
        prompt: stimulus?.prompt ?? defaultPrompt(template.family, input.theme),
        // Copied, not referenced. Evicting a pool entry must not retroactively
        // change what a completed session showed.
        spec: (stimulus?.spec ?? { kind: "topic", topic: input.theme }) as never,
        targets: {
          create: input.targets.map((target, index) => ({
            competencyId: target.competencyId,
            role: index === 0 ? "CORE" : "SUPPORTING",
            priority: index,
          })),
        },
      },
    });

    return session;
  },

  /** Mark a plan finished once every session in it is. */
  async completeIfFinished(dayPlanId: string): Promise<void> {
    const remaining = await prisma.session.count({
      where: { dayPlanId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });
    if (remaining > 0) return;

    await prisma.dayPlan.update({
      where: { id: dayPlanId },
      data: { completedAt: new Date() },
    });
  },
};

/**
 * The CEFR scale, as an order.
 *
 * The one place the levels are ranked. Postgres enums have no ordering Prisma
 * can query on, and comparing the labels as strings is a bug waiting for the
 * scale to grow past nine levels.
 */
const CEFR_RANK: Record<"A1" | "A2" | "B1" | "B2" | "C1" | "C2", number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

/**
 * Find a pre-generated stimulus, degrading the key rather than the experience.
 *
 * Section 12 of the session engine doc. Three steps: the exact key, then the
 * same targets under a generic theme, then anything this template can use.
 * Returning null is the fourth step, and the caller falls back to a text
 * prompt that needs no asset at all. The learner never waits, and the worst
 * case is a slightly less tailored setting rather than a spinner.
 */
async function findStimulus(
  tx: Tx,
  templateId: string,
  competencyIds: readonly string[],
  theme: string,
) {
  // Sorted, so the key does not depend on the order targets were selected in.
  const targetSetKey = [...competencyIds].sort().join(",");

  const exact = await tx.stimulusPool.findFirst({
    where: { templateId, targetSetKey, theme },
    orderBy: { createdAt: "desc" },
  });
  if (exact) return withPrompt(exact);

  const generic = await tx.stimulusPool.findFirst({
    where: { templateId, targetSetKey, theme: "generic" },
    orderBy: { createdAt: "desc" },
  });
  if (generic) return withPrompt(generic);

  const anyForTemplate = await tx.stimulusPool.findFirst({
    where: { templateId, theme },
    orderBy: { createdAt: "desc" },
  });
  return anyForTemplate ? withPrompt(anyForTemplate) : null;
}

function withPrompt(row: { id: string; spec: unknown }) {
  const spec = row.spec as { prompt?: string };
  return { id: row.id, spec: row.spec, prompt: spec.prompt };
}

/**
 * Group chosen competencies into exercises.
 *
 * The highest-scoring target leads each exercise and gets `CORE`; the rest ride
 * along as supporting evidence. Interleaving rather than filling exercise one
 * before exercise two means the day opens with the most valuable target rather
 * than burying it fourth.
 */
function groupIntoExercises(
  chosen: readonly ScoredCandidate[],
  exercises: number,
): ScoredCandidate[][] {
  const groups: ScoredCandidate[][] = Array.from({ length: exercises }, () => []);

  chosen.forEach((candidate, index) => {
    groups[index % exercises]!.push(candidate);
  });

  return groups.filter((group) => group.length > 0);
}

function defaultPrompt(family: string, theme: string): string {
  return `Let's practise ${family.toLowerCase().replace(/_/g, " ")} in a ${theme.replace(/_/g, " ")} setting.`;
}

/**
 * The learner's local date, as a UTC-midnight `Date` for a `@db.Date` column.
 *
 * "Today" is a fact about where the learner is, not where the server is. A
 * learner in Addis starting at 9am local is on day N; computing that from the
 * server's clock in UTC puts them on day N−1 for the first three hours of every
 * morning, which silently breaks streaks and creates two plans for one day.
 */
export function localDate(timezone: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${parts}T00:00:00.000Z`);
}
