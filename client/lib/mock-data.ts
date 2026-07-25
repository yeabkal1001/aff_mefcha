/**
 * Everything the UI renders, faked.
 *
 * This is the seam. When the server is ready these shapes become the response
 * bodies and this file turns into a set of fetches — no component should need
 * to change. Keep the shapes honest for that reason.
 */

/** Where the session is right now. The orb reads this to pick its gradient. */
export type SessionState = "idle" | "listening" | "thinking" | "speaking";

export interface Correction {
  id: string;
  /** What the learner actually said, verbatim. */
  said: string;
  /** The slice of `said` that was wrong, marked in red. Must appear in `said`. */
  errorSpan: string;
  /** The repaired sentence, shown in green. */
  corrected: string;
  /** One plain sentence of why, in the coach's voice. */
  why: string;
}

export interface PastSession {
  id: string;
  title: string;
  minutes: number;
  corrections: number;
}

export interface DailyProgress {
  speakingMinutes: number;
  speakingGoalMinutes: number;
  corrections: number;
  newVocabulary: number;
  streakDays: number;
}

export interface Learner {
  name: string;
  plan: string;
}

export const learner: Learner = {
  name: "Afe Mefcha",
  plan: "Personal",
};

export const coachName = "Nero";

export const lessonTopic = "Ordering Coffee at a Cafe";

export const greeting = `Hi I'm ${coachName}! I'll be your English tutor`;

export const pastSessions: PastSession[] = [
  {
    id: "s-301",
    title: "Ordering Coffee from a cafe",
    minutes: 12,
    corrections: 3,
  },
  {
    id: "s-300",
    title: "Adwa Museum History and Tour",
    minutes: 18,
    corrections: 5,
  },
  {
    id: "s-299",
    title: "Packing up for a vacation to Hawassa",
    minutes: 10,
    corrections: 2,
  },
];

export const dailyProgress: DailyProgress = {
  speakingMinutes: 18,
  speakingGoalMinutes: 30,
  corrections: 6,
  newVocabulary: 7,
  streakDays: 4,
};

export const coachTip =
  "Try to use past tense when talking about events that already happened.";

/**
 * Cycled through as the learner speaks, so the demo shows more than one
 * correction without a backend.
 */
export const corrections: Correction[] = [
  {
    id: "c-1",
    said: "Yesterday I go to the market.",
    errorSpan: "go",
    corrected: "Yesterday I went to the market.",
    why: 'For past events, we use "went" instead of "go".',
  },
  {
    id: "c-2",
    said: "I would like a coffee, please. I drink it every mornings.",
    errorSpan: "every mornings",
    corrected: "I would like a coffee, please. I drink it every morning.",
    why: '"Every" is followed by a singular noun — every morning, not every mornings.',
  },
  {
    id: "c-3",
    said: "Can you give me more milk in it? It is too much strong.",
    errorSpan: "too much strong",
    corrected: "Can you give me more milk in it? It is too strong.",
    why: 'Before an adjective use "too" on its own. "Too much" goes with nouns.',
  },
];

/**
 * The three assessment prompts, in order. Templates and what each one seeds
 * are specified in session-engine.md §9.
 */
export interface AssessmentPrompt {
  template: string;
  kind: string;
  instruction: string;
  /** Roughly four minutes of speech across all three. */
  seconds: number;
}

export const assessmentPrompts: AssessmentPrompt[] = [
  {
    template: "EX001",
    kind: "Picture description",
    instruction:
      "Look at this photo for a moment, then tell me everything you can see.",
    seconds: 70,
  },
  {
    template: "EX007",
    kind: "Personal questions",
    instruction:
      "Now two questions about you. Where did you grow up, and what do you enjoy doing on a free day?",
    seconds: 85,
  },
  {
    template: "EX009",
    kind: "Personal experience",
    instruction:
      "Last one. Tell me about a day you remember well. What happened, and how did it end?",
    seconds: 75,
  },
];

export interface Dimension {
  id: string;
  label: string;
  /** null means no attempted members yet — shown as "not yet assessed". */
  value: number | null;
  fixed: boolean;
}

/**
 * The profile as it stands after the assessment. Every value here rests on
 * `evidence_count = 1`, so the reveal screen draws it as an estimate rather
 * than a verdict. The two dimensions with no value are the honest case the
 * docs insist on: no evidence reads as "not yet assessed", never 0%.
 */
export const openingProfile: Dimension[] = [
  { id: "grammar", label: "Grammar", value: 0.62, fixed: true },
  { id: "vocabulary", label: "Vocabulary", value: 0.67, fixed: true },
  { id: "pronunciation", label: "Pronunciation", value: 0.58, fixed: true },
  { id: "fluency", label: "Fluency", value: 0.44, fixed: true },
  { id: "confidence", label: "Confidence", value: 0.39, fixed: true },
  { id: "presentation", label: "Presentation", value: 0.22, fixed: false },
  { id: "academic_discussion", label: "Academic Discussion", value: null, fixed: false },
  { id: "classroom_interaction", label: "Classroom Interaction", value: null, fixed: false },
];

export interface DimensionGain {
  label: string;
  from: number;
  to: number;
}

/**
 * What the first mission moved. This is the sign-up screen's whole argument:
 * the learner has something to lose by the time we ask for an email.
 */
export const firstSessionGains: DimensionGain[] = [
  { label: "Confidence", from: 0.39, to: 0.47 },
  { label: "Grammar", from: 0.62, to: 0.68 },
  { label: "Pronunciation", from: 0.58, to: 0.61 },
  { label: "Fluency", from: 0.44, to: 0.49 },
];

/** Verbatim word count over sentence count, from the word-level transcript. */
export const sentenceLengthGain = { from: 6, to: 11 };

/** What the coach says while it has the floor, matched to each correction. */
export const coachLines: string[] = [
  "So tell me, what did you do yesterday?",
  "Nice. Now imagine you are at the counter — what would you order?",
  "Good. Ask me to change something about your drink.",
];
