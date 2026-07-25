"use client";

import { MicOff, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Says out loud that nothing is being recorded.
 *
 * The orb is deliberately alive in every state, which is right for a coaching
 * product and wrong here: an animated orb over a blocked microphone tells the
 * learner they are being heard when they are not, and they find out four
 * minutes later. Whenever the mic cannot do its job, something on screen has
 * to say so in words.
 */
export function MicNotice({
  blocked,
  silent,
}: {
  blocked: boolean;
  silent: boolean;
}) {
  const message = blocked
    ? {
        icon: MicOff,
        text: "Your microphone is blocked, so nothing you say is being heard. Allow access in your browser's address bar, then try again.",
      }
    : silent
      ? {
          icon: TriangleAlert,
          text: "Your microphone is on but silent. Check it isn't muted or set to the wrong device.",
        }
      : null;

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          role="status"
          className="mx-auto flex max-w-[30rem] items-start gap-2.5 rounded-xl bg-coach-error/[0.08] px-3.5 py-2.5"
        >
          <message.icon
            className="mt-[2px] size-3.5 shrink-0 text-coach-error"
            strokeWidth={2.2}
          />
          <p className="text-[0.8125rem] leading-snug text-foreground/80">
            {message.text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
