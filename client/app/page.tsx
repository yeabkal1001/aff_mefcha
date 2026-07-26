import { AmbientBackground } from "@/components/session/ambient-background";
import { LandingHero } from "@/components/landing/landing-hero";

/**
 * One call to action, and no sign-up in sight.
 *
 * The headline is the persona's actual problem rather than a feature list —
 * Hana is not afraid of English, she is afraid of speaking it.
 *
 * A server component so the document arrives with the copy already in it. Only
 * the hero is a client island, because only the hero animates.
 */
export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AmbientBackground state="speaking" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <LandingHero />
      </main>
    </div>
  );
}
