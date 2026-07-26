"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during the server render and the first client render, true after.
 *
 * The usual `useState(false)` + `useEffect(() => setMounted(true))` does the
 * same job by deliberately triggering a second render from an effect, which is
 * exactly the cascading-render pattern the compiler flags. This says the same
 * thing declaratively: the server snapshot and the client snapshot differ, and
 * React is expected to reconcile them.
 *
 * Use it for anything whose true value only exists in the browser — a resolved
 * theme, a stored preference, a media query.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
