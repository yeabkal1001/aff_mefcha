"use client";

import { motion } from "motion/react";

import BlurText from "@/components/BlurText";

/**
 * The line under the orb before the first turn. Uses the React Bits blur
 * reveal so the coach's greeting arrives a word at a time, like speech.
 */
export function CoachGreeting({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.35 }}
    >
      <BlurText
        text={text}
        animateBy="words"
        direction="top"
        delay={70}
        stepDuration={0.3}
        className="justify-center text-center text-[1.6rem] font-semibold leading-tight tracking-tight text-foreground/45"
      />
    </motion.div>
  );
}
