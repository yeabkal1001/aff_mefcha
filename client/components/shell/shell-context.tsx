"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createLocalStore, useLocalStore } from "@/lib/local-store";
import type { SessionPhase } from "@/lib/session/phase";

/**
 * State that belongs to the app shell rather than to any one screen.
 *
 * Before this existed, `/practice` and `/plan` each built their own sidebar
 * and each held their own collapse flag, so collapsing the sidebar and then
 * navigating silently expanded it again. Anything the shell owns lives here.
 */

/** Collapse survives a reload: it is a preference, not a view state. */
const collapsedStore = createLocalStore<boolean>(
  "coach.shell.sidebarCollapsed",
  false,
  (raw) => (typeof raw === "boolean" ? raw : null),
);

/** What the session is doing, so the ambient field can warm to it. */
interface LiveProgress {
  speakingMinutes: number;
  corrections: number;
}

interface ShellValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** The drawer on small screens, where the sidebar has nowhere to sit. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  ambient: SessionPhase;
  setAmbient: (state: SessionPhase) => void;
  /**
   * Counters the live session owns while it is on screen. Null everywhere
   * else, which is the signal to fall back to today's stored progress.
   */
  liveProgress: LiveProgress | null;
  setLiveProgress: (progress: LiveProgress | null) => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useLocalStore(collapsedStore);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ambient, setAmbient] = useState<SessionPhase>("idle");
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);

  const toggleCollapsed = useCallback(() => {
    collapsedStore.set((previous) => !previous);
  }, []);

  const value = useMemo<ShellValue>(
    () => ({
      collapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      ambient,
      setAmbient,
      liveProgress,
      setLiveProgress,
    }),
    [collapsed, toggleCollapsed, mobileOpen, ambient, liveProgress],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) {
    throw new Error("useShell must be used inside the app shell layout");
  }
  return value;
}

/**
 * Let a screen drive the ambient field.
 *
 * The field lives in the layout so it never remounts across navigation — the
 * washes are slow and restarting them mid-animation reads as a flicker — but
 * only the session knows who currently holds the floor.
 */
export function useAmbientState(state: SessionPhase) {
  const { setAmbient } = useShell();

  useEffect(() => {
    setAmbient(state);
  }, [setAmbient, state]);

  // Separate effect so the reset runs on unmount only, rather than between
  // every state change.
  useEffect(() => () => setAmbient("idle"), [setAmbient]);
}

/** Publish the running session's counters to the sidebar. */
export function useReportProgress(speakingMinutes: number, corrections: number) {
  const { setLiveProgress } = useShell();

  useEffect(() => {
    setLiveProgress({ speakingMinutes, corrections });
  }, [setLiveProgress, speakingMinutes, corrections]);

  useEffect(() => () => setLiveProgress(null), [setLiveProgress]);
}
