import { z } from "zod";

import { createLocalStore } from "./local-store";
import {
  ONBOARDING_STEPS,
  ageBands,
  dailyBudgets,
  emptyDraft,
  genders,
  goalHorizons,
  lifePaths,
  nativeLanguages,
  type OnboardingDraft,
  type OnboardingStep,
} from "./onboarding";

/**
 * The draft profile and the place in the flow, both on the device.
 *
 * Sign-up happens after the first Day Plan, so everything the learner tells us
 * has to survive a closed tab until then.
 *
 * Storage is attacker-writable and outlives deploys, so nothing is trusted:
 * the stored blob is parsed against a schema built from the same option lists
 * the screens render, and anything unrecognised is dropped rather than spread
 * into the draft. Before this, `{...emptyDraft, ...JSON.parse(stored)}` would
 * happily give you `lifePath: "banana"` and a crash six screens later.
 */

/**
 * Enum helper: the ids a list of options actually offers.
 *
 * The return type is narrowed to the option's own id type rather than
 * `string`, so `genders` yields `Gender` and the schema keeps proving it
 * matches `OnboardingDraft` instead of widening it away.
 */
function idsOf<T extends { id: string }>(
  options: readonly T[],
): [T["id"], ...T["id"][]] {
  return options.map((option) => option.id) as [T["id"], ...T["id"][]];
}

export const onboardingDraftSchema = z.object({
  name: z.string().max(80),
  ageBand: z.enum(idsOf(ageBands)).nullable(),
  gender: z.enum(idsOf(genders)).nullable(),
  l1: z.enum(idsOf(nativeLanguages)).nullable(),
  lifePath: z.enum(idsOf(lifePaths)).nullable(),
  studyField: z.string().max(200),
  dailyMinutes: z
    .number()
    .refine((minutes) => dailyBudgets.some((b) => b.minutes === minutes))
    .nullable(),
  feedbackLanguage: z.enum(["english", "both"]).nullable(),
  goalHorizon: z.enum(idsOf(goalHorizons)).nullable(),
  assessmentComplete: z.boolean(),
  cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable(),
}) satisfies z.ZodType<OnboardingDraft, z.ZodTypeDef, unknown>;

/** Paths with an authored overlay. The rest are shown but cannot be chosen. */
const LIVE_PATHS = new Set(
  lifePaths.filter((path) => path.live).map((path) => path.id),
);

export const draftStore = createLocalStore<OnboardingDraft>(
  "coach.onboarding.draft",
  emptyDraft,
  (raw) => {
    const parsed = onboardingDraftSchema.safeParse(raw);
    if (!parsed.success) return null;

    const draft = parsed.data;

    // A path the learner could not have picked today. The screen disables the
    // planned ones, but a draft written before a path was retired would
    // otherwise sail past `canAdvance` and silently fall back to Everyday
    // English three screens later.
    if (draft.lifePath && !LIVE_PATHS.has(draft.lifePath)) {
      return { ...draft, lifePath: null, studyField: "" };
    }

    return draft;
  },
);

export function updateDraft(patch: Partial<OnboardingDraft>) {
  draftStore.set((previous) => ({ ...previous, ...patch }));
}

export function resetDraft() {
  draftStore.reset();
  stepStore.reset();
}

/**
 * Where the learner got to.
 *
 * Stored by name rather than by index, so inserting a step into the flow moves
 * a resuming learner to the right screen instead of to whatever now sits at
 * position four.
 */
export const stepStore = createLocalStore<OnboardingStep>(
  "coach.onboarding.step",
  ONBOARDING_STEPS[0],
  (raw) =>
    typeof raw === "string" &&
    (ONBOARDING_STEPS as readonly string[]).includes(raw)
      ? (raw as OnboardingStep)
      : null,
);
