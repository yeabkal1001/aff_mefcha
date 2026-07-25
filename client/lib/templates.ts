/**
 * The eighteen exercise templates, as the client needs to know them.
 *
 * This is a deliberately thin projection of the descriptors in
 * `docs/curriculum/exercise-templates.md` and `docs/architecture/session-engine.md`
 * §5. The engine's copy carries `elicits`, `measures` and `scaffold_ladder`,
 * which decide *which* template runs and how it is scored — none of the
 * browser's business. What the browser needs is the part that decides what the
 * screen looks like: the stimulus, the interaction mode, and how long it runs.
 *
 * When the server exists this file becomes a response body. Until then it is
 * the contract that keeps the components honest, because every stimulus type
 * in the curriculum appears here whether or not the demo reaches it.
 */

/**
 * What the learner is given to work from.
 *
 * These are the `stimulus_type` values in the curriculum, normalised. Several
 * templates document alternatives — `EX014` is "Image / Audio / Text" — which
 * means the generator picks one per session, not that the screen shows three.
 * So the union below is the set of things that can be rendered, and a session
 * names exactly one.
 */
export type StimulusKind =
  | "image"
  | "image_pair"
  | "image_sequence"
  | "audio"
  | "audio_question"
  | "text"
  | "choice"
  | "statement"
  | "topic"
  | "scenario";

/** Who talks, and how the turn ends. */
export type InteractionMode = "monologue" | "dialogue" | "repetition";

export type TemplateFamily =
  | "observation_description"
  | "listening"
  | "question_answer"
  | "narrative"
  | "explanation"
  | "decision_making"
  | "discussion"
  | "professional_communication";

export interface ExerciseTemplate {
  id: string;
  name: string;
  family: TemplateFamily;
  /** The one type the generator will render for a session of this template. */
  stimulus: StimulusKind;
  /** Alternatives the curriculum allows, for templates that document more than one. */
  stimulusAlternatives?: StimulusKind[];
  mode: InteractionMode;
  cefrMin: Cefr;
  cefrMax: Cefr;
  durationMinutes: [number, number];
  /**
   * Whether the MVP can actually run this. Three templates have authored
   * descriptors — see session-engine.md §13 — and the rest are declared so the
   * component layer is built against the whole curriculum rather than against
   * the demo.
   */
  authored: boolean;
}

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export const CEFR_ORDER: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const templates: ExerciseTemplate[] = [
  // Family 1 — Observation & Description
  {
    id: "EX001",
    name: "Picture Description",
    family: "observation_description",
    stimulus: "image",
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C1",
    durationMinutes: [3, 6],
    authored: true,
  },
  {
    id: "EX002",
    name: "Compare Two Images",
    family: "observation_description",
    stimulus: "image_pair",
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C1",
    durationMinutes: [3, 6],
    authored: false,
  },
  {
    id: "EX003",
    name: "Picture Sequence Story",
    family: "observation_description",
    stimulus: "image_sequence",
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C1",
    durationMinutes: [4, 7],
    authored: false,
  },

  // Family 2 — Listening
  {
    id: "EX004",
    name: "Listen & Respond",
    family: "listening",
    stimulus: "audio",
    mode: "dialogue",
    cefrMin: "A1",
    cefrMax: "C2",
    durationMinutes: [3, 5],
    authored: false,
  },
  {
    id: "EX005",
    name: "Listen & Summarize",
    family: "listening",
    stimulus: "audio",
    mode: "monologue",
    cefrMin: "B1",
    cefrMax: "C2",
    durationMinutes: [4, 7],
    authored: false,
  },
  {
    id: "EX006",
    name: "Shadowing",
    family: "listening",
    stimulus: "audio",
    mode: "repetition",
    cefrMin: "A1",
    cefrMax: "C2",
    durationMinutes: [3, 5],
    authored: false,
  },

  // Family 3 — Question & Answer
  {
    id: "EX007",
    name: "Personal Questions",
    family: "question_answer",
    stimulus: "audio_question",
    stimulusAlternatives: ["text"],
    mode: "dialogue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [3, 5],
    authored: true,
  },
  {
    id: "EX008",
    name: "Open-ended Question",
    family: "question_answer",
    stimulus: "audio_question",
    stimulusAlternatives: ["text"],
    mode: "dialogue",
    cefrMin: "B1",
    cefrMax: "C2",
    durationMinutes: [4, 6],
    authored: false,
  },

  // Family 4 — Narrative
  {
    id: "EX009",
    name: "Personal Experience",
    family: "narrative",
    stimulus: "text",
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [4, 7],
    authored: false,
  },
  {
    id: "EX010",
    name: "Continue the Story",
    family: "narrative",
    stimulus: "audio_question",
    stimulusAlternatives: ["text"],
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [4, 7],
    authored: false,
  },

  // Family 5 — Explanation
  {
    id: "EX011",
    name: "Explain a Process",
    family: "explanation",
    stimulus: "image_sequence",
    stimulusAlternatives: ["text"],
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [4, 7],
    authored: false,
  },
  {
    id: "EX012",
    name: "Teach Someone",
    family: "explanation",
    stimulus: "text",
    mode: "monologue",
    cefrMin: "B1",
    cefrMax: "C2",
    durationMinutes: [5, 8],
    authored: false,
  },

  // Family 6 — Decision Making
  {
    id: "EX013",
    name: "Choose the Best Option",
    family: "decision_making",
    stimulus: "choice",
    mode: "monologue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [3, 6],
    authored: false,
  },
  {
    id: "EX014",
    name: "Solve a Problem",
    family: "decision_making",
    stimulus: "scenario",
    stimulusAlternatives: ["image", "audio"],
    mode: "dialogue",
    cefrMin: "B1",
    cefrMax: "C2",
    durationMinutes: [5, 8],
    authored: false,
  },

  // Family 7 — Discussion
  {
    id: "EX015",
    name: "Opinion Discussion",
    family: "discussion",
    stimulus: "statement",
    stimulusAlternatives: ["image"],
    mode: "dialogue",
    cefrMin: "B1",
    cefrMax: "C2",
    durationMinutes: [5, 8],
    authored: false,
  },
  {
    id: "EX016",
    name: "Debate",
    family: "discussion",
    stimulus: "statement",
    mode: "dialogue",
    cefrMin: "B2",
    cefrMax: "C2",
    durationMinutes: [6, 10],
    authored: false,
  },

  // Family 8 — Professional Communication
  {
    id: "EX017",
    name: "Presentation",
    family: "explanation",
    stimulus: "topic",
    mode: "monologue",
    cefrMin: "B2",
    cefrMax: "C2",
    durationMinutes: [6, 10],
    authored: false,
  },
  {
    id: "EX018",
    name: "Roleplay",
    family: "professional_communication",
    stimulus: "scenario",
    mode: "dialogue",
    cefrMin: "A2",
    cefrMax: "C2",
    durationMinutes: [5, 8],
    authored: true,
  },
];

const byId = new Map(templates.map((t) => [t.id, t]));

export function templateById(id: string): ExerciseTemplate | undefined {
  return byId.get(id);
}

/** Templates a learner at this band can be handed. */
export function templatesAtLevel(cefr: Cefr): ExerciseTemplate[] {
  const level = CEFR_ORDER.indexOf(cefr);
  return templates.filter(
    (t) =>
      CEFR_ORDER.indexOf(t.cefrMin) <= level &&
      CEFR_ORDER.indexOf(t.cefrMax) >= level,
  );
}
