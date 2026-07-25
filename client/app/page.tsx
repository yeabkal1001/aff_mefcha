"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import BlurText from "@/components/BlurText";
import { AmbientBackground } from "@/components/session/ambient-background";
import { VoiceOrb } from "@/components/session/voice-orb";
import { Button } from "@/components/ui/button";

/**
 * One call to action, and no sign-up in sight.
 *
 * The headline is the persona's actual problem rather than a feature list —
 * Hana is not afraid of English, she is afraid of speaking it.
 */
export default function LandingPage() {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <AmbientBackground state="speaking" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <VoiceOrb state="speaking" className="[--orb-size:9rem]" />

        <BlurText
          text="You're not afraid of English."
          animateBy="words"
          delay={80}
          stepDuration={0.32}
          className="mt-12 justify-center text-[2rem] font-semibold leading-tight tracking-tight text-foreground"
        />
        <BlurText
          text="You're afraid of speaking it."
          animateBy="words"
          delay={80}
          stepDuration={0.32}
          className="justify-center text-[2rem] font-semibold leading-tight tracking-tight text-foreground/40"
        />

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
          className="mt-6 max-w-[30rem] text-[0.9375rem] leading-relaxed text-muted-foreground"
        >
          An AI coach that talks with you, catches what you get wrong the moment
          you say it, and explains why in your own language.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.6 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full px-8 text-[0.9375rem]"
          >
            <Link href="/onboarding">
              Start speaking
              <ArrowRight className="size-4" strokeWidth={2.25} />
            </Link>
          </Button>
          <p className="text-[0.75rem] text-muted-foreground">
            No account. Your first conversation starts in about a minute.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
