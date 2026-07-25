"use client";

import { Target, Timer } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { StimulusLabel, StimulusPanel } from "./stimulus-panel";
import type { ChoiceStimulus, ScenarioStimulus, TopicStimulus } from "./types";

/**
 * `EX013`, and `EX014` when it runs as a choice.
 *
 * Selecting an option is not the exercise and is not scored — the exercise is
 * justifying the choice out loud, which is why picking one changes the prompt
 * underneath rather than advancing anything. Without the tap the learner has
 * to hold three options in their head while constructing a sentence, and the
 * evidence you get back is about working memory instead of language.
 */
export function ChoiceStimulusView({
  spec,
  compact,
}: {
  spec: ChoiceStimulus;
  compact?: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const choice = spec.options.find((o) => o.id === chosen);

  if (compact) {
    return (
      <StimulusPanel className="px-4 py-3">
        <p className="text-center text-[0.875rem] font-medium leading-snug">{spec.situation}</p>
      </StimulusPanel>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <StimulusLabel>The situation</StimulusLabel>

      <StimulusPanel className="w-full px-5 py-4">
        <p className="text-balance text-center text-[1.0625rem] font-medium leading-snug tracking-tight">
          {spec.situation}
        </p>
      </StimulusPanel>

      <div role="radiogroup" aria-label="Options" className="mt-3 grid w-full gap-2">
        {spec.options.map((option) => {
          const selected = option.id === chosen;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChosen(option.id)}
              className={cn(
                "surface-panel flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition",
                selected
                  ? "ring-2 ring-foreground/80"
                  : "hover:bg-foreground/[0.025]",
              )}
            >
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border text-[0.625rem] font-semibold",
                  selected
                    ? "border-transparent bg-foreground text-background"
                    : "border-border text-muted-foreground",
                )}
              >
                {option.id.toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[0.9375rem] font-medium leading-tight">
                  {option.label}
                </span>
                {option.detail && (
                  <span className="mt-0.5 block text-[0.75rem] leading-snug text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[0.8125rem] text-muted-foreground">
        {choice
          ? `Now tell me why you chose ${choice.label.toLowerCase()}.`
          : "Pick one, then tell me why."}
      </p>
    </div>
  );
}

/**
 * `EX018`, and `EX014` when it runs as a situation.
 *
 * Four facts, always in the same order: where, who you are, who I am, what you
 * want. Roleplay collapses when the learner is unsure which of those they were
 * supposed to have inferred, and the objective in particular has to be visible
 * throughout — it is the condition that ends the turn.
 */
export function ScenarioStimulusView({
  spec,
  compact,
}: {
  spec: ScenarioStimulus;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <StimulusPanel className="px-4 py-2.5">
        <p className="text-center text-[0.8125rem] font-medium leading-snug">{spec.setting}</p>
        <p className="mt-0.5 text-center text-[0.75rem] text-muted-foreground">
          {spec.objective}
        </p>
      </StimulusPanel>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <StimulusLabel>The situation</StimulusLabel>

      <StimulusPanel className="w-full px-5 py-4">
        <p className="text-balance text-center text-[1.0625rem] font-medium leading-snug tracking-tight">
          {spec.setting}
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <Role label="You are" value={spec.learnerRole} />
          <Role label="I am" value={spec.coachRole} />
        </div>

        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-coach-correct/[0.08] px-3 py-2.5">
          <Target className="mt-[3px] size-3.5 shrink-0 text-coach-correct" strokeWidth={2.2} />
          <p className="text-[0.8125rem] leading-snug text-foreground/85">{spec.objective}</p>
        </div>
      </StimulusPanel>
    </div>
  );
}

function Role({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/[0.035] px-3 py-2">
      <p className="label-eyebrow">{label}</p>
      <p className="mt-0.5 text-[0.875rem] font-medium leading-snug">{value}</p>
    </div>
  );
}

/**
 * `EX017` — a topic and the shape the talk should take.
 *
 * The beats are the difference between a presentation exercise and an
 * open-ended monologue: they give the evaluator a structure to score against,
 * and give the learner somewhere to go when they run out of things to say.
 */
export function TopicStimulusView({
  spec,
  compact,
}: {
  spec: TopicStimulus;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <StimulusPanel className="px-4 py-2.5">
        <p className="text-center text-[0.875rem] font-medium leading-snug">{spec.topic}</p>
      </StimulusPanel>
    );
  }

  return (
    <div className="flex w-full flex-col items-center">
      <StimulusLabel>Your topic</StimulusLabel>

      <StimulusPanel className="w-full px-5 py-4">
        <p className="text-balance text-center text-[1.125rem] font-medium leading-snug tracking-tight">
          {spec.topic}
        </p>

        <ol className="mt-3.5 space-y-1.5">
          {spec.beats.map((beat, i) => (
            <li key={beat} className="flex items-start gap-2.5">
              <span className="mt-[1px] grid size-4 shrink-0 place-items-center rounded-full bg-foreground/[0.07] text-[0.5625rem] font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-[0.8125rem] leading-snug text-foreground/80">{beat}</span>
            </li>
          ))}
        </ol>
      </StimulusPanel>

      <p className="mt-2.5 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
        <Timer className="size-3.5" strokeWidth={2} />
        {spec.prepSeconds} seconds to think before you start.
      </p>
    </div>
  );
}
