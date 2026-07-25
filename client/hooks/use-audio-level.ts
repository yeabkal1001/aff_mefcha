"use client";

import { useEffect, useRef, useState } from "react";

import {
  acquireMic,
  getMicLevel,
  releaseMic,
  subscribe,
  type MicStatus,
} from "@/lib/mic-engine";
import type { SessionState } from "@/lib/mock-data";

/**
 * A 0..1 loudness signal for whatever is making noise right now.
 *
 * While the learner speaks this is the real microphone, calibrated against the
 * room by `lib/mic-engine.ts`. While the coach speaks there is no audio element
 * yet, so the level is synthesised into something with the cadence of speech.
 *
 * If the microphone is *blocked* the coach side is still synthesised but the
 * learner side is not: a dead orb looks broken, but an orb that dances while
 * nothing is being recorded is worse, because the learner has no way to find
 * out that four minutes of speech went nowhere. `micBlocked` and `micSilent`
 * exist to be shown.
 *
 * The value comes back as a ref rather than state on purpose. It changes every
 * frame, and re-rendering React 60 times a second to move a gradient would be
 * wasteful. Consumers read the ref inside their own animation loop.
 */
export function useAudioLevel(state: SessionState) {
  const levelRef = useRef(0);
  const stateRef = useRef(state);
  const [mic, setMic] = useState<MicStatus>({
    blocked: false,
    silent: false,
    speaking: false,
    everHeard: false,
  });
  const micRef = useRef(mic);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    micRef.current = mic;
  }, [mic]);

  useEffect(() => subscribe(setMic), []);

  // The microphone is only held while the learner actually has the floor.
  useEffect(() => {
    if (state !== "listening") return;
    acquireMic();
    return releaseMic;
  }, [state]);

  // One long-lived smoothing loop, mounted once. It reads the current state
  // from a ref so that changing state never restarts it.
  useEffect(() => {
    let raf = 0;
    let smoothed = 0;

    const tick = () => {
      const now = performance.now() / 1000;

      let target: number;
      switch (stateRef.current) {
        case "listening":
          // A blocked mic gets a gentle idle pulse rather than a fake voice, so
          // the orb reads as "alive but not hearing you" instead of lying.
          target = micRef.current.blocked
            ? 0.08 + 0.04 * Math.sin(now * 2.1)
            : getMicLevel();
          break;
        case "speaking":
          target = synthesiseSpeech(now, 1);
          break;
        case "thinking":
          // A slow, low breath — present, but clearly not talking.
          target = 0.1 + 0.05 * Math.sin(now * 2.4);
          break;
        default:
          target = 0;
      }

      // Rise quickly, fall slowly. Speech is full of tiny gaps and a symmetric
      // filter makes the orb flicker through every one of them.
      smoothed += (target - smoothed) * (target > smoothed ? 0.34 : 0.08);
      levelRef.current = smoothed;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    levelRef,
    micBlocked: mic.blocked,
    /** Stream open, permission granted, and still nothing heard. A muted headset. */
    micSilent: mic.silent,
    /** Speech detected right now. */
    micSpeaking: mic.speaking,
    micEverHeard: mic.everHeard,
  };
}

/**
 * Fake a voice. Three oscillators at unrelated rates — a syllable gate, a
 * phrase-length swell, and a fine jitter — plus an occasional breath. None of
 * it is meaningful signal; it only has to move like a person talking.
 */
function synthesiseSpeech(now: number, gain: number): number {
  const syllable = Math.pow(Math.max(0, Math.sin(now * 8.5)), 0.55);
  const phrase = 0.55 + 0.45 * Math.sin(now * 1.7 + 0.6);
  const jitter = 0.85 + 0.15 * Math.sin(now * 19.3);
  const breath = Math.sin(now * 0.6) > -0.85 ? 1 : 0.15;

  return Math.min(1, (0.18 + 0.7 * syllable * phrase * jitter) * breath * gain);
}
