import type { Metadata } from "next";

import { AmbientBackground } from "@/components/session/ambient-background";
import { StatusScreen } from "@/components/shell/status-screen";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground state="idle" />
      <StatusScreen
        eyebrow="404"
        title="There's nothing to practise here."
        body="That page doesn't exist. Your progress is safe — pick up where you left off."
        action={{ label: "Back to practice", href: "/practice" }}
      />
    </div>
  );
}
