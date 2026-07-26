"use client";

import { SignUpButton, useAuth } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { AmbientBackground } from "@/components/session/ambient-background";
import { Button } from "@/components/ui/button";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { buildLearnerProfile } from "@/lib/learner-profile";

/**
 * The account, asked for last.
 *
 * Everything before this ran on a draft profile held on the device, so nothing
 * here is a gate — it is a save. What the learner is about to lose is shown
 * first, because by this point they have something to lose. See
 * docs/product/onboarding.md.
 *
 * The panel deliberately does not show scores. Before an account exists there
 * are no graded turns behind them, and a page of confident percentages derived
 * from an eleven-question form would be the one dishonest screen in the
 * product. What it shows instead is what was set up, which is true.
 */
export default function SaveProgressPage() {
  const draft = useOnboardingDraft();
  const profile = useMemo(() => buildLearnerProfile(draft), [draft]);

  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  // Someone who is already signed in has nothing to save. They reach this URL
  // by walking back through onboarding or from a stale tab, and the right
  // answer is the Day Plan, not a second invitation to create the account they
  // already have.
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/practice");
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AmbientBackground state="idle" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[26rem]"
        >
          <p className="label-eyebrow text-center">Your coach is ready</p>

          <h1 className="mt-3 text-center text-display-sm font-semibold tracking-tight text-balance text-foreground">
            {profile.name ? `Good to meet you, ${profile.name}.` : "Good to meet you."}
          </h1>

          <div className="surface-panel mt-7 rounded-2xl px-5 py-4">
            <dl className="space-y-2.5">
              <Row label="Practising for" value={profile.lifePath.name} />
              <Row
                label="Starting level"
                value={
                  profile.placed
                    ? profile.cefr
                    : `${profile.cefr} — to be confirmed`
                }
              />
              <Row label="Each day" value={`${profile.budget.minutes} minutes`} />
              <Row
                label="Measured on"
                // The four fixed Skills. Nothing else becomes a dimension.
                value="Grammar, Vocabulary, Fluency, Sentence structure"
              />
            </dl>
          </div>

          <p className="mt-7 text-center text-body leading-relaxed text-balance text-foreground/70">
            Save this so tomorrow builds on it. Your coach already knows what to
            bring back.
          </p>

          <div className="mt-5">
            {/* Straight into the first Day Plan afterwards. `force` rather than
                `fallback` because Clerk otherwise honours a stale redirect it
                remembered from an earlier visit to the sign-in page. */}
            <SignUpButton mode="modal" forceRedirectUrl="/practice">
              <Button size="lg" className="h-12 w-full rounded-xl text-body">
                Create my account
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </Button>
            </SignUpButton>
          </div>

          <p className="mt-5 text-center text-caption text-muted-foreground">
            <Link
              href="/sign-in?redirect_url=/practice"
              className="rounded-sm underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              I already have an account
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-ui">
      <dt className="text-foreground/75">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
