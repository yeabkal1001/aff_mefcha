"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acquireMic,
  recalibrateMic,
  releaseMic,
  subscribe,
} from "@/lib/mic-engine";
import {
  coachLines,
  corrections,
  dailyProgress,
  type Correction,
  type SessionState,
} from "@/lib/mock-data";

/**
 * How long a turn runs when nobody is actually talking.
 *
 * The fallback, not the mechanism. It covers a blocked microphone and the
 * learner who presses the button and says nothing, so the demo never sticks in
 * `listening` waiting for speech that is not coming.
 */
const MAX_LISTEN_MS = 14_000;
/** Give up waiting for a first word and run the turn anyway. */
const NO_SPEECH_TIMEOUT_MS = 6000;
/** One word of transcript per this long, while speech is actually happening. */
const WORD_MS = 340;
/** How long the coach appears to think before the correction lands. */
const THINK_MS = 1200;
/** How long the coach holds the floor. Long enough to read the correction. */
const SPEAK_MS = 6000;

/**
 * The conversation loop.
 *
 * The turn boundary is real: it ends when the microphone stops hearing the
 * learner, using the voice activity detection in `lib/mic-engine.ts`, which is
 * what the server will do from the transcription stream. Everything after the
 * boundary is still faked — the correction comes from a fixed list rather than
 * an evaluator — but *when* a turn ends is no longer a timer, so the thing the
 * learner controls actually responds to them.
 *
 * The transcript is revealed while speech is detected and finalised when it
 * stops, which is also how Wispr Flow behaves: partial hypotheses during the
 * utterance, a settled transcript at the end of it.
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
  const [micBlocked, setMicBlocked] = useState(false);
  const [micSilent, setMicSilent] = useState(false);
  const [learnerSpeaking, setLearnerSpeaking] = useState(false);

  const turnRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const stateRef = useRef(state);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const after = useCallback((ms: number, run: () => void) => {
    timersRef.current.push(window.setTimeout(run, ms));
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => clearTimers, [clearTimers]);

  // Hold the mic open for the whole session rather than per turn. Reopening it
  // between turns costs a second of stream setup and throws away everything the
  // engine had learned about the room, which is exactly when the learner starts
  // talking again.
  //
  // The dependency is the boolean, not `state`. Depending on `state` re-ran
  // this on every transition, and since the cleanup runs before the next
  // effect, the reference count hit zero on each one and the microphone was
  // torn down and reopened four times a turn.
  const sessionActive = state !== "idle";

  useEffect(() => {
    if (!sessionActive) return;
    acquireMic();
    return releaseMic;
  }, [sessionActive]);

  useEffect(
    () =>
      subscribe((status) => {
        setMicBlocked(status.blocked);
        setMicSilent(status.silent);
        setLearnerSpeaking(status.speaking);
      }),
    [],
  );

  // Speaking time accrues only while the learner is actually making sound. It
  // is the number the progress card calls "Speaking Time", and counting silence
  // toward it would make the one honest metric on that card dishonest.
  useEffect(() => {
    if (!learnerSpeaking || state !== "listening") return;
    const id = window.setInterval(
      () => setSpeakingSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(id);
  }, [learnerSpeaking, state]);

  // The loop is recursive — the coach finishing its turn starts the next one.
  // Bouncing through a ref keeps that legal without a stale closure.
  const runTurnRef = useRef<() => void>(() => {});
  const finishTurnRef = useRef<() => void>(() => {});

  /** End the learner's turn: think, then correct, then hand the floor back. */
  const finishTurn = useCallback(() => {
    if (stateRef.current !== "listening") return;
    clearTimers();

    const turn = turnRef.current;

    // Settle the transcript. During the utterance it is a partial hypothesis;
    // at the end of it the transcriber commits, so the words the correction
    // marks up are the words on screen.
    setTranscript(corrections[turn % corrections.length].said);
    setState("thinking");

    after(THINK_MS, () => {
      turnRef.current = turn + 1;

      setCorrection(corrections[turn % corrections.length]);
      setCorrectionCount((count) => count + 1);
      setCoachLine(coachLines[(turn + 1) % coachLines.length]);
      setState("speaking");

      after(SPEAK_MS, () => runTurnRef.current());
    });
  }, [after, clearTimers]);

  const runTurn = useCallback(() => {
    clearTimers();
    setState("listening");
    setTranscript("");
    setCorrection(null);
    recalibrateMic();

    // Hard ceiling, so a turn always ends even if the room never goes quiet.
    after(MAX_LISTEN_MS, () => finishTurnRef.current());

    // And a shorter one for a learner who never starts, which is the common
    // case on a blocked or muted microphone.
    after(NO_SPEECH_TIMEOUT_MS, () => {
      if (stateRef.current === "listening" && !transcriptStartedRef.current) {
        finishTurnRef.current();
      }
    });
  }, [after, clearTimers]);

  useEffect(() => {
    runTurnRef.current = runTurn;
  }, [runTurn]);

  useEffect(() => {
    finishTurnRef.current = finishTurn;
  }, [finishTurn]);

  // ---- Transcript, paced by actual speech -------------------------------
  //
  // Words appear while the learner is making sound and stop the moment they
  // pause, so the line on screen tracks the voice rather than a stopwatch.
  const transcriptStartedRef = useRef(false);
  const wordIndexRef = useRef(0);

  useEffect(() => {
    if (state !== "listening") {
      transcriptStartedRef.current = false;
      wordIndexRef.current = 0;
      return;
    }
    if (!learnerSpeaking) return;

    transcriptStartedRef.current = true;
    const words = corrections[turnRef.current % corrections.length].said.split(" ");

    const id = window.setInterval(() => {
      if (wordIndexRef.current >= words.length) return;
      const next = words[wordIndexRef.current];
      wordIndexRef.current += 1;
      setTranscript((text) => (text ? `${text} ${next}` : next));
    }, WORD_MS);

    return () => window.clearInterval(id);
  }, [state, learnerSpeaking]);

  // End of speech ends the turn — but only once something was said, so an
  // initial silence does not immediately close a turn that never opened.
  useEffect(() => {
    if (state !== "listening") return;
    if (learnerSpeaking) return;
    if (!transcriptStartedRef.current) return;
    finishTurnRef.current();
  }, [state, learnerSpeaking]);

  /** Hand the floor to the learner, or take it back. */
  const toggleListening = useCallback(() => {
    if (stateRef.current === "listening") {
      clearTimers();
      // Pressing stop mid-sentence is an explicit end of turn, not an abort:
      // the learner said something and expects to hear about it.
      if (transcriptStartedRef.current) finishTurnRef.current();
      else setState("idle");
      return;
    }

    // From idle, or interrupting the coach mid-sentence.
    runTurn();
  }, [clearTimers, runTurn]);

  const endSession = useCallback(() => {
    clearTimers();
    turnRef.current = 0;
    transcriptStartedRef.current = false;
    wordIndexRef.current = 0;
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
    /** Permission refused or no device. Nothing is being recorded. */
    micBlocked,
    /** Permission granted but nothing heard — usually a muted headset. */
    micSilent,
    /** Speech detected right now. */
    learnerSpeaking,
    toggleListening,
    endSession,
    dismissCorrection,
  };
}
