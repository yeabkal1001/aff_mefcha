import type { Competency, Skill, Template } from "@prisma/client";

import { prisma, type Db } from "../../infra/db/prisma.js";

/**
 * Reads over the static curriculum.
 *
 * These tables are written only by the seed and read on every plan build, which
 * makes them the obvious candidate for caching — and the reason the cache below
 * exists. It is a plain module-level map with no expiry, which is correct
 * precisely because the data cannot change without a deploy. An expiring cache
 * here would be complexity buying nothing.
 */

/** Cleared on deploy, because the process restarts. That is the whole policy. */
const cache = new Map<string, unknown>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;

  const value = await load();
  cache.set(key, value);
  return value;
}

/** Test seam, and the escape hatch if the seed is re-run against a live process. */
export function clearCurriculumCache() {
  cache.clear();
}

export interface CompetencyWithErrors extends Competency {
  errors: { wrong: string; right: string; tag: string }[];
}

export const curriculumRepository = {
  async listCompetencies(db: Db = prisma): Promise<Competency[]> {
    return cached("competencies", () => db.competency.findMany({ orderBy: { id: "asc" } }));
  },

  /**
   * Competencies with their known error patterns, for the evaluator's prompt.
   *
   * One query with the errors joined, not one query per competency. The N+1
   * version of this runs inside the grading path of every turn.
   */
  async findWithErrors(ids: readonly string[], db: Db = prisma): Promise<CompetencyWithErrors[]> {
    if (ids.length === 0) return [];

    return db.competency.findMany({
      where: { id: { in: [...ids] } },
      include: { errors: { select: { wrong: true, right: true, tag: true } } },
    });
  },

  async listTemplates(db: Db = prisma): Promise<Template[]> {
    return cached("templates", () => db.template.findMany({ orderBy: { id: "asc" } }));
  },

  /**
   * How reliably each template measures each skill.
   *
   * Loaded whole and indexed in memory: it is a few hundred rows, it is read
   * once per graded turn, and the join to fetch one row at a time would cost
   * more than holding all of them.
   */
  async reliabilityIndex(db: Db = prisma): Promise<Map<string, number>> {
    return cached("reliability", async () => {
      const rows = await db.templateMeasure.findMany();
      return new Map(rows.map((row) => [`${row.templateId}:${row.skill}`, row.reliability]));
    });
  },

  async listLifePaths(db: Db = prisma) {
    return cached("lifePaths", () =>
      db.lifePath.findMany({
        where: { isLive: true },
        include: { domains: { orderBy: { priority: "asc" } } },
      }),
    );
  },

  /** Which competency each delivery metric is evidence about. See ADR 0006. */
  async deliveryMap(db: Db = prisma) {
    return cached("deliveryMap", async () => {
      const rows = await db.competency.findMany({
        where: { id: { in: Object.values(DELIVERY_COMPETENCIES) } },
        select: { id: true },
      });

      const known = new Set(rows.map((row) => row.id));

      // If the seed has not run, the caller gets nothing rather than IDs that
      // would fail a foreign key at write time — far from the actual mistake.
      const missing = Object.values(DELIVERY_COMPETENCIES).filter((id) => !known.has(id));
      if (missing.length > 0) return null;

      return DELIVERY_COMPETENCIES;
    });
  },
};

/**
 * The delivery-metric mapping from ADR 0006, made concrete.
 *
 * Hesitation and pausing are evidence about buying thinking time; latency about
 * answering questions; sentence length about producing extended turns. All are
 * A2-reachable, all update mastery through the ordinary path, and all surface
 * inside Fluency or Sentence Structure rather than as a dimension of their own.
 */
export const DELIVERY_COMPETENCIES = {
  speechRate: "F001.05",
  pausing: "F001.06",
  hesitation: "F020.05",
  responseLatency: "F003.01",
  sentenceLength: "S002.01",
} as const;

export const SKILL_ORDER: readonly Skill[] = [
  "GRAMMAR",
  "VOCABULARY",
  "FLUENCY",
  "SENTENCE_STRUCTURE",
];
