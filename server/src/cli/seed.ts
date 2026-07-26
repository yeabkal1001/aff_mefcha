import { existsSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  COMPETENCIES,
  DOMAINS,
  LIFE_PATHS,
  STIMULI,
  TEMPLATES,
} from "../modules/curriculum/curriculum.data.js";

// Before the client is constructed below, which is the line that reads
// DATABASE_URL. Guarded, because deployed environments have no `.env` and
// supply the variable for real.
if (existsSync(".env")) process.loadEnvFile(".env");

/**
 * Load the curriculum.
 *
 * Lives in `src/` rather than beside the schema so that `tsc` compiles it into
 * `dist/`. The deployed image has no TypeScript in it, and a seed script that
 * can only be run from a developer's laptop is not a way to publish content.
 * Run it with `pnpm db:seed` locally, `node dist/cli/seed.js` in the image.
 *
 * Idempotent throughout: every write is an upsert keyed on the curriculum's own
 * ID, so running this against a database with learners in it updates the
 * content and touches nothing else. That is the property that makes it safe to
 * run on every deploy, which is in turn what makes content a data change rather
 * than an engineering task.
 *
 * Order matters — parents before children, competencies before the templates
 * and domains that reference them — because the foreign keys are real.
 */

const prisma = new PrismaClient();

async function main() {
  console.log("seeding curriculum…");

  // Parents first: a sub-competency's `parentId` points at a row that has to
  // exist. Sorting by ID length puts `G001` before `G001.01` without needing a
  // hand-maintained order in the content file.
  const ordered = [...COMPETENCIES].sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id));

  for (const competency of ordered) {
    const data = {
      parentId: competency.parentId ?? null,
      skill: competency.skill,
      name: competency.name,
      cefrMin: competency.cefrMin,
      cefrMax: competency.cefrMax,
      observable: competency.observable ?? true,
      successCriteria: competency.successCriteria,
      elicitationCues: competency.elicitationCues,
      l1Risk: competency.l1Risk ?? undefined,
    };

    await prisma.competency.upsert({
      where: { id: competency.id },
      create: { id: competency.id, ...data },
      update: data,
    });
  }

  // Prerequisites in a second pass: an edge can point forwards as well as
  // backwards, so no single ordering of the first pass would satisfy them all.
  for (const competency of COMPETENCIES) {
    for (const requiresId of competency.prereqs ?? []) {
      await prisma.competencyPrereq.upsert({
        where: { competencyId_requiresId: { competencyId: competency.id, requiresId } },
        create: { competencyId: competency.id, requiresId },
        update: {},
      });
    }

    for (const error of competency.errors ?? []) {
      await prisma.competencyError.upsert({
        where: { competencyId_tag: { competencyId: competency.id, tag: error.tag } },
        create: { competencyId: competency.id, ...error },
        update: { wrong: error.wrong, right: error.right },
      });
    }
  }

  console.log(`  ${COMPETENCIES.length} competencies`);

  for (const template of TEMPLATES) {
    const data = {
      family: template.family,
      stimulusType: template.stimulusType,
      interactionMode: template.interactionMode,
      cefrMin: template.cefrMin,
      cefrMax: template.cefrMax,
      durationMinSec: template.durationMinSec,
      durationMaxSec: template.durationMaxSec,
      scaffoldLadder: template.scaffoldLadder,
    };

    await prisma.template.upsert({
      where: { id: template.id },
      create: { id: template.id, ...data },
      update: data,
    });

    for (const [skill, reliability] of Object.entries(template.measures)) {
      await prisma.templateMeasure.upsert({
        where: {
          templateId_skill: { templateId: template.id, skill: skill as never },
        },
        create: { templateId: template.id, skill: skill as never, reliability },
        update: { reliability },
      });
    }

    for (const [competencyId, strength] of Object.entries(template.elicits)) {
      await prisma.templateElicits.upsert({
        where: { templateId_competencyId: { templateId: template.id, competencyId } },
        create: { templateId: template.id, competencyId, strength },
        update: { strength },
      });
    }
  }

  console.log(`  ${TEMPLATES.length} templates`);

  for (const domain of DOMAINS) {
    const data = {
      cefr: domain.cefr,
      name: domain.name,
      description: domain.description,
      objectives: domain.objectives,
      contexts: domain.contexts,
    };

    await prisma.domain.upsert({
      where: { id: domain.id },
      create: { id: domain.id, ...data },
      update: data,
    });

    for (const requirement of domain.requires) {
      await prisma.domainRequirement.upsert({
        where: {
          domainId_competencyId: {
            domainId: domain.id,
            competencyId: requirement.competencyId,
          },
        },
        create: { domainId: domain.id, ...requirement },
        update: { role: requirement.role, weight: requirement.weight },
      });
    }
  }

  console.log(`  ${DOMAINS.length} domains`);

  for (const path of LIFE_PATHS) {
    const data = { name: path.name, theme: path.theme, isLive: path.isLive };

    await prisma.lifePath.upsert({
      where: { id: path.id },
      create: { id: path.id, ...data },
      update: data,
    });

    for (const link of path.domains) {
      await prisma.lifePathDomain.upsert({
        where: {
          lifePathId_domainId: { lifePathId: path.id, domainId: link.domainId },
        },
        create: { lifePathId: path.id, ...link },
        update: { priority: link.priority },
      });
    }
  }

  console.log(`  ${LIFE_PATHS.length} life paths`);

  // The stimulus pool has surrogate IDs, so it needs a natural key to be
  // idempotent on. Delete-then-insert per key is simpler than reconciling and
  // safe here: a session copies its spec at assembly time, so replacing a pool
  // row cannot change what a completed session showed.
  for (const stimulus of STIMULI) {
    await prisma.stimulusPool.deleteMany({
      where: {
        templateId: stimulus.templateId,
        targetSetKey: stimulus.targetSetKey,
        theme: stimulus.theme,
      },
    });

    await prisma.stimulusPool.create({
      data: {
        templateId: stimulus.templateId,
        targetSetKey: stimulus.targetSetKey,
        theme: stimulus.theme,
        stimulusType: stimulus.stimulusType,
        spec: stimulus.spec,
      },
    });
  }

  console.log(`  ${STIMULI.length} stimuli`);
  console.log("done.");
}

main()
  .catch((error) => {
    console.error("seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
