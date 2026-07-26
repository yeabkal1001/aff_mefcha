"use client";

import { assertNever } from "@/lib/utils";

import { AudioQuestionStimulusView, AudioStimulusView } from "./audio-stimulus";
import {
  ChoiceStimulusView,
  ScenarioStimulusView,
  TopicStimulusView,
} from "./task-stimuli";
import type { StimulusSpec } from "./types";
import {
  ImagePairStimulusView,
  ImageSequenceStimulusView,
  ImageStimulusView,
  StatementStimulusView,
  TextStimulusView,
} from "./visual-stimuli";

export type { StimulusSpec } from "./types";
export { scenes, type SceneId } from "./scenes";

/**
 * One stimulus, whichever kind it is.
 *
 * This is the seam that makes the practice screen template-agnostic: it takes
 * a `spec` from the session and renders it, so adding `EX016 Debate` to the
 * demo is a data change rather than a screen change. The exhaustive switch
 * means a new `StimulusKind` in `lib/templates.ts` fails to compile here
 * instead of rendering nothing.
 *
 * `compact` is the state a stimulus takes while a correction is on screen:
 * still visible, because the correction only makes sense against what the
 * learner was looking at, but no longer competing with it.
 */
export function Stimulus({
  spec,
  compact = false,
}: {
  spec: StimulusSpec;
  compact?: boolean;
}) {
  switch (spec.kind) {
    case "image":
      return <ImageStimulusView spec={spec} compact={compact} />;
    case "image_pair":
      return <ImagePairStimulusView spec={spec} compact={compact} />;
    case "image_sequence":
      return <ImageSequenceStimulusView spec={spec} compact={compact} />;
    case "audio":
      return <AudioStimulusView spec={spec} compact={compact} />;
    case "audio_question":
      return <AudioQuestionStimulusView spec={spec} compact={compact} />;
    case "text":
      return <TextStimulusView prompt={spec.prompt} hints={spec.hints} compact={compact} />;
    case "choice":
      return <ChoiceStimulusView spec={spec} compact={compact} />;
    case "statement":
      return (
        <StatementStimulusView
          statement={spec.statement}
          assignedSide={spec.assignedSide}
          compact={compact}
        />
      );
    case "topic":
      return <TopicStimulusView spec={spec} compact={compact} />;
    case "scenario":
      return <ScenarioStimulusView spec={spec} compact={compact} />;
  }
}

/**
 * How much room a stimulus wants when the learner is working from it.
 *
 * A picture wants to be large and a one-line question does not, and the
 * difference has to be declared somewhere. Here, rather than in the stage,
 * because it is a property of the stimulus rather than of the screen.
 *
 * Every number is a preference and none is a floor: the stage caps them at the
 * width of the column, so 460 means "as wide as 460 if there is room" rather
 * than "460 or overflow". That is why these can stay plain numbers — a spring
 * can animate between two of them, and cannot animate between two `clamp()`s.
 */
export function stimulusWidth(spec: StimulusSpec): number {
  switch (spec.kind) {
    case "image":
      return 272;
    case "image_pair":
      return 400;
    case "image_sequence":
      return 460;
    case "audio":
      return 380;
    case "choice":
    case "scenario":
    case "topic":
      return 420;
    case "audio_question":
    case "statement":
    case "text":
      return 460;
  }
}

/** The same, once a correction has taken over the screen. */
export function compactStimulusWidth(spec: StimulusSpec): number {
  switch (spec.kind) {
    case "image":
      return 128;
    case "image_pair":
    case "image_sequence":
      return 200;
    case "audio":
    case "audio_question":
    case "text":
    case "choice":
    case "statement":
    case "topic":
    case "scenario":
      return 320;
    default:
      // A `default: return 320` here is how a new stimulus kind ships looking
      // almost right instead of failing to compile.
      return assertNever(spec, "stimulus kind");
  }
}
