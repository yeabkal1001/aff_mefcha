/**
 * Who this device is, before there is an account.
 *
 * Sign-up happens after the first mission, but the server needs a `learner_id`
 * from the very first call — onboarding writes `learner_profile` and everything
 * after it hangs off that row. So the client mints the id and holds it locally.
 *
 * Kept under its own storage key rather than inside the onboarding draft: the
 * draft is cleared when onboarding finishes, and the identity has to outlive it.
 */

const STORAGE_KEY = "coach.learner.id";

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * The id for this device, minted on first use.
 *
 * Throws on the server, because there is no device there. Call it from an event
 * handler or an effect, never during render of a server component.
 */
export function getLearnerId(): string {
  if (typeof window === "undefined") {
    throw new Error("getLearnerId is browser-only — there is no device on the server");
  }

  const existing = read();
  if (existing) return existing;

  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode. The session still works; it just will not resume.
  }
  return id;
}

/** Null when onboarding has not run on this device yet. */
export function peekLearnerId(): string | null {
  if (typeof window === "undefined") return null;
  return read();
}

export function clearLearnerId() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}
