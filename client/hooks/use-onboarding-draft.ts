"use client";

import { useSyncExternalStore } from "react";

import { emptyDraft, type OnboardingDraft } from "@/lib/onboarding";

const STORAGE_KEY = "coach.onboarding.draft";

/**
 * The draft profile, before an account exists.
 *
 * Sign-up happens after the first mission, so everything the learner tells us
 * has to survive on the device until then — including a closed tab. This is a
 * plain external store rather than React state so that the server snapshot and
 * the restored client snapshot can legitimately differ; `useSyncExternalStore`
 * is built for exactly that and hydrates without a mismatch.
 */
let draft: OnboardingDraft = emptyDraft;
const listeners = new Set<() => void>();

// Restore once, at module load, so the first snapshot is already correct.
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) draft = { ...emptyDraft, ...JSON.parse(stored) };
  } catch {
    // Corrupt or unavailable storage is not worth failing onboarding over.
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return draft;
}

function getServerSnapshot() {
  return emptyDraft;
}

export function updateDraft(patch: Partial<OnboardingDraft>) {
  draft = { ...draft, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Private mode. The session still works, it just will not resume.
  }
  emit();
}

export function resetDraft() {
  draft = emptyDraft;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
  emit();
}

export function useOnboardingDraft(): OnboardingDraft {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
