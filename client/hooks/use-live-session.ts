"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { api } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/errors";
import type { Activity, Correction } from "@/lib/api/schemas";
import {
  acquireMic,
  recalibrateMic,
  releaseMic,
  subscribe,
  type MicBlockReason,
} from "@/lib/mic-engine";
import type { SessionPhase } from "@/lib/session/phase";
import { listen, type RecognitionSession } from "@/lib/speech/recognition";
import { speak, type SpeakHandle } from "@/lib/speech/synthesis";

/**
 * The real conversation loop.
 *
 * The learner speaks, the browser transcribes, the server's director answers,
 * the coach's voice says it, and the loop comes back round. Grading happens
 * alongside rather than inside: the reply is what the learner is waiting for,
 * and holding it until the evaluator has finished would add several seconds of
 * silence to every turn for feedback that is not urgent.
 *
 * Async orchestration lives in one function — `runTurn` — rather than being
 * spread across effects keyed on phase. That was the shape of the scripted
 * version and it does not survive contact with real latency: an effect chain
 * has no way to express "if the learner interrupts here, abandon everything
 * downstream", and every await point is a place they can.
 */

/** Never let one exercise run forever, whatever the director thinks. */
const MAX_TURNS = 8;

/**
 * How long to keep listening after the microphone goes quiet.
 *
 * Long enough to survive the pause in the middle of a sentence, short enough
 * that the coach does not feel slow. A learner at A2 pauses to think mid-clause
 * far more than a native speaker, which is why this is well above the 700ms
 * that counts as a pause for scoring.
 */
const END_OF_TURN_SILENCE_MS = 1_800;

/** A turn that produces nothing but silence still has to end. */
const NO_SPEECH_TIMEOUT_MS = 12_000;

/** Hard ceiling on one utterance. */
const MAX_UTTERANCE_MS = 90_000;

export interface LiveSessionOptions {
  activity: Activity;
  /** Called when the exercise finishes, so the page can move to the next one. */
  onComplete?: () => void;
}

export interface LiveSessionState {
  phase: SessionPhase;
  /** What the learner is saying, updated as they say it. */
  transcript: string;
  /** What the coach last said. */
  coachLine: string;
  /** The most recent correction, or null. */
  correction: Correction | null;
  /** How many corrections this session has produced. */
  correctionCount: number;
  /** Seconds in which the learner was actually making sound. */
  speakingSeconds: number;
  turnCount: number;
  micBlocked: boolean;
  micReason: MicBlockReason | null;
  micSilent: boolean;
  learnerSpeaking: boolean;
  /** Set when something failed in a way the learner needs to know about. */
  error: string | null;
  finished: boolean;
}

export function useLiveSession({ activity, onComplete }: LiveSessionOptions) {
  const [state, setState] = useState<LiveSessionState>(() => initial());

  // Everything the async loop needs to read at an await point lives in a ref.
  // Reading it from state would capture the value at the start of the turn,
  // which is several seconds and one possible interruption ago.
  const patch = useCallback((next: Partial<LiveSessionState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const recognition = useRef<RecognitionSession | null>(null);
  const voice = useRef<SpeakHandle | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const speaking = useRef(false);
  const heardSpeech = useRef(false);
  const endTurn = useRef<(() => void) | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  /* -------------------------------------------------------------------------
     Microphone
     ------------------------------------------------------------------------- */

  useEffect(() => {
    const unsubscribe = subscribe((status) => {
      speaking.current = status.speaking;
      patch({
        micBlocked: status.blocked,
        micReason: status.reason,
        micSilent: status.silent,
        learnerSpeaking: status.speaking,
      });

      if (status.speaking) {
        heardSpeech.current = true;
        if (silenceTimer.current) {
          window.clearTimeout(silenceTimer.current);
          silenceTimer.current = null;
        }
        return;
      }

      // Voice stopped. If they have said something, start the clock on the end
      // of the turn — but only start it, because a mid-sentence pause looks
      // exactly like this and must not end anything.
      if (heardSpeech.current && endTurn.current && silenceTimer.current === null) {
        silenceTimer.current = window.setTimeout(() => {
          silenceTimer.current = null;
          endTurn.current?.();
        }, END_OF_TURN_SILENCE_MS);
      }
    });

    return unsubscribe;
  }, [patch]);

  /**
   * Count the seconds the learner actually spends speaking.
   *
   * The one honest number on the progress card, and counting silence toward it
   * is exactly what would make it dishonest.
   */
  useEffect(() => {
    if (!state.learnerSpeaking || state.phase !== "listening") return;
    const timer = window.setInterval(
      () => setState((c) => ({ ...c, speakingSeconds: c.speakingSeconds + 1 })),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [state.learnerSpeaking, state.phase]);

  /* -------------------------------------------------------------------------
     The loop
     ------------------------------------------------------------------------- */

  /** Say something as the coach, and wait for it to finish. */
  const say = useCallback(
    async (line: string, signal: AbortSignal) => {
      patch({ phase: "speaking", coachLine: line });

      const handle = speak(line, { signal });
      voice.current = handle;

      await handle.done;
      voice.current = null;
    },
    [patch],
  );

  /** Listen until the learner stops, or until one of the ceilings is hit. */
  const hear = useCallback(
    (startedAt: number) => {
      patch({ phase: "listening", transcript: "" });
      heardSpeech.current = false;
      recalibrateMic();

      return new Promise<Awaited<ReturnType<RecognitionSession["stop"]>>>((resolve) => {
        let settled = false;

        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(silence);
          window.clearTimeout(ceiling);
          endTurn.current = null;
          const session = recognition.current;
          recognition.current = null;
          if (session) void session.stop().then(resolve);
        };

        endTurn.current = finish;

        recognition.current = listen(
          {
            onPartial: (text) => patch({ transcript: text }),
            onError: (failure) => {
              // `no-speech` resolves itself through the timeout below; the rest
              // mean this browser is not going to transcribe anything and the
              // learner should be told rather than left talking to nothing.
              if (failure === "no-speech") return;
              patch({
                error:
                  failure === "not-supported"
                    ? "This browser can't transcribe speech. Chrome or Edge will work."
                    : "We lost the transcription. Check your connection and try again.",
              });
              finish();
            },
          },
          { startedAt },
        );

        const silence = window.setTimeout(() => {
          if (!heardSpeech.current) finish();
        }, NO_SPEECH_TIMEOUT_MS);

        const ceiling = window.setTimeout(finish, MAX_UTTERANCE_MS);
      });
    },
    [patch],
  );

  /**
   * One exercise, start to finish.
   *
   * Every await checks `signal.aborted` on the way out, because the learner can
   * press stop at any of them and the correct response to that is to stop, not
   * to finish the turn and then notice.
   */
  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;

    const controller = new AbortController();
    abort.current = controller;
    const { signal } = controller;

    try {
      await api.startSession(activity.id, signal);
      if (signal.aborted) return;

      await say(activity.prompt, signal);

      for (let turn = 0; turn < MAX_TURNS; turn += 1) {
        if (signal.aborted) return;

        const finishedSpeakingAt = Date.now();
        const heard = await hear(finishedSpeakingAt);
        if (signal.aborted) return;

        // Nothing said. Not an error — a learner who is thinking, or one whose
        // microphone is blocked and who has already been told so.
        if (!heard.text) {
          patch({ phase: "idle" });
          return;
        }

        patch({ phase: "thinking", transcript: heard.text });

        const reply = await api.submitTurn(
          activity.id,
          {
            transcript: heard.text,
            metrics: heard.metrics,
            // Derived from the content and the position, not random, so a
            // retry of *this* turn replays and a genuinely new turn does not.
            idempotencyKey: await turnKey(activity.id, turn, heard.text),
          },
          signal,
        );
        if (signal.aborted) return;

        // Grading runs alongside the reply. The learner hears the coach while
        // this is in flight, which is the whole reason the two are separate
        // requests: waiting for the evaluator would add real silence to every
        // turn for feedback that can arrive a moment late.
        void grade(reply.turnId, setState);

        await say(reply.coachReply, signal);
        if (signal.aborted) return;

        if (reply.suggestsComplete) break;
      }

      if (signal.aborted) return;

      await api.completeSession(activity.id, signal);
      patch({ phase: "idle", finished: true });
      completeRef.current?.();
    } catch (error) {
      if (signal.aborted) return;
      patch({
        phase: "idle",
        error:
          error instanceof ApiError
            ? error.userMessage
            : "Something went wrong in the conversation. Try again.",
      });
    } finally {
      running.current = false;
      abort.current = null;
    }
  }, [activity.id, activity.prompt, hear, patch, say]);

  /* -------------------------------------------------------------------------
     Controls
     ------------------------------------------------------------------------- */

  /** Tear down everything in flight. Safe to call from anywhere, twice. */
  const teardown = useCallback(() => {
    abort.current?.abort();
    voice.current?.stop();
    voice.current = null;
    recognition.current?.cancel();
    recognition.current = null;
    endTurn.current = null;
    if (silenceTimer.current) {
      window.clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    running.current = false;
  }, []);

  const start = useCallback(() => {
    if (running.current) return;
    setState((current) => ({ ...initial(), speakingSeconds: current.speakingSeconds }));
    void run();
  }, [run]);

  const stop = useCallback(() => {
    teardown();
    patch({ phase: "idle" });
  }, [patch, teardown]);

  /**
   * The one button.
   *
   * While listening it means "I have finished talking", which ends the turn
   * rather than the session — the learner said something and expects an answer.
   * Everywhere else it starts or stops the exercise.
   */
  const toggle = useCallback(() => {
    if (state.phase === "listening" && heardSpeech.current) {
      endTurn.current?.();
      return;
    }
    if (running.current) stop();
    else start();
  }, [start, state.phase, stop]);

  /** Cut the coach off. Pressing this means "I've heard enough". */
  const interrupt = useCallback(() => {
    voice.current?.stop();
  }, []);

  const dismissCorrection = useCallback(
    () => patch({ correction: null }),
    [patch],
  );

  // Hold the microphone for the whole exercise rather than per turn. Reopening
  // it between turns costs a second of stream setup and discards everything the
  // engine learned about the room — precisely when the learner starts talking.
  const active = state.phase !== "idle";
  useEffect(() => {
    if (!active) return;
    acquireMic();
    return releaseMic;
  }, [active]);

  // Abandon on unmount so the server does not keep an exercise open forever
  // because someone closed the tab mid-turn.
  useEffect(() => teardown, [teardown]);

  return {
    ...state,
    speakingMinutes: Math.floor(state.speakingSeconds / 60),
    start,
    stop,
    toggle,
    interrupt,
    dismissCorrection,
  };
}

/**
 * Grade a turn, and never let its failure reach the conversation.
 *
 * The learner has already heard the reply by the time this resolves. A failed
 * evaluation costs them the correction for one turn — the attempt row is simply
 * not written, and the next turn is graded normally. Surfacing it as an error
 * would interrupt a working conversation to report something that did not
 * affect it.
 */
async function grade(
  turnId: string,
  update: Dispatch<SetStateAction<LiveSessionState>>,
) {
  try {
    const evaluation = await api.evaluateTurn(turnId);
    const correction = evaluation.corrections[0];
    if (!correction) return;

    // Counted from what the evaluator actually returned, not from the number of
    // turns, so the sidebar's figure and the corrections list cannot disagree.
    update((current) => ({
      ...current,
      correction,
      correctionCount: current.correctionCount + evaluation.corrections.length,
    }));
  } catch {
    // Deliberately silent. See above.
  }
}

/**
 * A stable key for one turn.
 *
 * Hashed from the utterance and its position so that a retry of the same turn
 * replays the stored response, while a learner who repeats themselves verbatim
 * on the next turn still gets a new one. A random key would defeat the point;
 * the transcript alone would collapse two identical turns into one.
 */
async function turnKey(sessionId: string, index: number, text: string): Promise<string> {
  const input = `${sessionId}:${index}:${text}`;

  if (typeof crypto?.subtle?.digest === "function") {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest).slice(0, 16))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Insecure contexts have no SubtleCrypto. The key only has to be stable and
  // collision-resistant enough for one learner's own turns.
  let hash = 0;
  for (const character of input) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return `${sessionId}-${index}-${(hash >>> 0).toString(16)}`;
}

function initial(): LiveSessionState {
  return {
    phase: "idle",
    transcript: "",
    coachLine: "",
    correction: null,
    correctionCount: 0,
    speakingSeconds: 0,
    turnCount: 0,
    micBlocked: false,
    micReason: null,
    micSilent: false,
    learnerSpeaking: false,
    error: null,
    finished: false,
  };
}
