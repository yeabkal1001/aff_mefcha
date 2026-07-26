import type { StimulusSpec } from "@/components/session/stimulus/types";

/**
 * The three prompts that place a learner.
 *
 * Local, and not fetched, because placement runs before an account exists —
 * that is the whole point of the onboarding order. Asking the server for these
 * would mean either an unauthenticated endpoint serving curriculum content or
 * an account created before the learner has been given a reason to want one.
 *
 * They are real templates, rendered through the same stimulus dispatcher the
 * practice screen uses: EX001 picture description, EX010 opinion, EX007
 * narrative. The point of running real templates is that the speech collected
 * here is the same kind of speech the coach will hear tomorrow.
 *
 * Deliberately not framed as a test. Placement is a global complexity read of
 * the speech, so there is genuinely nothing to pass — see session-engine.md §9.
 */

export interface AssessmentPrompt {
  templateId: string;
  /** What kind of task this is, for the reader of a transcript. */
  kind: string;
  instruction: string;
  seconds: number;
  stimulus?: StimulusSpec;
}

export const assessmentPrompts: AssessmentPrompt[] = [
  {
    templateId: "EX001",
    kind: "Picture description",
    instruction: "Tell me what you see happening here. Take as long as you like.",
    seconds: 60,
    stimulus: {
      kind: "image",
      instruction: "Describe what is happening.",
      scene: "market_stall",
      description:
        "A woman at a market stall handing a bag of tomatoes to a customer, who is counting money.",
    },
  },
  {
    templateId: "EX010",
    kind: "Opinion",
    instruction:
      "Some people say learning online is better than learning in a classroom. What do you think, and why?",
    seconds: 90,
  },
  {
    templateId: "EX007",
    kind: "Narrative",
    instruction:
      "Tell me about a day recently that did not go the way you expected. What happened?",
    seconds: 90,
  },
];
