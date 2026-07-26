"use client";

import { useLocalStore } from "@/lib/local-store";
import { draftStore, stepStore } from "@/lib/onboarding-draft";
import type { OnboardingDraft, OnboardingStep } from "@/lib/onboarding";

export { resetDraft, updateDraft } from "@/lib/onboarding-draft";

export function useOnboardingDraft(): OnboardingDraft {
  return useLocalStore(draftStore);
}

/** The step the learner is on, restored across a reload. */
export function useOnboardingStep(): OnboardingStep {
  return useLocalStore(stepStore);
}
