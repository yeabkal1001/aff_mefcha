"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { ONBOARDING_STEPS } from "@/lib/onboarding";

const SCREENS: Record<string, (props: StepProps) => React.ReactElement> = {
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
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const Screen = SCREENS[ONBOARDING_STEPS[step]];

  const next = () => {
    if (step < ONBOARDING_STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    // The profile reveal hands straight over to the first mission. Sign-up
    // comes after that, not here.
    router.push("/practice");
  };

  return (
    <Screen
      index={step}
      count={ONBOARDING_STEPS.length}
      onNext={next}
      onBack={step > 0 ? () => setStep(step - 1) : undefined}
    />
  );
}
