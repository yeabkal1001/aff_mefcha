"use client";

import { useEffect, useRef, useState } from "react";

import { updateDraft, useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { ApiError, getProfile, onboard, type DimensionResponse } from "@/lib/api";
import { getLearnerId } from "@/lib/learner";
import type { OnboardingDraft } from "@/lib/onboarding";

/**
 * The Communication Profile, created and then read back.
 *
 * This is the first moment the server hears about the learner: everything up to
 * here lives in the draft on the device. One `POST /learners` writes the profile
 * and seeds the learner model, then `GET /profile` reads the dimensions back.
 *
 * The read is deliberately a second call rather than something derived from the
 * write. Profile Dimensions are computed from `learner_competency` at read time
 * and never stored, so asking the server for them is the only way to be sure the
 * reveal screen and the learner model cannot disagree.
 */

export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; cefr: string; dimensions: DimensionResponse[] }
  | { status: "error"; message: string };

/** Server-side language codes; the UI asks the question in plainer terms. */
function feedbackLanguageCode(choice: OnboardingDraft["feedbackLanguage"]): string {
  // "both" means the correction is explained in Amharic alongside the English
  // sentence to repeat. Amharic-only was removed deliberately — see lib/onboarding.ts.
  return choice === "english" ? "en" : "am";
}

export function useCommunicationProfile(): ProfileState {
  const draft = useOnboardingDraft();
  const [state, setState] = useState<ProfileState>({ status: "loading" });

  // The draft is read once, at the moment the reveal mounts. Re-running on every
  // keystroke elsewhere would re-POST a learner that already exists.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Guards the POST against React's development double-mount, which would
  // otherwise create the learner twice.
  //
  // There is deliberately no matching `cancelled` flag. Pairing this ref with
  // one is a trap: the first mount starts the work and its cleanup cancels it,
  // then the second mount returns early because the ref is already set, and the
  // response lands with nobody left to receive it. The screen sits on "loading"
  // forever with two successful requests behind it. Settling state on an
  // unmounted component is a no-op in React 18 and later, so letting the result
  // through unconditionally is both simpler and correct.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const learnerId = getLearnerId();
      const current = draftRef.current;

      try {
        // No assessment transcripts are sent: the four-minute assessment is a
        // prop, and the server seeds the opening profile at A2 instead. The
        // fake is marked at the point it happens, in
        // server/app/services/onboarding.py.
        const created = await onboard({
          learner_id: learnerId,
          display_name: current.name || null,
          life_path_id: current.lifePath ?? "university_success",
          l1: current.l1 ?? "am",
          study_field: current.studyField || null,
          daily_minutes: current.dailyMinutes ?? 20,
          feedback_language: feedbackLanguageCode(current.feedbackLanguage),
        });
        updateDraft({ cefr: created.cefr });
      } catch (error) {
        // 409 means this device already onboarded — going back and forward over
        // the reveal, or a reload. The profile below is still the right answer.
        if (!(error instanceof ApiError && error.status === 409)) {
          setState({
            status: "error",
            message:
              error instanceof ApiError
                ? error.detail
                : "could not create your profile",
          });
          return;
        }
      }

      try {
        const profile = await getProfile(learnerId);
        updateDraft({ cefr: profile.cefr });
        setState({
          status: "ready",
          cefr: profile.cefr,
          dimensions: profile.dimensions,
        });
      } catch (error) {
        setState({
          status: "error",
          message:
            error instanceof ApiError ? error.detail : "could not read your profile",
        });
      }
    })();
  }, []);

  return state;
}
