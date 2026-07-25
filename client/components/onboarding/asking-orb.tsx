"use client";

import { useEffect, useState } from "react";

import { VoiceOrb } from "@/components/session/voice-orb";
import type { SessionState } from "@/lib/mock-data";

/**
 * The coach, mid-question. Speaks briefly when it mounts and then settles.
 *
 * Mount it with a `key` tied to the step so each new question re-triggers the
 * speaking state without any of the effect gymnastics that re-running it in
 * place would need.
 */
export function AskingOrb({ className }: { className?: string }) {
  const [state, setState] = useState<SessionState>("speaking");

  useEffect(() => {
    const timer = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(timer);
  }, []);

  return <VoiceOrb state={state} className={className} />;
}
