import type { SceneId } from "./scene-ids";

/**
 * The stimulus a session actually carries.
 *
 * One variant per `StimulusKind` in `lib/templates.ts`, discriminated on
 * `kind`, so adding a stimulus type to the curriculum produces a type error at
 * the dispatcher rather than a blank panel at runtime.
 *
 * Everything here is what `buildSession` puts in `spec_json` — see
 * `session-engine.md` §10. Image variants carry a `SceneId` today and will
 * carry a Stimulus Pool `asset_id` and URL once fal is wired up; the field name
 * changes, nothing else does.
 */
export type StimulusSpec =
  | ImageStimulus
  | ImagePairStimulus
  | ImageSequenceStimulus
  | AudioStimulus
  | AudioQuestionStimulus
  | TextStimulus
  | ChoiceStimulus
  | StatementStimulus
  | TopicStimulus
  | ScenarioStimulus;

interface Base {
  /**
   * What the learner is asked to do, in the coach's voice. Spoken once and
   * also shown, because a spoken instruction the learner missed ends the turn
   * before it starts.
   */
  instruction: string;
}

/** `EX001`. */
export interface ImageStimulus extends Base {
  kind: "image";
  scene: SceneId;
  /** Read by screen readers, and the ceiling on what the learner could say. */
  description: string;
}

/** `EX002` — the two images differ in the dimension the learner must name. */
export interface ImagePairStimulus extends Base {
  kind: "image_pair";
  left: { scene: SceneId; label: string };
  right: { scene: SceneId; label: string };
}

/** `EX003`, and `EX011` when it runs visually. */
export interface ImageSequenceStimulus extends Base {
  kind: "image_sequence";
  steps: { scene: SceneId; caption: string }[];
}

/** `EX004`, `EX005`, `EX006`. */
export interface AudioStimulus extends Base {
  kind: "audio";
  /** fal TTS in production; absent means the player renders in its unloaded state. */
  src?: string;
  seconds: number;
  /**
   * Shown only for `EX006 Shadowing`, where the learner is repeating a model
   * and hiding the words would test memory rather than pronunciation.
   */
  transcript?: string;
  /** How many times the learner may replay it. Shadowing is generous; summarising is not. */
  replaysAllowed: number;
}

/** `EX007`, `EX008`, `EX010` — the coach asks, out loud. */
export interface AudioQuestionStimulus extends Base {
  kind: "audio_question";
  question: string;
  src?: string;
}

/** `EX009`, `EX012` — a written prompt and nothing else. */
export interface TextStimulus extends Base {
  kind: "text";
  prompt: string;
  /** Optional scaffolding: things the learner might mention. Never required. */
  hints?: string[];
}

/** `EX013`, and `EX014` when it runs as a choice. */
export interface ChoiceStimulus extends Base {
  kind: "choice";
  situation: string;
  options: { id: string; label: string; detail?: string }[];
}

/** `EX015`, `EX016` — a proposition to agree or disagree with. */
export interface StatementStimulus extends Base {
  kind: "statement";
  statement: string;
  /** Shown for debate, where the learner is assigned a side rather than choosing one. */
  assignedSide?: "for" | "against";
}

/** `EX017`. */
export interface TopicStimulus extends Base {
  kind: "topic";
  topic: string;
  /** The shape the talk should take. Not a script. */
  beats: string[];
  prepSeconds: number;
}

/** `EX018`, and `EX014` when it runs as a situation. */
export interface ScenarioStimulus extends Base {
  kind: "scenario";
  setting: string;
  /** Who the learner is playing. */
  learnerRole: string;
  /** Who the coach is playing. */
  coachRole: string;
  /** What the learner is trying to achieve. The turn ends when they get it. */
  objective: string;
}
