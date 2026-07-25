"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionState } from "@/lib/mock-data";

/**
 * A 0..1 loudness signal for whatever is making noise right now.
 *
 * While the learner speaks this is the real microphone, read as RMS off an
 * analyser node. While the coach speaks there is no audio element yet, so the
 * level is synthesised into something with the cadence of speech. If the
 * learner refuses the microphone we synthesise that side too — a dead orb
 * looks broken, and the fallback is indistinguishable at a glance.
 *
 * The value comes back as a ref rather than state on purpose. It changes every
 * frame, and re-rendering React 60 times a second to move a gradient would be
 * wasteful. Consumers read the ref inside their own animation loop.
 */
export function useAudioLevel(state: SessionState) {
  const levelRef = useRef(0);
  const micLevelRef = useRef(0);
  const micBlockedRef = useRef(false);
  const stateRef = useRef(state);
  const [micBlocked, setMicBlocked] = useState(false);

  useEffect(() => {
    stateRef.current = state;
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
          target = micBlockedRef.current
            ? synthesiseSpeech(now, 0.55)
            : micLevelRef.current;
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
      smoothed += (target - smoothed) * (target > smoothed ? 0.32 : 0.07);
      levelRef.current = smoothed;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // The microphone is only held open while the learner actually has the floor.
  useEffect(() => {
    if (state !== "listening") return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let raf = 0;

    const start = async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices) {
          throw new Error("No media devices available");
        }

        const granted = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (cancelled) {
          granted.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = granted;

        micBlockedRef.current = false;
        setMicBlocked(false);

        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        context.createMediaStreamSource(stream).connect(analyser);

        const samples = new Uint8Array(analyser.fftSize);

        const measure = () => {
          analyser.getByteTimeDomainData(samples);

          let sum = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const deviation = (samples[i] - 128) / 128;
            sum += deviation * deviation;
          }
          const rms = Math.sqrt(sum / samples.length);

          // Gate out room tone, then lift the usable range into 0..1.
          micLevelRef.current = rms < 0.015 ? 0 : Math.min(1, rms * 3.4);
          raf = requestAnimationFrame(measure);
        };

        measure();
      } catch {
        if (cancelled) return;
        micBlockedRef.current = true;
        setMicBlocked(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      micLevelRef.current = 0;
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [state]);

  return { levelRef, micBlocked };
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
