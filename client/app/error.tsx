"use client";

import { useEffect } from "react";

import { AmbientBackground } from "@/components/session/ambient-background";
import { StatusScreen } from "@/components/shell/status-screen";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only place a client crash is visible today. When there is a
    // reporter, this is where it goes.
    console.error("Unhandled error", error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground state="idle" />
      <StatusScreen
        eyebrow="Something broke"
        title="Your coach lost its thread."
        body="Nothing you said was lost. Try that again, and if it keeps happening, start a fresh session."
        onRetry={{ label: "Try again", run: reset }}
        action={{ label: "Back to practice", href: "/practice" }}
      />
    </div>
  );
}
