"use client";

import { ArrowRight, Mail } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { AmbientBackground } from "@/components/session/ambient-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboardingDraft } from "@/hooks/use-onboarding-draft";
import { firstSessionGains, sentenceLengthGain } from "@/lib/mock-data";

/**
 * The account, asked for last.
 *
 * Everything before this ran on a draft profile held on the device, so nothing
 * here is a gate — it is a save. The gains are shown first because they are the
 * entire reason to hand over an email: by this point the learner has something
 * to lose. See docs/product/onboarding.md.
 */
export default function SignUpPage() {
  const { name } = useOnboardingDraft();
  const [email, setEmail] = useState("");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AmbientBackground state="idle" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[26rem]"
        >
          <p className="label-eyebrow text-center">Today you improved</p>

          <h1 className="mt-3 text-center text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground">
            {name ? `Good session, ${name}.` : "Good session."}
          </h1>

          <div className="surface-panel mt-7 rounded-2xl px-5 py-4">
            <div className="space-y-2.5">
              {firstSessionGains.map((gain, i) => (
                <motion.div
                  key={gain.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.4 }}
                  className="flex items-center justify-between gap-3 text-[0.8125rem]"
                >
                  <span className="text-foreground/75">{gain.label}</span>
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground/70">
                      {Math.round(gain.from * 100)}%
                    </span>
                    <ArrowRight
                      className="size-3 text-muted-foreground/50"
                      strokeWidth={2.5}
                      aria-label="improved to"
                    />
                    <span className="font-semibold text-coach-correct">
                      {Math.round(gain.to * 100)}%
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>

            <hr className="my-3.5 border-border/70" />

            <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
              <span className="text-foreground/75">Average sentence length</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className="text-muted-foreground/70">
                  {sentenceLengthGain.from} words
                </span>
                <ArrowRight
                  className="size-3 text-muted-foreground/50"
                  strokeWidth={2.5}
                  aria-label="improved to"
                />
                <span className="font-semibold text-coach-correct">
                  {sentenceLengthGain.to} words
                </span>
              </span>
            </div>
          </div>

          <p className="mt-7 text-center text-[0.875rem] leading-relaxed text-foreground/70">
            Save this so tomorrow builds on it. Your coach already knows what to
            bring back.
          </p>

          <form
            className="mt-5 space-y-2.5"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
                strokeWidth={2}
                aria-hidden
              />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="h-12 rounded-xl border-panel-border bg-panel pl-10 text-[0.9375rem] backdrop-blur-xl"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={!email.includes("@")}
              className="h-12 w-full rounded-xl text-[0.9375rem]"
            >
              Save my progress
            </Button>
          </form>

          <p className="mt-5 text-center text-[0.75rem] text-muted-foreground">
            <Link
              href="/practice"
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Keep practising without an account
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
