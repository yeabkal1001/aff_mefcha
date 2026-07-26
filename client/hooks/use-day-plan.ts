"use client";

import { useEffect, useState } from "react";

import {
  ApiError,
  getDayPlan,
  type DayPlanResponse,
  type SessionResponse,
} from "@/lib/api";
import { peekLearnerId } from "@/lib/learner";

/**
 * Today's Mission, from the scheduler.
 *
 * `GET /learners/{id}/day-plan` builds the plan or returns the one already built
 * for today, so mounting this twice does not produce two missions. The date it
 * builds against comes from the engine clock, which is what makes Day Three
 * reachable by moving the clock rather than by seeding a second plan.
 *
 * Nothing here is authored on the client: the prompt, the stimulus and the
 * targets are all the scheduler's output.
 */

export type DayPlanState =
  | { status: "loading" }
  /** No learner on this device — onboarding has not run. */
  | { status: "absent" }
  | { status: "ready"; plan: DayPlanResponse; session: SessionResponse }
  | { status: "error"; message: string };

/** The first session that has not been completed, or the last one if all are. */
function currentSession(plan: DayPlanResponse): SessionResponse | null {
  if (plan.sessions.length === 0) return null;
  return (
    plan.sessions.find((session) => session.completed_at === null) ??
    plan.sessions[plan.sessions.length - 1]
  );
}

export function useDayPlan(): DayPlanState {
  const [state, setState] = useState<DayPlanState>({ status: "loading" });

  useEffect(() => {
    const learnerId = peekLearnerId();
    if (!learnerId) {
      setState({ status: "absent" });
      return;
    }

    let cancelled = false;

    getDayPlan(learnerId)
      .then((plan) => {
        if (cancelled) return;
        const session = currentSession(plan);
        if (!session) {
          setState({ status: "error", message: "today's mission came back empty" });
          return;
        }
        setState({ status: "ready", plan, session });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof ApiError ? error.detail : "could not load today's mission",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
