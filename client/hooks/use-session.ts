"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  finaliseSession,
  getCoachLine,
  getCorrection,
  postTurn,
  speak,
  transcribe,
  type SessionOutcomeResponse,
  type TurnResponse,
} from "@/lib/api";
import { LiveSpeech } from "@/lib/live-speech";
import type { Correction, SessionState } from "@/lib/mock-data";
import { TurnRecorder } from "@/lib/recorder";

/** Hard ceiling so a forgotten mic does not burn Whisper credits forever. */
const MAX_LISTEN_MS = 45_000;

export interface UseSessionOptions {
  sessionId: string | null;
  /** Spoken once when the session is ready, before the learner has the floor. */
  openingLine: string;
}

/**
 * The real conversation loop.
 *
 * Tap to start recording. The on-screen caption is the browser's SpeechRecognition
 * (display only). Tap again to stop — the recording goes to Whisper for the graded
 * track with word timestamps, then to the evaluator, then the coach speaks.
 */
export function useSession({ sessionId, openingLine }: UseSessionOptions) {
  const [state, setState] = useState<SessionState>("idle");
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [coachLine, setCoachLine] = useState(openingLine);
  const [transcript, setTranscript] = useState("");
  const [speakingSeconds, setSpeakingSeconds] = useState(0);
  const [correctionCount, setCorrectionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SessionOutcomeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const recorderRef = useRef<TurnRecorder | null>(null);
  const liveRef = useRef<LiveSpeech | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scaffoldRef = useRef(0);
  const listenTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    setCoachLine(openingLine);
  }, [openingLine]);

  useEffect(() => {
    return () => {
      liveRef.current?.stop();
      void recorderRef.current?.stop();
      if (listenTimerRef.current) window.clearTimeout(listenTimerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (state !== "listening") return;
    const id = window.setInterval(
      () => setSpeakingSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(id);
  }, [state]);

  const playUrl = useCallback(async (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
    } catch {
      // Autoplay blocked or decode failed — the text is already on screen.
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (busy) return;
    const id = sessionIdRef.current;
    if (!id) {
      setError("no session loaded yet");
      return;
    }

    setBusy(true);
    setError(null);
    if (listenTimerRef.current) {
      window.clearTimeout(listenTimerRef.current);
      listenTimerRef.current = null;
    }
    liveRef.current?.stop();
    setState("thinking");

    // Capture the live caption before we clear anything — if Whisper's GPUs
    // are down and Gemini also fails, we still have something to grade.
    const liveCaption = transcript.trim();

    try {
      const blob = (await recorderRef.current?.stop()) ?? new Blob();
      recorderRef.current = null;

      if (blob.size < 256 && !liveCaption) {
        setError("I did not catch any audio — try again a little louder.");
        setState("idle");
        return;
      }

      // Graded track. Word timestamps are what Confidence and Fluency are measured from.
      let gradedText = liveCaption;
      let gradedWords: { text: string; start: number; end: number }[] = [];

      if (blob.size >= 256) {
        try {
          const graded = await transcribe(blob, "en");
          if (graded.text.trim()) {
            gradedText = graded.text.trim();
            gradedWords = graded.words;
          }
        } catch (err) {
          if (!liveCaption) throw err;
          // PROP: live caption only — metrics will be empty this turn, but
          // grammar judgement still runs off the verbatim text.
          setError(
            "Whisper was unavailable, so I graded from the live caption instead.",
          );
        }
      }

      if (!gradedText) {
        setError("I did not catch any speech — try again.");
        setState("idle");
        return;
      }

      setTranscript(gradedText);

      const turn: TurnResponse = await postTurn(id, {
        transcript_verbatim: gradedText,
        transcript_clean: gradedText,
        words: gradedWords,
        scaffold_level: scaffoldRef.current,
      });

      const hint = turn.corrections[0] ?? null;
      let nextCorrection: Correction | null = null;

      if (hint) {
        let why = `Try saying "${hint.right}" instead of "${hint.wrong}".`;
        try {
          const amharic = await getCorrection(hint.right, hint.wrong);
          if (amharic.amharic) why = amharic.amharic;
        } catch {
          // English why is enough to keep the card honest.
        }

        nextCorrection = {
          id: `${turn.turn_id}-${hint.tag}`,
          said: gradedText,
          errorSpan: findSpan(gradedText, hint.wrong) ?? hint.wrong,
          corrected: hint.right,
          why,
        };
        setCorrection(nextCorrection);
        setCorrectionCount((count) => count + 1);
      } else {
        setCorrection(null);
      }

      if (turn.retry_needed.length > 0 && !turn.retries_exhausted) {
        scaffoldRef.current = Math.min(scaffoldRef.current + 1, 2);
      }

      let line =
        turn.scaffold_prompt ??
        (hint
          ? `Nice try — say it again: "${hint.right}".`
          : "Good. Tell me a little more.");

      try {
        const coach = await getCoachLine(id, gradedText);
        if (coach.english?.trim()) line = coach.english.trim();
      } catch {
        // Scaffold / fallback line already set.
      }

      setCoachLine(line);
      setState("speaking");

      try {
        const url = await speak(line, "en");
        await playUrl(url);
      } catch {
        // Text is already visible.
      }

      setState("idle");
    } catch (err) {
      setState("idle");
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "something went wrong on that turn",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, playUrl]);

  const startListening = useCallback(async () => {
    if (busy || !sessionIdRef.current) return;
    setError(null);
    setCorrection(null);
    setTranscript("");

    try {
      const recorder = new TurnRecorder();
      await recorder.start();
      recorderRef.current = recorder;

      const live = new LiveSpeech((text) => setTranscript(text));
      liveRef.current = live;
      live.start("en-US");

      setState("listening");
      listenTimerRef.current = window.setTimeout(() => {
        void stopListening();
      }, MAX_LISTEN_MS);
    } catch {
      setError("Microphone access is needed to practise. Allow it and try again.");
      setState("idle");
    }
  }, [busy, stopListening]);

  const toggleListening = useCallback(() => {
    if (busy) return;
    if (state === "listening") {
      void stopListening();
      return;
    }
    if (state === "idle" || state === "speaking") {
      void startListening();
    }
  }, [busy, startListening, state, stopListening]);

  const endSession = useCallback(async () => {
    liveRef.current?.stop();
    if (listenTimerRef.current) window.clearTimeout(listenTimerRef.current);
    await recorderRef.current?.stop();
    recorderRef.current = null;
    setState("idle");
    setCorrection(null);
    setTranscript("");

    const id = sessionIdRef.current;
    if (!id) return;
    try {
      setOutcome(await finaliseSession(id));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "could not save the session",
      );
    }
  }, []);

  const dismissCorrection = useCallback(() => setCorrection(null), []);

  return {
    state,
    correction,
    coachLine,
    transcript,
    speakingMinutes: Math.floor(speakingSeconds / 60),
    correctionCount,
    error,
    busy,
    outcome,
    toggleListening,
    endSession,
    dismissCorrection,
  };
}

/** Prefer a span that actually appears in what was said; fall back to the authored wrong. */
function findSpan(said: string, wrong: string): string | null {
  if (!wrong) return null;
  if (said.toLowerCase().includes(wrong.toLowerCase())) {
    const at = said.toLowerCase().indexOf(wrong.toLowerCase());
    return said.slice(at, at + wrong.length);
  }
  // Authored forms are often full clauses; try the last few content words.
  const words = wrong.split(/\s+/).filter(Boolean);
  for (let n = Math.min(4, words.length); n >= 2; n--) {
    const slice = words.slice(-n).join(" ");
    if (said.toLowerCase().includes(slice.toLowerCase())) {
      const at = said.toLowerCase().indexOf(slice.toLowerCase());
      return said.slice(at, at + slice.length);
    }
  }
  return null;
}
