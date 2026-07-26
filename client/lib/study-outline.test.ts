import { describe, expect, it } from "vitest";

import { orderedDomains } from "./domains";
import { buildLearnerProfile } from "./learner-profile";
import { emptyDraft, type OnboardingDraft } from "./onboarding";
import { phaseRange, projectOutline } from "./study-outline";

const profileFor = (patch: Partial<OnboardingDraft> = {}) =>
  buildLearnerProfile({ ...emptyDraft, ...patch });

describe("projectOutline", () => {
  it("covers thirty days without overlapping or leaving gaps", () => {
    const outline = projectOutline(profileFor());

    expect(outline.days).toBe(30);
    expect(outline.phases[0].startDay).toBe(1);

    outline.phases.forEach((phase, i) => {
      expect(phase.endDay).toBeGreaterThanOrEqual(phase.startDay);
      expect(phase.endDay).toBeLessThanOrEqual(30);
      if (i > 0) {
        expect(phase.startDay).toBe(outline.phases[i - 1].endDay + 1);
      }
    });
  });

  it("names domains and objectives, never competencies or templates", () => {
    // ADR 0007. The morning's session is chosen from evidence that does not
    // exist yet, so an outline that named a template would be lying.
    const outline = projectOutline(profileFor());
    const text = JSON.stringify(outline);

    expect(outline.phases[0].objectives.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/EX0\d\d/);
    expect(text).not.toMatch(/\b[VGPF]\d{3}\b/);
  });

  it("reshapes around what the learner has already finished", () => {
    const profile = profileFor();
    const first = projectOutline(profile).phases[0].domain.id;
    const after = projectOutline(profile, [first]);

    expect(after.phases[0].domain.id).not.toBe(first);
    expect(after.phases[0].startDay).toBe(1);
  });

  it("orders domains by the Life Path", () => {
    const student = projectOutline(profileFor({ lifePath: "university_success" }));
    const everyday = projectOutline(profileFor({ lifePath: "general_english" }));

    expect(student.phases[0].domain.id).toBe(
      orderedDomains("university_success", "A2")[0].id,
    );
    expect(everyday.phases[0].domain.id).toBe(
      orderedDomains("general_english", "A2")[0].id,
    );
  });

  it("buys depth with a bigger budget rather than speed", () => {
    // Retrievability decays on wall-clock days however hard the learner
    // worked, so 45 minutes a day is not four and a half times faster than 10.
    const light = projectOutline(profileFor({ dailyMinutes: 10 }));
    const heavy = projectOutline(profileFor({ dailyMinutes: 45 }));

    const speedUp = light.phases[0].endDay / heavy.phases[0].endDay;
    expect(speedUp).toBeGreaterThan(1);
    expect(speedUp).toBeLessThan(4.5);

    expect(heavy.totalActivities).toBeGreaterThan(light.totalActivities);
    expect(heavy.totalMinutes).toBe(30 * 45);
  });

  it("skins the theme with the learner's field", () => {
    const outline = projectOutline(
      profileFor({ lifePath: "university_success", studyField: "Medicine" }),
    );

    expect(outline.phases[0].theme).toContain("Medicine");
  });

  it("leaves the theme bare when there is no field to skin it with", () => {
    const outline = projectOutline(profileFor());
    const domain = outline.phases[0].domain;

    expect(outline.phases[0].theme).toBe(domain.contexts[0]);
  });

  it("carries placement through, because an unplaced outline is a guess", () => {
    expect(projectOutline(profileFor()).placed).toBe(false);
    expect(
      projectOutline(profileFor({ assessmentComplete: true })).placed,
    ).toBe(true);
  });

  it("is a pure function of its inputs", () => {
    const profile = profileFor({ lifePath: "hospitality", studyField: "Concierge" });

    expect(projectOutline(profile)).toEqual(projectOutline(profile));
  });
});

describe("phaseRange", () => {
  it("reads as a range, or as a day when it is one", () => {
    const [phase] = projectOutline(profileFor()).phases;

    expect(phaseRange({ ...phase, startDay: 1, endDay: 7 })).toBe("Days 1–7");
    expect(phaseRange({ ...phase, startDay: 4, endDay: 4 })).toBe("Day 4");
  });
});
