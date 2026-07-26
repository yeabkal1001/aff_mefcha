import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AmbientBackground } from "@/components/session/ambient-background";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

/**
 * Clerk's own sign-up.
 *
 * Email verification, password rules and recovery are Clerk's to hold — they
 * are the parts of authentication that are tedious to get right and dangerous
 * to get wrong, and there is nothing about this product that would be better
 * served by our own version of them.
 *
 * The onboarding answers the learner gave before this point are still on the
 * device. `ProfileSync` replays them into the account on the first authenticated
 * render; see `components/profile-sync.tsx`.
 */
export default function SignUpPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <AmbientBackground state="idle" />
      <div className="relative z-10">
        <SignUp fallbackRedirectUrl="/practice" signInUrl="/sign-in" />
      </div>
    </div>
  );
}
