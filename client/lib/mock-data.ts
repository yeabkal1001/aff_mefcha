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

/** What the coach says while it has the floor, matched to each correction. */
export const coachLines: string[] = [
  "So tell me, what did you do yesterday?",
  "Nice. Now imagine you are at the counter — what would you order?",
  "Good. Ask me to change something about your drink.",
];
