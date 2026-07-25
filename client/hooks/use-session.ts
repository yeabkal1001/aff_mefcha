"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  coachLines,
  corrections,
  dailyProgress,
  type Correction,
  type SessionState,
} from "@/lib/mock-data";

/** How long the learner gets the floor before the coach evaluates the turn. */
const LISTEN_MS = 7000;
/** Silence before the first word lands, so the turn does not start mid-sentence. */
const TRANSCRIPT_LEAD_MS = 900;
/** Silence after the last word, standing in for end-of-speech detection. */
const TRANSCRIPT_TAIL_MS = 700;
/** How long the coach appears to think before the correction lands. */
const THINK_MS = 1200;
/** How long the coach holds the floor. Long enough to read the correction. */
const SPEAK_MS = 6000;

/**
 * The conversation loop, faked on timers.
 *
 * Real sessions will be driven by the server: the turn ends when transcription
 * detects silence, and the correction arrives from the evaluator. Until then
 * the same four states cycle on a clock, which is enough to build and demo the
 * entire UI. Swapping the timers for socket events should not touch a
 * component.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>("idle");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [coachLine, setCoachLine] = useState(coachLines[0]);
  const [speakingSeconds, setSpeakingSeconds] = useState(
    dailyProgress.speakingMinutes * 60,
  );
  const [correctionCount, setCorrectionCount] = useState(
    dailyProgress.corrections,
  );
  const [transcript, setTranscript] = useState("");

  const turnRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const after = useCallback((ms: number, run: () => void) => {
    timersRef.current.push(window.setTimeout(run, ms));
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Speaking time only accrues while the learner actually has the floor.
  useEffect(() => {
    if (state !== "listening") return;
    const id = window.setInterval(
      () => setSpeakingSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(id);
  }, [state]);

  // The loop is recursive — the coach finishing its turn starts the next one.
  // Bouncing through a ref keeps that legal without a stale closure.
  const runTurnRef = useRef<() => void>(() => {});

  const runTurn = useCallback(() => {
    setState("listening");
    setTranscript("");

    // The learner "says" the sentence the coach is about to correct, revealed a
    // word at a time. Driving both from the same string is the point: the words
    // on screen during the turn are the words marked up a moment later, so the
    // demo shows a correction landing on speech rather than on a coincidence.
    const words = corrections[turnRef.current % corrections.length].said.split(" ");
    const gap = (LISTEN_MS - TRANSCRIPT_LEAD_MS - TRANSCRIPT_TAIL_MS) / words.length;

    words.forEach((word, i) => {
      after(TRANSCRIPT_LEAD_MS + gap * i, () =>
        setTranscript((text) => (text ? `${text} ${word}` : word)),
      );
    });

    after(LISTEN_MS, () => {
      setState("thinking");

      after(THINK_MS, () => {
        const turn = turnRef.current;
        turnRef.current = turn + 1;

        setCorrection(corrections[turn % corrections.length]);
        setCorrectionCount((count) => count + 1);
        setCoachLine(coachLines[(turn + 1) % coachLines.length]);
        setState("speaking");

        after(SPEAK_MS, () => runTurnRef.current());
      });
    });
  }, [after]);

  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

  /** Hand the floor to the learner, or take it back. */
  const toggleListening = useCallback(() => {
    clearTimers();

    if (state === "idle") {
      runTurn();
      return;
    }

    if (state === "listening") {
      setState("idle");
      return;
    }

    // Interrupting the coach mid-sentence hands the floor straight back.
    runTurn();
  }, [clearTimers, runTurn, state]);

  const endSession = useCallback(() => {
    clearTimers();
    turnRef.current = 0;
    setCorrection(null);
    setTranscript("");
    setCoachLine(coachLines[0]);
    setState("idle");
  }, [clearTimers]);

  const dismissCorrection = useCallback(() => setCorrection(null), []);

  return {
    state,
    correction,
    coachLine,
    /** The Wispr Flow track, as far as it has got this turn. */
    transcript,
    /** Whole minutes spoken today, for the progress card. */
    speakingMinutes: Math.floor(speakingSeconds / 60),
    correctionCount,
    toggleListening,
    endSession,
    dismissCorrection,
  };
}
