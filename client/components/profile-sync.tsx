"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { api } from "@/lib/api/endpoints";
import { draftStore } from "@/lib/onboarding-draft";
import { draftToProfile } from "@/lib/onboarding-replay";
import { createLocalStore } from "@/lib/local-store";

/**
 * Replay the onboarding answers into the account, once.
 *
 * The product asks its eleven questions before there is an account to attach
 * them to — that is deliberate, and it is why the sign-up screen has something
 * worth saving on it. The consequence is this: the moment a session appears,
 * the answers sitting on the device have to become the learner's profile.
 *
 * Guarded by a stored flag rather than by "is the profile empty", because the
 * two are different questions. A learner who has since changed their daily
 * minutes in settings has a non-empty profile *and* a stale draft, and
 * replaying it would quietly undo their change.
 *
 * Failure is silent by design. This runs on the first render of the signed-in
 * app; a toast about a profile sync would be the first thing a new learner
 * sees, for something they did not ask for and can fix in settings.
 */

const syncedStore = createLocalStore<string[]>(
  "coach.profile.synced",
  [],
  (raw) =>
    Array.isArray(raw) && raw.every((entry) => typeof entry === "string")
      ? (raw as string[])
      : null,
);

export function ProfileSync() {
  const { isSignedIn, userId } = useAuth();
  const client = useQueryClient();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    // Once per mount as well as once per device: React runs effects twice in
    // development, and this one makes a network call.
    if (attempted.current === userId) return;
    attempted.current = userId;

    // Keyed by user, so signing in as somebody else on a shared device does not
    // skip their sync — and does not import the previous learner's answers.
    if (syncedStore.get().includes(userId)) return;

    const update = draftToProfile(draftStore.get());
    if (Object.keys(update).length === 0) {
      syncedStore.set((seen) => [...seen, userId]);
      return;
    }

    void api
      .updateProfile(update)
      .then(() => {
        syncedStore.set((seen) => [...seen, userId]);
        // The plan for today is built from this profile. Anything already
        // fetched was built from the defaults.
        void client.invalidateQueries();
      })
      .catch(() => {
        // Left unmarked, so the next load tries again.
      });
  }, [client, isSignedIn, userId]);

  return null;
}
