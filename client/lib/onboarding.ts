/**
 * Onboarding inputs.
 *
 * Every field here is a column on `learner_profile` and an input to
 * `buildDayPlan`. If something would not change a generated session, it does
 * not belong in this file — see docs/product/onboarding.md.
 *
 * Note what is absent: there is no English level. Level is measured from the
 * assessment, never declared.
 */
import {
  Briefcase,
  Code2,
  ConciergeBell,
  GraduationCap,
  MessagesSquare,
  PenLine,
  Plane,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export type LifePathId =
  | "general_english"
  | "university_success"
  | "hospitality"
  | "custom"
  | "job_interview"
  | "study_abroad"
  | "software_engineering"
  | "healthcare";

export interface LifePath {
  id: LifePathId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  /**
   * Configured paths have an overlay behind them; planned ones do not.
   *
   * "Behind them" now means a row in the server's `life_path` table —
   * `learner_profile.life_path_id` is a foreign key, so onboarding fails
   * outright for a path the server has never heard of. The seeded set is in
   * `server/app/seed/paths.py`; keep this flag in step with it.
   */
  live: boolean;
  /**
   * The three Profile Dimensions this path supplies on top of the five fixed,
   * making the dashboard's fixed eight slots. Every member has to be reachable
   * at the learner's band, which is why these are built from the A2 fluency
   * competencies. See docs/adr/0006-*.md.
   *
   * For a live path these must name the same bundles the server seeds in
   * `server/app/seed/paths.py`, because that is what the reveal screen will
   * actually draw.
   */
  dimensions: string[];
  /** Step 5 is conditioned on the chosen path. */
  fieldQuestion: string;
  fieldHint: string;
  fieldSuggestions: string[];
  /**
   * Day 1's mission title — the path's context substitution applied to the
   * first domain. `A2-D01` is one universal domain; this is the room the
   * learner practises it in.
   */
  firstMission: string;
  /** Shown as the sensible starting point when nothing else fits. */
  isDefault?: boolean;
  /**
   * The learner writes their own goal instead of picking a field. There is no
   * authored overlay behind it — see the note in docs/product/onboarding.md.
   */
  isCustom?: boolean;
}

export const lifePaths: LifePath[] = [
  {
    id: "general_english",
    name: "Everyday English",
    tagline: "Conversations, plans, opinions — the English an ordinary week needs.",
    icon: MessagesSquare,
    live: false,
    dimensions: ["Everyday Conversation", "Telling Your Story"],
    fieldQuestion: "What do you talk about most?",
    fieldHint: "Your coach will build conversations around it.",
    fieldSuggestions: ["Work", "Family and friends", "Travel", "News", "Football"],
    firstMission: "Introducing yourself to someone new",
  },
  {
    id: "university_success",
    name: "University Success",
    tagline: "Presentations, seminars, group projects, talking to professors.",
    icon: GraduationCap,
    live: true,
    isDefault: true,
    dimensions: ["Presentation", "Academic Discussion", "Classroom Interaction"],
    fieldQuestion: "What are you studying?",
    fieldHint: "Your coach will use your subject in every conversation.",
    fieldSuggestions: [
      "Software Engineering",
      "Medicine",
      "Business",
      "Civil Engineering",
      "Law",
    ],
    firstMission: "Introducing yourself to a university class",
  },
  {
    id: "hospitality",
    name: "Hospitality & Tourism",
    tagline: "Guests, reservations, complaints, and the interview to get there.",
    icon: ConciergeBell,
    live: true,
    dimensions: ["Guest Interaction", "Complaint Handling", "Interview Readiness"],
    fieldQuestion: "What role are you aiming for?",
    fieldHint: "Your coach will rehearse the conversations that role needs.",
    fieldSuggestions: [
      "Front Desk Agent",
      "Concierge",
      "Restaurant Server",
      "Tour Guide",
      "Hotel Manager",
    ],
    firstMission: "Welcoming a guest at the front desk",
  },
  {
    id: "custom",
    name: "Something else",
    tagline: "Tell your coach what you are preparing for, in your own words.",
    icon: PenLine,
    live: false,
    isCustom: true,
    dimensions: ["Everyday Conversation", "Telling Your Story"],
    fieldQuestion: "What are you preparing for?",
    fieldHint:
      "A sentence is enough. Your coach builds the scenes from what you write.",
    fieldSuggestions: [],
    firstMission: "Talking about what you are working towards",
  },
  {
    id: "job_interview",
    name: "Job Interview Success",
    tagline: "Introductions, behavioural questions, salary conversations.",
    icon: Briefcase,
    live: false,
    dimensions: ["Interview Readiness", "Telling Your Story"],
    fieldQuestion: "What role are you applying for?",
    fieldHint: "Your coach will rehearse that interview with you.",
    fieldSuggestions: [],
    firstMission: "Answering \u201ctell me about yourself\u201d",
  },
  {
    id: "study_abroad",
    name: "Study Abroad",
    tagline: "Visa interviews, airports, orientation week.",
    icon: Plane,
    live: false,
    dimensions: ["Visa Interview", "Travel Navigation"],
    fieldQuestion: "Where are you heading?",
    fieldHint: "Your coach will prepare you for that journey.",
    fieldSuggestions: [],
    firstMission: "Explaining your plans at a visa interview",
  },
  {
    id: "software_engineering",
    name: "Software Engineering",
    tagline: "Stand-ups, code reviews, explaining what you built.",
    icon: Code2,
    live: false,
    dimensions: ["Technical Explanation", "Stand-up Fluency"],
    fieldQuestion: "What do you work on?",
    fieldHint: "Your coach will use your stack in every scenario.",
    fieldSuggestions: [],
    firstMission: "Giving your update in a stand-up",
  },
  {
    id: "healthcare",
    name: "Healthcare",
    tagline: "Patients, colleagues, explaining procedures clearly.",
    icon: Stethoscope,
    live: false,
    dimensions: ["Patient Communication", "Procedure Explanation"],
    fieldQuestion: "What is your speciality?",
    fieldHint: "Your coach will use it to build realistic cases.",
    fieldSuggestions: [],
    firstMission: "Taking a patient's history",
  },
];

export function lifePathById(id: LifePathId | null): LifePath | null {
  return lifePaths.find((path) => path.id === id) ?? null;
}

export interface NativeLanguage {
  id: string;
  name: string;
  /** Shown natively so the learner recognises it instantly. */
  endonym: string;
  /**
   * Pronunciation contrasts this L1 makes hard. Feeds `l1_risk`, which is 10%
   * of competency priority. Empty means we have no interference data yet.
   */
  interference: string[];
}

export const nativeLanguages: NativeLanguage[] = [
  {
    id: "am",
    name: "Amharic",
    endonym: "አማርኛ",
    interference: ["/p/ vs /b/", "/v/ vs /b/", "consonant clusters", "/θ/ and /ð/"],
  },
  {
    id: "om",
    name: "Afaan Oromo",
    endonym: "Afaan Oromoo",
    interference: ["/p/ vs /f/", "vowel length", "/θ/ and /ð/"],
  },
  {
    id: "ti",
    name: "Tigrinya",
    endonym: "ትግርኛ",
    interference: ["/p/ vs /b/", "consonant clusters", "/θ/ and /ð/"],
  },
  {
    id: "so",
    name: "Somali",
    endonym: "Soomaali",
    interference: ["/p/ vs /b/", "/v/ vs /f/", "vowel length"],
  },
  {
    id: "other",
    name: "Another language",
    endonym: "",
    interference: [],
  },
];

export function nativeLanguageById(id: string): NativeLanguage | null {
  return nativeLanguages.find((language) => language.id === id) ?? null;
}

export interface DailyBudget {
  minutes: number;
  label: string;
  detail: string;
}

/** Mirrors the LOAD_TABLE rows in session-engine.md §9. */
export const dailyBudgets: DailyBudget[] = [
  { minutes: 10, label: "10 min", detail: "Two short activities" },
  { minutes: 20, label: "20 min", detail: "Four activities — the usual pace" },
  { minutes: 30, label: "30 min", detail: "Five activities, more review" },
  { minutes: 45, label: "45 min", detail: "Six activities, for a deadline" },
];

/**
 * Amharic-only was removed deliberately. A correction given entirely in the
 * learner's own language never hands them the English sentence to repeat, and
 * the retry is the step the whole immediate-feedback loop rests on.
 */
export type FeedbackLanguage = "english" | "both";

export interface AgeBand {
  id: string;
  label: string;
  /** What the band changes about the scenes the generator writes. */
  detail: string;
}

/**
 * Age is banded rather than exact because register is all it drives: a
 * fifteen-year-old and a forty-year-old should not be handed the same
 * cafeteria scene, but nothing downstream needs a birthday.
 */
export const ageBands: AgeBand[] = [
  { id: "13_17", label: "13 to 17", detail: "School and family scenes" },
  { id: "18_24", label: "18 to 24", detail: "University and first jobs" },
  { id: "25_34", label: "25 to 34", detail: "Work and professional life" },
  { id: "35_plus", label: "35 or older", detail: "Work, family and community" },
];

export type Gender = "woman" | "man" | "unspecified";

export const genders: { id: Gender; label: string }[] = [
  { id: "woman", label: "Woman" },
  { id: "man", label: "Man" },
  { id: "unspecified", label: "Prefer not to say" },
];

export interface GoalHorizon {
  id: string;
  label: string;
  detail: string;
  /** Months from today, or null for no deadline. */
  months: number | null;
}

export const goalHorizons: GoalHorizon[] = [
  { id: "weeks", label: "In a few weeks", detail: "Something is coming up", months: 1 },
  { id: "quarter", label: "One to three months", detail: "A term or a hiring round", months: 3 },
  { id: "half", label: "Three to six months", detail: "Steady preparation", months: 6 },
  { id: "open", label: "No fixed deadline", detail: "Improving for its own sake", months: null },
];

/**
 * Everything gathered before an account exists. Held on the device, then
 * replayed to the server in one call at sign-up.
 */
export interface OnboardingDraft {
  name: string;
  /** Sets scenario framing and vocabulary register. */
  ageBand: string | null;
  /** Only affects how the coach refers to the learner. */
  gender: Gender | null;
  l1: string | null;
  lifePath: LifePathId | null;
  studyField: string;
  dailyMinutes: number | null;
  feedbackLanguage: FeedbackLanguage | null;
  goalHorizon: string | null;
  /** Set once the three assessment prompts are done. */
  assessmentComplete: boolean;
  /** Measured, never asked. Written by placement. */
  cefr: string | null;
}

export const emptyDraft: OnboardingDraft = {
  name: "",
  ageBand: null,
  gender: null,
  l1: null,
  lifePath: null,
  studyField: "",
  dailyMinutes: null,
  feedbackLanguage: null,
  goalHorizon: null,
  assessmentComplete: false,
  cefr: null,
};

/** The ordered flow. `docs/product/onboarding.md` explains each one. */
export const ONBOARDING_STEPS = [
  "name",
  "age",
  "gender",
  "language",
  "path",
  "field",
  "time",
  "feedback",
  "goal",
  "mic",
  "assessment",
  "profile",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
