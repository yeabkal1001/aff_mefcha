import { describe, expect, it } from "vitest";

import {
  ONBOARDING_STEPS,
  emptyDraft,
  lifePathById,
  lifePaths,
  nativeLanguageById,
} from "./onboarding";

describe("ONBOARDING_STEPS", () => {
  it("has no duplicates", () => {
    expect(new Set(ONBOARDING_STEPS).size).toBe(ONBOARDING_STEPS.length);
  });

  it("ends on the profile reveal, which is the only step that leaves the flow", () => {
    expect(ONBOARDING_STEPS.at(-1)).toBe("profile");
  });

  it("asks the mic check before the assessment that needs it", () => {
    expect(ONBOARDING_STEPS.indexOf("mic")).toBeLessThan(
      ONBOARDING_STEPS.indexOf("assessment"),
    );
  });

  it("never asks for an English level", () => {
    expect(ONBOARDING_STEPS).not.toContain("level");
    expect(ONBOARDING_STEPS).not.toContain("cefr");
  });
});

describe("emptyDraft", () => {
  it("starts every answer unset, so no default is mistaken for a choice", () => {
    expect(emptyDraft).toEqual({
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
    });
  });
});

describe("lifePaths", () => {
  it("has unique ids", () => {
    expect(new Set(lifePaths.map((p) => p.id)).size).toBe(lifePaths.length);
  });

  it("names exactly one default", () => {
    expect(lifePaths.filter((p) => p.isDefault)).toHaveLength(1);
  });

  it("gives every path exactly two Profile Dimensions on top of the four fixed", () => {
    for (const path of lifePaths) {
      expect(path.dimensions).toHaveLength(2);
    }
  });

  it("resolves a known id and returns null for an unknown one", () => {
    expect(lifePathById("university_success")?.name).toBe("University Success");
    expect(lifePathById(null)).toBeNull();
  });
});

describe("nativeLanguageById", () => {
  it("resolves Amharic with its interference set", () => {
    expect(nativeLanguageById("am")?.interference).toContain("/p/ vs /b/");
  });

  it("returns null for an unknown language", () => {
    expect(nativeLanguageById("zz")).toBeNull();
  });
});
