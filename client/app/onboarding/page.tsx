"use client";

import { useRouter } from "next/navigation";

import { StepAge } from "@/components/onboarding/steps/step-age";
import { StepAssessment } from "@/components/onboarding/steps/step-assessment";
import { StepFeedback } from "@/components/onboarding/steps/step-feedback";
import { StepField } from "@/components/onboarding/steps/step-field";
import { StepGender } from "@/components/onboarding/steps/step-gender";
import { StepGoal } from "@/components/onboarding/steps/step-goal";
import { StepLanguage } from "@/components/onboarding/steps/step-language";
import { StepMic } from "@/components/onboarding/steps/step-mic";
import { StepName } from "@/components/onboarding/steps/step-name";
import { StepPath } from "@/components/onboarding/steps/step-path";
import { StepProfile } from "@/components/onboarding/steps/step-profile";
import { StepTime } from "@/components/onboarding/steps/step-time";
import type { StepProps } from "@/components/onboarding/steps/types";
import { useOnboardingStep } from "@/hooks/use-onboarding-draft";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding";
import { stepStore } from "@/lib/onboarding-draft";

/**
 * Typed as a total map over the step names, so adding a step to
 * `ONBOARDING_STEPS` without writing its screen is a compile error rather than
 * a blank page in front of a learner.
 */
const SCREENS: Record<OnboardingStep, (props: StepProps) => React.ReactElement> = {
  name: StepName,
  age: StepAge,
  gender: StepGender,
  language: StepLanguage,
  path: StepPath,
  field: StepField,
  time: StepTime,
  feedback: StepFeedback,
  goal: StepGoal,
  mic: StepMic,
  assessment: StepAssessment,
  profile: StepProfile,
};

/**
 * The onboarding flow, ordered by ONBOARDING_STEPS.
 *
 * One route rather than one route per step: the whole thing is a single
 * conversation, transitions animate between steps, and back never loses an
 * answer because every answer is already in the draft store.
 *
 * The place in the flow is stored alongside the answers rather than in React
 * state. Persisting the answers but not the position meant a learner who
 * closed the tab came back to the name screen with a full draft, retyped
 * nothing, and pressed Continue eleven times to reach where they had been.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const step = useOnboardingStep();

  const index = ONBOARDING_STEPS.indexOf(step);
  const Screen = SCREENS[step];

  const goTo = (target: number) => stepStore.set(ONBOARDING_STEPS[target]);

  const next = () => {
    if (index < ONBOARDING_STEPS.length - 1) {
      goTo(index + 1);
      return;
    }
    // The reveal, then the account, then the first Day Plan.
    //
    // The account cannot come later than this. Everything past here reads and
    // writes a learner on the server, and the server authenticates every
    // request — so sending someone straight to /practice would bounce them to
    // sign-in having just been shown a profile, which reads as the answers
    // having been thrown away.
    router.push("/save-progress");
  };

  return (
    <Screen
      index={index}
      count={ONBOARDING_STEPS.length}
      onNext={next}
      onBack={index > 0 ? () => goTo(index - 1) : undefined}
    />
  );
}
