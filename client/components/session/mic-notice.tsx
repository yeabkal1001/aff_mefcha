"use client";

import { MicOff, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { retryMic, type MicBlockReason } from "@/lib/mic-engine";
import { Button } from "@/components/ui/button";

/**
 * What to tell the learner, per reason they cannot be heard.
 *
 * Every one of these is a different fix, and the generic "allow access in your
 * address bar" is wrong advice for four of the six — there is no prompt to
 * allow when the device is missing, busy, or the page is not on HTTPS.
 */
const BLOCKED_COPY: Record<MicBlockReason, string> = {
  denied:
    "Your microphone is blocked, so nothing you say is being heard. Allow access from the icon in your browser's address bar, then try again.",
  "no-device":
    "No microphone was found. Plug one in or connect a headset — this page will pick it up on its own.",
  "in-use":
    "Another app is using your microphone. Close it — a call or a recorder is the usual culprit — then try again.",
  insecure:
    "This page isn't on a secure connection, and browsers only allow microphone access over HTTPS. Open it at its https:// address.",
  timeout:
    "The microphone permission prompt wasn't answered. Try again and choose Allow.",
  unknown:
    "Your microphone couldn't be opened, so nothing you say is being heard. Try again, or switch to another browser if it keeps failing.",
};

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
  reason,
  silent,
}: {
  blocked: boolean;
  reason: MicBlockReason | null;
  silent: boolean;
}) {
  const message = blocked
    ? {
        icon: MicOff,
        text: BLOCKED_COPY[reason ?? "unknown"],
        // Nothing to retry on an insecure origin: the API is absent until the
        // URL changes, so offering a button that cannot work is worse than
        // offering none.
        retry: reason !== "insecure",
      }
    : silent
      ? {
          icon: TriangleAlert,
          text: "Your microphone is on but silent. Check it isn't muted or set to the wrong device.",
          retry: true,
        }
      : null;

  return (
    // The live region is always mounted, and only its contents change. A
    // region that appears at the same moment as its text is usually missed:
    // screen readers watch regions that already exist, so mounting the two
    // together announces nothing — which for this particular message would
    // mean a blind learner is the one who finds out four minutes later.
    <div role="status" aria-live="polite" className="contents">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-auto flex max-w-[30rem] items-start gap-2.5 rounded-xl bg-coach-error/[0.08] px-3.5 py-2.5"
          >
            <message.icon
              className="mt-[2px] size-3.5 shrink-0 text-coach-error"
              strokeWidth={2.2}
              aria-hidden
            />
            <div className="flex flex-col items-start gap-1.5">
              <p className="text-ui leading-snug text-foreground/80">
                {message.text}
              </p>
              {message.retry && (
                <Button size="xs" variant="outline" onClick={retryMic}>
                  Try again
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
