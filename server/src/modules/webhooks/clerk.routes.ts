import { createHmac, timingSafeEqual } from "node:crypto";

import { Router, raw } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { log } from "../../core/request-context.js";
import { recordAudit } from "../audit/audit.service.js";
import { learnerRepository } from "../learners/learner.repository.js";

/**
 * `/v1/webhooks/clerk` — identity changes from the authentication provider.
 *
 * Clerk owns email addresses and names; this table mirrors them for display and
 * support search. Without the webhook, an email changed in Clerk is stale here
 * forever, and — more seriously — an account deleted in Clerk still has all its
 * data here, which is a deletion request we have failed to honour.
 *
 * This is the one unauthenticated write endpoint in the API, so its verification
 * is the only thing standing between the internet and arbitrary account
 * mutation. It is done by hand rather than with Clerk's SDK helper so that
 * every step of it is visible and reviewable.
 */
export const clerkWebhookRouter: Router = Router();

/** Reject anything older than this, so a captured request cannot be replayed. */
const TOLERANCE_MS = 5 * 60 * 1000;

clerkWebhookRouter.post(
  "/clerk",
  // Raw, because the signature covers the exact bytes. A parsed-and-restringified
  // body differs from what was signed — key order, whitespace, unicode escapes —
  // and every signature check against it fails.
  raw({ type: "application/json", limit: "512kb" }),
  async (req, res, next) => {
    try {
      const secret = env.CLERK_WEBHOOK_SIGNING_SECRET;

      if (!secret) {
        // Not configured. Refuse rather than accept unverified writes — an
        // endpoint that mutates accounts without checking anything is worse
        // than one that is switched off.
        log().error("clerk webhook received but no signing secret is configured");
        throw new AppError(503, "service_unavailable", "Webhooks are not configured.");
      }

      verifySignature(req.body as Buffer, req.headers, secret);

      const event = JSON.parse((req.body as Buffer).toString("utf8")) as ClerkEvent;
      await handle(event);

      // 200 promptly, whatever happened downstream. Clerk retries on a
      // non-2xx, and retrying a delivery we already processed is pure noise.
      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Svix signature verification, which is what Clerk uses.
 *
 * Three things have to hold, and all three matter.
 *
 * The timestamp must be recent, or a request captured once can be replayed
 * forever. The signature must cover `id.timestamp.body`, not just the body, or
 * the timestamp can be edited freely and the replay window reopens. And the
 * comparison must be constant time, or the response time leaks the expected
 * signature one byte at a time.
 */
function verifySignature(
  body: Buffer,
  headers: Record<string, unknown>,
  secret: string,
): void {
  const id = header(headers, "svix-id");
  const timestamp = header(headers, "svix-timestamp");
  const signatures = header(headers, "svix-signature");

  if (!id || !timestamp || !signatures) {
    throw AppError.unauthenticated("Missing webhook signature headers.");
  }

  const sentAt = Number(timestamp) * 1000;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > TOLERANCE_MS) {
    throw AppError.unauthenticated("Webhook timestamp is outside the tolerance window.");
  }

  // The secret arrives base64 with a `whsec_` prefix.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body.toString("utf8")}`)
    .digest("base64");

  // The header carries a space-separated list of `v1,<signature>` — Svix sends
  // several during a secret rotation, and accepting any of them is what makes
  // rotation possible without dropped deliveries.
  const candidates = signatures
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((value): value is string => Boolean(value));

  const expectedBuffer = Buffer.from(expected);

  const matched = candidates.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate);
    // `timingSafeEqual` throws on a length mismatch, which would itself be a
    // timing signal. Length is not secret, so checking it first is free.
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  if (!matched) throw AppError.unauthenticated("Webhook signature did not verify.");
}

function header(headers: Record<string, unknown>, name: string): string | null {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

interface ClerkEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

async function handle(event: ClerkEvent): Promise<void> {
  const clerkUserId = event.data.id;

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const email = primaryEmail(event.data);
      if (!email) {
        log().warn({ clerkUserId }, "clerk user has no primary email; skipping");
        return;
      }

      const displayName =
        [event.data.first_name, event.data.last_name].filter(Boolean).join(" ").trim() ||
        null;

      await learnerRepository.upsertFromClerk({
        clerkUserId,
        email,
        displayName,
        imageUrl: event.data.image_url ?? null,
      });

      log().info({ clerkUserId, type: event.type }, "reconciled learner from clerk");
      return;
    }

    case "user.deleted": {
      const learner = await learnerRepository.findByClerkId(clerkUserId);
      if (!learner) return;

      // Soft first. The purge job removes it after the grace window, which is
      // what makes an accidental deletion in the Clerk dashboard recoverable.
      await learnerRepository.softDelete(learner.id);
      await recordAudit({
        learnerId: learner.id,
        action: "learner.deleted",
        entity: "learner",
        entityId: learner.id,
        actorId: "clerk-webhook",
      });

      log().info({ clerkUserId }, "learner marked deleted from clerk");
      return;
    }

    default:
      // Unknown types are acknowledged, not rejected. Clerk adds event types,
      // and a 4xx would make them retry something we will never handle.
      log().debug({ type: event.type }, "ignoring clerk event");
  }
}

function primaryEmail(data: ClerkEvent["data"]): string | null {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find((address) => address.id === data.primary_email_address_id);
  return (primary ?? addresses[0])?.email_address ?? null;
}
