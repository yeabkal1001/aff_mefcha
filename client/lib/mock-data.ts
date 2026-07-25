/**
 * Everything the UI renders, faked.
 *
 * This is the seam. When the server is ready these shapes become the response
 * bodies and this file turns into a set of fetches — no component should need
 * to change. Keep the shapes honest for that reason.
 */

import { scenes, type StimulusSpec } from "@/components/session/stimulus";

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
  "When you describe a picture, say what is happening right now — is sitting, is pointing.";

/**
 * Cycled through as the learner speaks, so the demo shows more than one
 * correction without a backend.
 *
 * All three describe the picture in `currentSession`, and each targets a
 * sub-competency `EX001`'s own evaluation block already lists — plural nouns,
 * prepositions of place, articles. A correction that arrives out of nowhere
 * looks like a script; one that lands on the thing the learner was just asked
 * to describe looks like the engine working.
 */
export const corrections: Correction[] = [
  {
    id: "c-1",
    said: "I see two student sitting in a bench.",
    errorSpan: "two student",
    corrected: "I see two students sitting on a bench.",
    why: 'After a number, the noun takes an -s — two students. And we sit "on" a bench, not "in" it.',
  },
  {
    id: "c-2",
    said: "The man is point at the paper on the wall.",
    errorSpan: "is point",
    corrected: "The man is pointing at the paper on the wall.",
    why: 'For something happening right now, "is" is followed by the -ing form: is pointing.',
  },
  {
    id: "c-3",
    said: "Behind them there is big building with many window.",
    errorSpan: "big building with many window",
    corrected: "Behind them there is a big building with many windows.",
    why: 'Singular countable nouns need "a" — a big building. And "many" is always followed by a plural — many windows.',
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
  /** Absent for prompts the coach simply asks aloud. */
  stimulus?: StimulusSpec;
}

export const assessmentPrompts: AssessmentPrompt[] = [
  {
    template: "EX001",
    kind: "Picture description",
    instruction:
      "Look at this picture for a moment, then tell me everything you can see.",
    seconds: 70,
    stimulus: {
      kind: "image",
      scene: "campus_courtyard",
      description: scenes.campus_courtyard.description,
      instruction:
        "Look at this picture for a moment, then tell me everything you can see.",
    },
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
 * The profile as it stands after the assessment: four fixed dimensions plus
 * two from the Life Path. Every value rests on `evidence_count = 1`, so the
 * reveal screen draws it as an estimate rather than a verdict.
 *
 * There is no Confidence or Presentation dimension. Both were bundles of
 * B2–C2 competencies that an A2 learner cannot attempt, so they could never
 * move — see docs/adr/0006-confidence-and-presentation-are-not-dimensions.md.
 */
export const openingProfile: Dimension[] = [
  { id: "grammar", label: "Grammar", value: 0.62, fixed: true },
  { id: "vocabulary", label: "Vocabulary", value: 0.67, fixed: true },
  { id: "pronunciation", label: "Pronunciation", value: 0.58, fixed: true },
  { id: "fluency", label: "Fluency", value: 0.44, fixed: true },
  { id: "classroom_interaction", label: "Classroom Interaction", value: 0.41, fixed: false },
  { id: "explaining_your_work", label: "Explaining Your Work", value: 0.29, fixed: false },
];

/**
 * One activity inside today's mission.
 *
 * A Day Plan is four to six of these under a single theme — the thing the
 * learner sees as "Today's Mission". Each carries a template id and the
 * stimulus that template needs, and the screen is composed from the stimulus
 * alone: nothing in the UI branches on the template id.
 *
 * The learner never sees `EX001`. They see one scene.
 */
export interface PracticeSession {
  templateId: string;
  /** What the learner would call this activity. */
  label: string;
  stimulus: StimulusSpec;
}

/**
 * Hana's day one, on the University Success path.
 *
 * Four activities, four different templates, one theme — which is the claim
 * the demo has to support: the mission reads as a single story even though the
 * engine chose each activity independently.
 */
export const dayPlan: PracticeSession[] = [
  {
    templateId: "EX001",
    label: "Describe the scene",
    stimulus: {
      kind: "image",
      scene: "campus_courtyard",
      description: scenes.campus_courtyard.description,
      instruction: "Look at this. Tell me what is happening — as much as you can see.",
    },
  },
  {
    templateId: "EX007",
    label: "Answer questions",
    stimulus: {
      kind: "audio_question",
      question: "Who did you meet on your first day at university?",
      instruction: "Answer in a few sentences. There is no right answer here.",
    },
  },
  {
    templateId: "EX018",
    label: "Roleplay",
    stimulus: {
      kind: "scenario",
      setting: "You arrive late to a seminar you have not attended before.",
      learnerRole: "A first-year student",
      coachRole: "The lecturer, mid-sentence",
      objective: "Apologise, introduce yourself, and ask what you missed.",
      instruction: "Start whenever you are ready. I will answer as the lecturer.",
    },
  },
  {
    templateId: "EX009",
    label: "Tell a story",
    stimulus: {
      kind: "text",
      prompt: "Tell me about a day at school or university that you still remember.",
      hints: ["Where were you?", "Who was with you?", "How did it end?"],
      instruction: "Take your time. Two or three minutes is plenty.",
    },
  },
];

/** The activity the demo opens on. */
export const currentSession = dayPlan[0];

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
  { label: "Fluency", from: 0.44, to: 0.53 },
  { label: "Grammar", from: 0.62, to: 0.68 },
  { label: "Pronunciation", from: 0.58, to: 0.61 },
  { label: "Classroom Interaction", from: 0.41, to: 0.49 },
];

/** Verbatim word count over sentence count, from the word-level transcript. */
export const sentenceLengthGain = { from: 6, to: 11 };

/** What the coach says while it has the floor, matched to each correction. */
/**
 * What the coach says between turns. Each one pushes the learner back at the
 * picture from a different angle, which is how a single stimulus keeps
 * producing new opportunities for the same competencies.
 */
export const coachLines: string[] = [
  "Good. Now tell me about the person standing up — what is he doing?",
  "Nice. What can you see behind them?",
  "Last one. If you walked into that courtyard, who would you talk to first?",
];
