import { Prisma, type Learner } from "@prisma/client";

import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import {
  judgeDelivery,
  sanitiseMetrics,
  type TurnMetrics,
} from "../../domain/scoring/delivery.js";
import {
  applyEvidence,
  dueAtFrom,
  type Evidence,
  type MasteryState,
} from "../../domain/scoring/mastery.js";
import { ai, type Evaluation } from "../../infra/ai/index.js";
import { prisma, transaction, type Tx } from "../../infra/db/prisma.js";
import { curriculumRepository } from "../curriculum/curriculum.repository.js";
import { sessionService } from "../sessions/session.service.js";

/**
 * The measurement path: an utterance in, a coach reply out, evidence written.
 *
 * The ordering here is the most consequential design decision in the backend,
 * so it is worth stating plainly.
 *
 * **The reply is produced and returned before grading runs.** A learner waiting
 * for a coach to answer will tolerate about a second and a half; grading takes
 * five to fifteen. Doing both before responding would make every turn feel
 * broken. So the turn and the reply are written and returned, and grading is
 * kicked off separately.
 *
 * **Grading is not fire-and-forget.** Its result is written to the turn and its
 * attempts, and the client polls or refetches. If it fails, the turn still
 * exists with its transcript, and it can be graded again — the write is
 * idempotent on `(turnId, competencyId)`, so a re-run corrects rather than
 * duplicates.
 */

export interface SubmitTurnInput {
  sessionId: string;
  transcript: string;
  metrics: TurnMetrics;
}

export const turnService = {
  /**
   * Record what the learner said and answer them.
   *
   * Returns as soon as there is something to say. Grading continues after.
   */
  async submit(learner: Learner & { profile?: unknown }, input: SubmitTurnInput) {
    const session = await sessionService.loadOwned(input.sessionId, learner);

    if (session.status === "COMPLETED" || session.status === "ABANDONED") {
      throw AppError.invalidState("That exercise has already finished.");
    }

    const index = await sessionService.nextTurnIndex(input.sessionId);
    const metrics = sanitiseMetrics(input.metrics);

    const profile = await prisma.learnerProfile.findUnique({
      where: { learnerId: learner.id },
    });

    const history = await sessionService.recentTurns(input.sessionId);

    // The director is wrapped in a fallback, so this does not throw on a
    // provider outage — it returns a plainer line. The learner keeps talking.
    const reply = await ai.director.reply({
      prompt: session.prompt,
      theme: session.dayPlan.theme,
      targets: session.targets.map((target) => ({
        id: target.competencyId,
        name: target.competency.name,
        successCriteria: target.competency.successCriteria,
        cues: target.competency.elicitationCues,
      })),
      learner: {
        displayName: learner.displayName,
        cefr: profile?.cefr ?? "A2",
        l1: profile?.l1 ?? "am",
        studyField: profile?.studyField ?? null,
      },
      history,
      utterance: input.transcript,
    });

    let turn;
    try {
      turn = await prisma.turn.create({
        data: {
          sessionId: input.sessionId,
          index,
          transcriptVerbatim: input.transcript,
          metrics: metrics as unknown as Prisma.InputJsonValue,
          coachReply: reply.line,
        },
      });
    } catch (error) {
      // Two turns raced for the same index. The unique constraint caught it,
      // which is exactly its job; retrying with a fresh index would create the
      // duplicate turn the constraint just prevented.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw AppError.conflict("That turn was already recorded.");
      }
      throw error;
    }

    if (session.status === "PENDING") {
      await prisma.session.update({
        where: { id: input.sessionId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }

    return {
      turnId: turn.id,
      index: turn.index,
      coachReply: reply.line,
      suggestsComplete: reply.suggestsComplete,
    };
  },

  /**
   * Grade a turn: transcript to attempts to mastery.
   *
   * Safe to call more than once. Every write is an upsert keyed on something
   * stable, so a re-run after a provider failure corrects the record instead of
   * doubling it — which is what makes "retry the grading" a safe operation
   * rather than a data-corruption risk.
   */
  async evaluate(turnId: string, learner: Learner) {
    const turn = await prisma.turn.findUnique({
      where: { id: turnId },
      include: {
        session: {
          include: {
            dayPlan: { select: { learnerId: true, theme: true } },
            targets: { include: { competency: true } },
          },
        },
      },
    });

    if (!turn) throw AppError.notFound("That turn");
    if (turn.session.dayPlan.learnerId !== learner.id) throw AppError.forbidden();

    const profile = await prisma.learnerProfile.findUnique({
      where: { learnerId: learner.id },
    });

    const targetIds = turn.session.targets.map((target) => target.competencyId);
    const competencies = await curriculumRepository.findWithErrors(targetIds);

    const evaluation = await ai.evaluator.evaluate({
      utterance: turn.transcriptVerbatim,
      prompt: turn.session.prompt,
      targets: competencies.map((competency) => ({
        id: competency.id,
        name: competency.name,
        skill: competency.skill,
        successCriteria: competency.successCriteria,
        knownErrors: competency.errors,
      })),
      learner: { cefr: profile?.cefr ?? "A2", l1: profile?.l1 ?? "am" },
      feedbackLanguage: profile?.feedbackLanguage ?? "ENGLISH",
    });

    const metrics = turn.metrics as unknown as TurnMetrics | null;

    // Delivery judgements come from arithmetic over the timings, not from the
    // model. Fluency and sentence length are exactly the numbers the persona
    // document promises, and a model asked to estimate them would guess.
    const deliveryMap = await curriculumRepository.deliveryMap();
    const delivery =
      metrics && deliveryMap ? judgeDelivery(sanitiseMetrics(metrics), deliveryMap) : [];

    await this.writeEvidence({
      learnerId: learner.id,
      turnId: turn.id,
      templateId: turn.session.templateId,
      theme: turn.session.dayPlan.theme,
      evaluation,
      delivery,
    });

    return {
      cleanedTranscript: evaluation.cleanedTranscript,
      // `said` is carried alongside each correction rather than left for the
      // client to pair up with the turn it submitted. The card highlights
      // `errorSpan` inside `said`, and the two have to be the same string —
      // if the client substituted its own local transcript, a recogniser that
      // revised a word between the partial and the final would leave the
      // highlight matching nothing and the correction pointing at air.
      corrections: evaluation.corrections.map((correction) => ({
        said: turn.transcriptVerbatim,
        errorSpan: correction.errorSpan,
        corrected: correction.corrected,
        why: correction.explanation,
        competencyId: correction.competencyId,
      })),
    };
  },

  /**
   * Write attempts and update mastery, atomically.
   *
   * `Serializable` because two turns graded concurrently would otherwise both
   * read the same prior mastery and one update would be silently lost. That is
   * a lost-update anomaly, it is invisible when it happens, and the data it
   * corrupts is the entire product.
   */
  async writeEvidence(input: {
    learnerId: string;
    turnId: string;
    templateId: string;
    theme: string;
    evaluation: Evaluation;
    delivery: { competencyId: string; opportunities: number; correct: number; errorTags: string[] }[];
  }) {
    const reliability = await curriculumRepository.reliabilityIndex();

    const judgements = [
      ...input.evaluation.judgements,
      ...input.delivery,
    ].filter((judgement) => judgement.opportunities > 0);

    await transaction(
      async (tx) => {
        await tx.turn.update({
          where: { id: input.turnId },
          data: {
            transcriptClean: input.evaluation.cleanedTranscript,
            evaluatedAt: new Date(),
          },
        });

        for (const judgement of judgements) {
          await this.applyJudgement(tx, {
            ...input,
            judgement,
            reliability,
          });
        }
      },
      { isolationLevel: "Serializable", timeoutMs: 15_000 },
    );

    log().info(
      { turnId: input.turnId, judgements: judgements.length },
      "wrote turn evidence",
    );
  },

  /** One competency judgement: the attempt row, the mastery update, the errors. */
  async applyJudgement(
    tx: Tx,
    input: {
      learnerId: string;
      turnId: string;
      templateId: string;
      theme: string;
      judgement: {
        competencyId: string;
        opportunities: number;
        correct: number;
        errorTags: string[];
      };
      reliability: ReadonlyMap<string, number>;
    },
  ) {
    const { judgement, learnerId } = input;

    const competency = await tx.competency.findUnique({
      where: { id: judgement.competencyId },
      select: { skill: true },
    });
    if (!competency) return;

    // Upsert, so re-grading corrects rather than duplicating. This is what
    // makes the whole evaluate path safe to retry.
    await tx.attempt.upsert({
      where: {
        turnId_competencyId: { turnId: input.turnId, competencyId: judgement.competencyId },
      },
      create: {
        turnId: input.turnId,
        competencyId: judgement.competencyId,
        opportunities: judgement.opportunities,
        correct: judgement.correct,
        errorTags: judgement.errorTags,
      },
      update: {
        opportunities: judgement.opportunities,
        correct: judgement.correct,
        errorTags: judgement.errorTags,
      },
    });

    const prior = await tx.learnerCompetency.findUnique({
      where: {
        learnerId_competencyId: { learnerId, competencyId: judgement.competencyId },
      },
    });

    const state: MasteryState = {
      mastery: prior?.mastery ?? 0,
      stabilityDays: prior?.stabilityDays ?? 1,
      evidenceCount: prior?.evidenceCount ?? 0,
    };

    const evidence: Evidence = {
      opportunities: judgement.opportunities,
      correct: judgement.correct,
      scaffoldLevel: 0,
      // Unknown template/skill pairing defaults to fully reliable rather than
      // to zero: a missing seed row should not silently discard all evidence.
      reliability: input.reliability.get(`${input.templateId}:${competency.skill}`) ?? 1,
      repeatedTemplate: prior?.lastTemplateId === input.templateId,
      repeatedTheme: Boolean(input.theme) && prior?.lastTheme === input.theme,
    };

    const next = applyEvidence(state, evidence);
    const now = new Date();

    await tx.learnerCompetency.upsert({
      where: {
        learnerId_competencyId: { learnerId, competencyId: judgement.competencyId },
      },
      create: {
        learnerId,
        competencyId: judgement.competencyId,
        mastery: next.mastery,
        stabilityDays: next.stabilityDays,
        evidenceCount: next.evidenceCount,
        lastSeenAt: now,
        dueAt: dueAtFrom(now, next.stabilityDays),
        lastTemplateId: input.templateId,
        lastTheme: input.theme || null,
      },
      update: {
        mastery: next.mastery,
        stabilityDays: next.stabilityDays,
        evidenceCount: next.evidenceCount,
        lastSeenAt: now,
        // Written in the same statement as its inputs, so it cannot drift.
        dueAt: dueAtFrom(now, next.stabilityDays),
        lastTemplateId: input.templateId,
        lastTheme: input.theme || null,
      },
    });

    for (const tag of judgement.errorTags.slice(0, 5)) {
      await tx.learnerError.upsert({
        where: {
          learnerId_competencyId_tag: {
            learnerId,
            competencyId: judgement.competencyId,
            tag,
          },
        },
        create: { learnerId, competencyId: judgement.competencyId, tag },
        update: { count: { increment: 1 }, lastSeenAt: now },
      });
    }
  },
};
