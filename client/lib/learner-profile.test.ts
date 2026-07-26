import { describe, expect, it } from "vitest";

import {
  FIXED_DIMENSIONS,
  buildLearnerProfile,
  pronouns,
} from "./learner-profile";
import { emptyDraft, type OnboardingDraft } from "./onboarding";

const draft = (patch: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  ...emptyDraft,
  ...patch,
});

describe("buildLearnerProfile", () => {
  it("fills an empty draft rather than throwing", () => {
    // It runs on every render of every screen that reads the profile,
    // including halfway through onboarding when most answers are still null.
    const profile = buildLearnerProfile(emptyDraft);

    expect(profile.lifePathId).toBe("general_english");
    expect(profile.gender).toBe("unspecified");
    expect(profile.feedbackLanguage).toBe("english");
    expect(profile.budget.minutes).toBe(20);
    expect(profile.placed).toBe(false);
  });

  it("reports placement rather than implying it", () => {
    // The band is A2 either way — only A2 content is authored — so `placed` is
    // the only thing that distinguishes a measured profile from a guessed one.
    const guessed = buildLearnerProfile(emptyDraft);
    const measured = buildLearnerProfile(
      draft({ assessmentComplete: true, cefr: "A2" }),
    );

    expect(guessed.cefr).toBe("A2");
    expect(measured.cefr).toBe("A2");
    expect(guessed.placed).toBe(false);
    expect(measured.placed).toBe(true);
  });

  it("carries L1 interference through as priority input", () => {
    const profile = buildLearnerProfile(draft({ l1: "am" }));

    expect(profile.l1).toBe("am");
    expect(profile.l1Risk).toContain("/p/ vs /b/");
  });

  it("has no interference data for a language we do not know", () => {
    const profile = buildLearnerProfile(draft({ l1: "other" }));

    expect(profile.l1Risk).toEqual([]);
  });

  describe("dimensions", () => {
    it("are the four fixed plus two from the Life Path", () => {
      const profile = buildLearnerProfile(draft({ lifePath: "hospitality" }));

      expect(profile.dimensions).toHaveLength(6);
      expect(profile.dimensions.slice(0, 4)).toEqual(FIXED_DIMENSIONS);
      expect(profile.dimensions).toContain("Guest Interaction");
    });

    it("differ by path, which is the whole point of a path", () => {
      const student = buildLearnerProfile(draft({ lifePath: "university_success" }));
      const server = buildLearnerProfile(draft({ lifePath: "hospitality" }));

      expect(student.dimensions).toContain("Classroom Interaction");
      expect(server.dimensions).not.toContain("Classroom Interaction");
    });
  });

  describe("path resolution", () => {
    it("records what the learner picked even when the overlay falls back", () => {
      // The custom path has no authored overlay, so it inherits Everyday
      // English — but the UI still has to be able to say "Something else".
      const profile = buildLearnerProfile(draft({ lifePath: "custom" }));

      expect(profile.lifePathId).toBe("custom");
      expect(profile.lifePath.id).toBe("general_english");
    });

    it("falls back for a path that is planned rather than built", () => {
      const profile = buildLearnerProfile(draft({ lifePath: "healthcare" }));

      expect(profile.lifePathId).toBe("healthcare");
      expect(profile.lifePath.id).toBe("general_english");
    });
  });

  describe("the load budget", () => {
    it("widens the review share as the budget grows", () => {
      // Review is what a longer day buys; ten minutes has no room for it.
      const short = buildLearnerProfile(draft({ dailyMinutes: 10 })).budget;
      const long = buildLearnerProfile(draft({ dailyMinutes: 45 })).budget;

      expect(short.sessions).toBe(2);
      expect(long.sessions).toBe(6);
      expect(long.reviews).toBeGreaterThan(short.reviews);
    });

    it("falls back to the usual pace for minutes with no table row", () => {
      const profile = buildLearnerProfile(draft({ dailyMinutes: 17 }));

      expect(profile.budget.sessions).toBe(4);
    });
  });

  describe("the goal horizon", () => {
    it("converts a chosen horizon to months", () => {
      expect(buildLearnerProfile(draft({ goalHorizon: "weeks" })).goalMonths).toBe(1);
      expect(buildLearnerProfile(draft({ goalHorizon: "half" })).goalMonths).toBe(6);
    });

    it("is null when there is no deadline, or none was given", () => {
      expect(buildLearnerProfile(draft({ goalHorizon: "open" })).goalMonths).toBeNull();
      expect(buildLearnerProfile(emptyDraft).goalMonths).toBeNull();
    });
  });

  it("trims what the learner typed", () => {
    const profile = buildLearnerProfile(
      draft({ name: "  Hana  ", studyField: " Medicine " }),
    );

    expect(profile.name).toBe("Hana");
    expect(profile.studyField).toBe("Medicine");
  });
});

describe("pronouns", () => {
  it("is the only thing the gender answer changes", () => {
    const woman = buildLearnerProfile(draft({ gender: "woman" }));
    const man = buildLearnerProfile(draft({ gender: "man" }));
    const unspecified = buildLearnerProfile(draft({ gender: "unspecified" }));

    expect(pronouns(woman).subject).toBe("she");
    expect(pronouns(man).object).toBe("him");
    expect(pronouns(unspecified).possessive).toBe("their");

    // Nothing else about the two profiles differs.
    expect({ ...woman, gender: "man" }).toEqual({ ...man, gender: "man" });
  });
});
