import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AmbientBackground } from "@/components/session/ambient-background";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Clerk's own sign-in, on our background.
 *
 * A catch-all segment because Clerk routes its own sub-steps — factor two,
 * password reset, the verification code — as child paths of this one. Pinning
 * it to a single route would 404 on the second step of every recovery flow.
 */
export default function SignInPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      <AmbientBackground state="idle" />
      <div className="relative z-10">
        <SignIn
          // Back to practice rather than to the landing page: someone signing
          // in came here to work, and the extra click is a click.
          fallbackRedirectUrl="/practice"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
}
