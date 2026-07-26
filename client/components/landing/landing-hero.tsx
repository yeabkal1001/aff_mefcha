"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import BlurText from "@/components/BlurText";
import { VoiceOrb } from "@/components/session/voice-orb";
import { Button } from "@/components/ui/button";

/**
 * The animated half of the landing page.
 *
 * The headline is one `<h1>` in two lines: the first states the belief the
 * learner arrived with, the second corrects it. Splitting them into two
 * headings would claim they are separate ideas, and greying the second line is
 * the whole rhetorical move.
 */
export function LandingHero() {
  return (
    <>
      <VoiceOrb state="speaking" className="[--orb-size:clamp(6.5rem,22vw,9rem)]" />

      <h1 className="mt-10 flex flex-col items-center sm:mt-12">
        <BlurText
          as="span"
          text="You're not afraid of English."
          animateBy="words"
          delay={80}
          stepDuration={0.32}
          className="justify-center text-display font-semibold tracking-tight text-balance text-foreground"
        />
        <BlurText
          as="span"
          text="You're afraid of speaking it."
          animateBy="words"
          delay={80}
          stepDuration={0.32}
          className="justify-center text-display font-semibold tracking-tight text-balance text-foreground/40"
        />
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6 }}
        className="mt-6 max-w-[30rem] text-body leading-relaxed text-balance text-muted-foreground"
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
        <Button asChild size="lg" className="h-12 rounded-full px-8 text-body">
          <Link href="/onboarding">
            Start speaking
            <ArrowRight className="size-4" strokeWidth={2.25} />
          </Link>
        </Button>
        <p className="text-caption text-muted-foreground">
          No account. Your first conversation starts in about a minute.
        </p>
      </motion.div>
    </>
  );
}
