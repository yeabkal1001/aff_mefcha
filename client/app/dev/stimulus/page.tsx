"use client";

import { useState } from "react";

import { AmbientBackground } from "@/components/session/ambient-background";
import { Stimulus, scenes, type StimulusSpec } from "@/components/session/stimulus";
import { templates } from "@/lib/templates";

/**
 * Every stimulus kind, on one page.
 *
 * A working reference while the remaining fifteen templates get built: the
 * practice screen only ever shows the two or three kinds today's mission
 * happens to use, so without this the other renderers are unreviewable until
 * something schedules them.
 *
 * Not linked from anywhere in the product. Delete it when all eighteen
 * templates have run in a real session.
 */
export default function StimulusGalleryPage() {
  const [compact, setCompact] = useState(false);

  return (
    <div className="relative min-h-dvh">
      <AmbientBackground state="idle" />

      <main className="relative z-10 mx-auto max-w-[52rem] px-8 py-10">
        <header className="flex items-start justify-between gap-6">
          <div>
            <p className="label-eyebrow">Internal</p>
            <h1 className="mt-2 text-[1.625rem] font-semibold tracking-tight">
              Stimulus kinds
            </h1>
            <p className="mt-2 max-w-[32rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
              Ten renderers covering all eighteen exercise templates. Toggle compact to see
              the state each one enters while a correction is on screen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCompact((c) => !c)}
            className="shrink-0 rounded-full bg-foreground px-4 py-2 text-[0.8125rem] font-medium text-background"
          >
            {compact ? "Show full" : "Show compact"}
          </button>
        </header>

        <div className="mt-9 space-y-9">
          {/* `audio` appears twice — once restricted, once for shadowing — so
              the key is the template set rather than the kind. */}
          {gallery.map(({ spec, usedBy }) => (
            <section key={usedBy.join("-")}>
              <div className="mb-3 flex items-baseline gap-2.5">
                <h2 className="text-[0.9375rem] font-semibold tracking-tight">{spec.kind}</h2>
                <p className="text-[0.75rem] text-muted-foreground">
                  {usedBy
                    .map((id) => templates.find((t) => t.id === id)?.name ?? id)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex justify-center">
                <Stimulus spec={spec} compact={compact} />
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

const gallery: { spec: StimulusSpec; usedBy: string[] }[] = [
  {
    usedBy: ["EX001"],
    spec: {
      kind: "image",
      scene: "campus_courtyard",
      description: scenes.campus_courtyard.description,
      instruction: "Tell me what is happening.",
    },
  },
  {
    usedBy: ["EX002"],
    spec: {
      kind: "image_pair",
      left: { scene: "cafe_counter", label: "A quiet morning" },
      right: { scene: "market_stall", label: "A busy afternoon" },
      instruction: "What is different between these two places?",
    },
  },
  {
    usedBy: ["EX003", "EX011"],
    spec: {
      kind: "image_sequence",
      steps: [
        { scene: "quiet_library", caption: "She studies" },
        { scene: "crowded_bus", caption: "She travels" },
        { scene: "cafe_counter", caption: "She orders" },
      ],
      instruction: "Tell me the story, from the first picture to the last.",
    },
  },
  {
    usedBy: ["EX004", "EX005"],
    spec: {
      kind: "audio",
      seconds: 24,
      replaysAllowed: 1,
      instruction: "Listen, then tell me what the announcement said.",
    },
  },
  {
    usedBy: ["EX006"],
    spec: {
      kind: "audio",
      seconds: 6,
      replaysAllowed: 4,
      transcript: "I'd like to book a table for three, please.",
      instruction: "Listen, then say it back exactly the same way.",
    },
  },
  {
    usedBy: ["EX007", "EX008", "EX010"],
    spec: {
      kind: "audio_question",
      question: "What is the best thing about where you live?",
      instruction: "Answer in a few sentences.",
    },
  },
  {
    usedBy: ["EX009", "EX012"],
    spec: {
      kind: "text",
      prompt: "Teach me how to make a cup of coffee the way you make it.",
      hints: ["What do you need?", "What comes first?", "How long does it take?"],
      instruction: "Explain it step by step, as if I have never done it.",
    },
  },
  {
    usedBy: ["EX013", "EX014"],
    spec: {
      kind: "choice",
      situation:
        "Your bus is cancelled and you need to be at a lecture in twenty minutes.",
      options: [
        { id: "a", label: "Take a taxi", detail: "Fast, but expensive" },
        { id: "b", label: "Walk", detail: "Free, and you will be late" },
        { id: "c", label: "Message the lecturer", detail: "Honest, but you miss the class" },
      ],
      instruction: "Pick one, then tell me why.",
    },
  },
  {
    usedBy: ["EX015", "EX016"],
    spec: {
      kind: "statement",
      statement: "Students learn more from group projects than from lectures.",
      assignedSide: "against",
      instruction: "Give me two reasons, and an example for each.",
    },
  },
  {
    usedBy: ["EX017"],
    spec: {
      kind: "topic",
      topic: "A place in your city that visitors should see",
      beats: [
        "Say where it is and what it is",
        "Give two reasons it is worth visiting",
        "Finish with what you would tell a first-time visitor",
      ],
      prepSeconds: 45,
      instruction: "Two minutes, in your own words.",
    },
  },
  {
    usedBy: ["EX018"],
    spec: {
      kind: "scenario",
      setting: "You are checking into a hotel and your booking is missing.",
      learnerRole: "The guest, tired after a long journey",
      coachRole: "The receptionist, polite but unhelpful",
      objective: "Stay calm, explain the problem, and get a room tonight.",
      instruction: "Start whenever you are ready.",
    },
  },
];
