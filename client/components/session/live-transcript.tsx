"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * What the learner is saying, as they say it.
 *
 * This is the Wispr Flow track — the low-latency, cleaned-up transcript meant
 * to be read. The verbatim fal Whisper track is never shown here; the gap
 * between the two is what the correction card is made of, so putting the
 * verbatim words on screen mid-turn would give the correction away.
 *
 * Words arrive one at a time and the last one stays dim for a beat, because a
 * transcript that lands fully formed reads as a caption rather than as
 * something being heard right now.
 */
export function LiveTranscript({ text }: { text: string }) {
  const words = text.split(" ").filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.3 }}
      className="flex w-full flex-col items-center"
      aria-live="polite"
      aria-atomic="false"
    >
      <p className="label-eyebrow flex items-center gap-1.5">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-coach-error/70" />
          <span className="relative inline-flex size-1.5 rounded-full bg-coach-error" />
        </span>
        Listening
      </p>

      <p className="mt-4 max-w-[34rem] text-center text-[1.375rem] font-medium leading-snug tracking-tight text-foreground/75">
        <AnimatePresence initial={false}>
          {words.map((word, i) => (
            <motion.span
              key={`${i}-${word}`}
              initial={{ opacity: 0, filter: "blur(5px)" }}
              animate={{
                opacity: i === words.length - 1 ? 0.55 : 1,
                filter: "blur(0px)",
              }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {word}{" "}
            </motion.span>
          ))}
        </AnimatePresence>

        {/* A caret so the line reads as unfinished even between words. */}
        <motion.span
          aria-hidden
          className="inline-block h-[1.1em] w-[2px] translate-y-[0.15em] rounded-full bg-foreground/40"
          animate={{ opacity: [1, 1, 0, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
        />
      </p>
    </motion.div>
  );
}
