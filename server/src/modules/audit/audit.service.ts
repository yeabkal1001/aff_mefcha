import { createHash } from "node:crypto";

import { getContext, log } from "../../core/request-context.js";
import { prisma } from "../../infra/db/prisma.js";

/**
 * The audit trail.
 *
 * Scoped deliberately narrowly: things a human would need reconstructed during
 * an incident or a dispute. Profile changes, role changes, deletions. Not a
 * second copy of the request log — an audit table that records everything is
 * one nobody reads, and it becomes the largest table in the database within a
 * month.
 */

export interface AuditInput {
  learnerId?: string;
  /** Past tense, dotted: `learner.profile.updated`. */
  action: string;
  entity: string;
  entityId?: string;
  /** Who acted, when it differs from the subject — support acting on a learner. */
  actorId?: string;
  changes?: Record<string, unknown>;
  /** Raw address. Hashed before it is stored. */
  ip?: string;
}

/**
 * Write an audit row.
 *
 * Never throws. An audit write failing must not fail the operation it is
 * describing — the alternative is that a full disk on the audit table takes
 * down profile edits. It is logged at `error` instead, which is what an alert
 * should be watching.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        learnerId: input.learnerId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        changes: (input.changes ?? undefined) as never,
        requestId: getContext()?.requestId ?? null,
        // Hashed, not stored. The audit trail needs to answer "was this the
        // same origin as that" and never "where does this learner live"; a
        // hash answers the first and not the second.
        ipHash: input.ip
          ? createHash("sha256").update(input.ip).digest("base64url").slice(0, 22)
          : null,
      },
    });
  } catch (error) {
    log().error({ err: error, action: input.action }, "audit write failed");
  }
}
