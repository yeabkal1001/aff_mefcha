import { useSyncExternalStore } from "react";

/**
 * A `localStorage`-backed external store.
 *
 * Three things in this app outlive a render and predate an account: the
 * onboarding draft, how far through onboarding the learner got, and whether
 * the sidebar is collapsed. All three have the same awkward property — the
 * server cannot know the value, and the client knows it before first paint.
 *
 * `useSyncExternalStore` is the one React API built for that: the server
 * snapshot and the client snapshot are allowed to differ, and React
 * re-renders rather than warning about a mismatch. Rolling this by hand with
 * `useState` + `useEffect` gives a guaranteed flash of the default value.
 *
 * `revive` is not optional in spirit. Storage is attacker-writable and
 * survives deploys, so a stored value from three versions ago has to be
 * rejected rather than spread into today's shape.
 */
export interface LocalStore<T> {
  subscribe(listener: () => void): () => void;
  get(): T;
  getServerSnapshot(): T;
  set(next: T | ((previous: T) => T)): void;
  reset(): void;
}

export function createLocalStore<T>(
  key: string,
  initial: T,
  revive: (raw: unknown) => T | null,
): LocalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  // Restore once at module load, so the very first client snapshot is already
  // correct and nothing has to flash the default.
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const revived = revive(JSON.parse(stored));
        if (revived !== null) value = revived;
      }
    } catch {
      // Corrupt JSON, or storage disabled. Neither is worth failing over:
      // the learner gets a fresh start instead of a broken screen.
    }
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => value,
    getServerSnapshot: () => initial,
    set(next) {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Private mode. The session still works, it just will not resume.
      }
      emit();
    },
    reset() {
      value = initial;
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing to clean up.
      }
      emit();
    },
  };
}

export function useLocalStore<T>(store: LocalStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.get,
    store.getServerSnapshot,
  );
}
