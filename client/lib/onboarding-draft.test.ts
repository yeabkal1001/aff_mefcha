import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyDraft } from "./onboarding";

const DRAFT_KEY = "coach.onboarding.draft";
const STEP_KEY = "coach.onboarding.step";

/**
 * The stores read `localStorage` once at module load, which is what makes the
 * first client render correct rather than a flash of the default. Testing that
 * therefore means seeding storage and re-importing the module.
 */
async function load(stored?: { draft?: unknown; step?: unknown }) {
  localStorage.clear();
  if (stored?.draft !== undefined) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(stored.draft));
  }
  if (stored?.step !== undefined) {
    localStorage.setItem(STEP_KEY, JSON.stringify(stored.step));
  }
  vi.resetModules();
  return import("./onboarding-draft");
}

beforeEach(() => {
  localStorage.clear();
});

describe("the stored draft", () => {
  it("starts empty when there is nothing stored", async () => {
    const { draftStore } = await load();

    expect(draftStore.get()).toEqual(emptyDraft);
  });

  it("restores a draft it wrote itself", async () => {
    const stored = { ...emptyDraft, name: "Hana", l1: "am", ageBand: "18_24" };
    const { draftStore } = await load({ draft: stored });

    expect(draftStore.get()).toEqual(stored);
  });

  it("drops a draft with a value no screen offers", async () => {
    // Storage is attacker-writable and outlives deploys. The old code spread
    // `JSON.parse` straight into the draft, which is how you get
    // `lifePath: "banana"` and a crash six screens later.
    const { draftStore } = await load({
      draft: { ...emptyDraft, name: "Hana", lifePath: "banana" },
    });

    expect(draftStore.get()).toEqual(emptyDraft);
  });

  it("drops a draft missing fields the schema requires", async () => {
    const { draftStore } = await load({ draft: { name: "Hana" } });

    expect(draftStore.get()).toEqual(emptyDraft);
  });

  it("survives corrupt JSON", async () => {
    localStorage.clear();
    localStorage.setItem(DRAFT_KEY, "{{{not json");
    vi.resetModules();
    const { draftStore } = await import("./onboarding-draft");

    expect(draftStore.get()).toEqual(emptyDraft);
  });

  it("clears a Life Path that is no longer selectable, and its field", async () => {
    // The screen disables planned paths, but a draft written before a path was
    // retired would sail past `canAdvance` and silently fall back to Everyday
    // English three screens later.
    const { draftStore } = await load({
      draft: {
        ...emptyDraft,
        name: "Samuel",
        lifePath: "healthcare",
        studyField: "Cardiology",
      },
    });

    expect(draftStore.get().lifePath).toBeNull();
    expect(draftStore.get().studyField).toBe("");
    expect(draftStore.get().name).toBe("Samuel");
  });

  it("keeps a Life Path that is live", async () => {
    const { draftStore } = await load({
      draft: { ...emptyDraft, lifePath: "hospitality", studyField: "Concierge" },
    });

    expect(draftStore.get().lifePath).toBe("hospitality");
    expect(draftStore.get().studyField).toBe("Concierge");
  });
});

describe("updateDraft", () => {
  it("patches, persists, and notifies", async () => {
    const { draftStore, updateDraft } = await load();
    const listener = vi.fn();
    draftStore.subscribe(listener);

    updateDraft({ name: "Hana" });
    updateDraft({ l1: "ti" });

    expect(draftStore.get()).toEqual({ ...emptyDraft, name: "Hana", l1: "ti" });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}")).toEqual(
      draftStore.get(),
    );
  });
});

describe("the stored step", () => {
  it("starts at the first step", async () => {
    const { stepStore } = await load();

    expect(stepStore.get()).toBe("name");
  });

  it("restores by name, not by index", async () => {
    // Stored by name so that inserting a step into the flow moves a resuming
    // learner to the right screen rather than to whatever now sits at four.
    const { stepStore } = await load({ step: "feedback" });

    expect(stepStore.get()).toBe("feedback");
  });

  it("rejects a step that is not in the flow", async () => {
    const { stepStore } = await load({ step: "payment" });

    expect(stepStore.get()).toBe("name");
  });
});

describe("resetDraft", () => {
  it("clears the answers and the position together", async () => {
    const { draftStore, stepStore, updateDraft, resetDraft } = await load();

    updateDraft({ name: "Hana", lifePath: "hospitality" });
    stepStore.set("goal");

    resetDraft();

    expect(draftStore.get()).toEqual(emptyDraft);
    expect(stepStore.get()).toBe("name");
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(localStorage.getItem(STEP_KEY)).toBeNull();
  });
});
