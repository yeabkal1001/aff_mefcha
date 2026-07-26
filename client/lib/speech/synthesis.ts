import { api } from "@/lib/api/endpoints";

import { beginCoachVoice, endCoachVoice, setCoachLevel } from "./coach-level";

/**
 * The coach's voice, and the signal the orb pulses to.
 *
 * Two routes, chosen at call time.
 *
 * When the server has ElevenLabs configured, the reply comes back as audio
 * bytes. Those go through an `AnalyserNode`, so the level the orb receives is
 * the actual amplitude of the actual voice, sampled every frame. That is the
 * one that looks alive.
 *
 * Otherwise the browser's own `speechSynthesis` speaks it. That API hands out
 * no audio stream at all — there is nothing to analyse, by design — so the
 * level is synthesised from `boundary` events, which fire per word. The orb
 * then pulses once per word, in time with the speech, which is a real
 * correspondence rather than a loop playing regardless.
 *
 * Both report through the same callback, so nothing downstream knows or cares
 * which one is speaking.
 */

export type SpeechRoute = "server" | "browser" | "none";

export interface SpeakHandle {
  /** Resolves when the coach has finished, or when `stop` is called. */
  done: Promise<void>;
  /** Cut the coach off — the learner pressed the button. */
  stop: () => void;
  /** Which route actually spoke, for the caller that wants to say so. */
  route: SpeechRoute;
}

export interface SpeakOptions {
  /** 0..1, roughly every animation frame while speaking. Drives the orb. */
  onLevel?: (level: number) => void;
  /** Skip the network and use the browser voice. */
  preferBrowser?: boolean;
  signal?: AbortSignal;
}

export function isBrowserSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * One shared `AudioContext`.
 *
 * Browsers cap how many a page may create — Chrome at six — and a coach who
 * has spoken six times would otherwise go silent for the rest of the session.
 */
let context: AudioContext | null = null;

function audioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

/**
 * Browsers start an `AudioContext` suspended until a user gesture. The learner
 * has pressed a button to start the session by the time this runs, so the
 * resume is allowed — but it has to be asked for, or the audio graph runs with
 * no output and the coach is silently mute.
 */
async function ready(): Promise<AudioContext> {
  const ctx = audioContext();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

export function speak(text: string, options: SpeakOptions = {}): SpeakHandle {
  const trimmed = text.trim();

  if (!trimmed) {
    return { done: Promise.resolve(), stop: () => undefined, route: "none" };
  }

  // Every route publishes to the shared level, so the orb needs no knowledge of
  // which one is speaking. Callers may still watch it themselves.
  const reportLevel = (value: number) => {
    setCoachLevel(value);
    options.onLevel?.(value);
  };
  const withLevel: SpeakOptions = { ...options, onLevel: reportLevel };

  if (options.preferBrowser) return tracked(() => speakInBrowser(trimmed, withLevel));

  // Try the server, fall back rather than fail. A missing ElevenLabs key, an
  // exhausted quota and a circuit breaker that has tripped all arrive here as
  // a rejected promise, and in every one of those cases a browser voice is
  // enormously better than silence.
  let cancel = () => undefined as void;
  let cancelled = false;

  const done = (async () => {
    beginCoachVoice();
    try {
      const buffer = await api.synthesize(trimmed, options.signal);
      if (cancelled) return;

      const handle = await playBuffer(buffer, withLevel);
      cancel = handle.stop;
      if (cancelled) handle.stop();
      await handle.done;
    } catch {
      if (cancelled) return;
      const handle = speakInBrowser(trimmed, withLevel);
      cancel = handle.stop;
      if (cancelled) handle.stop();
      await handle.done;
    } finally {
      endCoachVoice();
    }
  })();

  return {
    done,
    stop: () => {
      cancelled = true;
      cancel();
    },
    route: "server",
  };
}

/**
 * Mark the orb's level as real for the duration of a handle.
 *
 * Wrapping rather than doing it inside `speakInBrowser`, because that function
 * is also called as the server route's fallback — where the bracket is already
 * open and opening a second one would leave the count permanently above zero.
 */
function tracked(start: () => SpeakHandle): SpeakHandle {
  beginCoachVoice();
  const handle = start();
  return { ...handle, done: handle.done.finally(endCoachVoice) };
}

/**
 * Play decoded audio through an analyser, reporting level per frame.
 *
 * RMS rather than peak: peak jumps to full scale on the first consonant of
 * every word and sits there, which makes the orb strobe. RMS follows the
 * envelope of the voice, which is what a listener perceives as loudness.
 */
async function playBuffer(
  bytes: ArrayBuffer,
  options: SpeakOptions,
): Promise<{ done: Promise<void>; stop: () => void }> {
  const ctx = await ready();
  const decoded = await ctx.decodeAudioData(bytes);

  const source = ctx.createBufferSource();
  source.buffer = decoded;

  const analyser = ctx.createAnalyser();
  // Small window: the orb needs to respond within a frame, and a large FFT
  // averages the transients that make speech read as speech.
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;

  source.connect(analyser);
  analyser.connect(ctx.destination);

  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(samples);

    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);

    // Speech RMS sits well below 1. Scaling by three puts an ordinary speaking
    // level near the top of the orb's range without clipping every syllable.
    options.onLevel?.(Math.min(1, rms * 3));
    frame = requestAnimationFrame(tick);
  };

  const done = new Promise<void>((resolve) => {
    source.onended = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      options.onLevel?.(0);
      resolve();
    };
  });

  source.start();
  frame = requestAnimationFrame(tick);

  return {
    done,
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        // Already ended; `onended` has resolved.
      }
      cancelAnimationFrame(frame);
      options.onLevel?.(0);
    },
  };
}

/**
 * The browser's voice, with a level derived from word boundaries.
 *
 * Each `boundary` event marks a word starting. The envelope below rises fast
 * and decays over roughly the length of a spoken word, so the orb swells on
 * each one and settles between them. It is not the waveform — that is not
 * obtainable — but it is driven by the speech and not by a timer.
 */
function speakInBrowser(text: string, options: SpeakOptions): SpeakHandle {
  if (!isBrowserSynthesisSupported()) {
    return { done: Promise.resolve(), stop: () => undefined, route: "none" };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  // Slightly under conversational pace. The learner is not a native speaker,
  // and a coach who has to be replayed is a coach who was too fast.
  utterance.rate = 0.95;
  utterance.pitch = 1;

  const preferred = pickVoice();
  if (preferred) utterance.voice = preferred;

  let level = 0;
  let frame = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    // Exponential decay. Reaches inaudible in about a third of a second, which
    // is roughly one spoken word.
    level *= 0.88;
    options.onLevel?.(level);
    frame = requestAnimationFrame(tick);
  };

  utterance.onboundary = () => {
    // Varied per word so the orb does not pulse mechanically. The range is
    // narrow enough to read as one voice rather than as noise.
    level = 0.55 + Math.random() * 0.3;
  };

  const done = new Promise<void>((resolve) => {
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      options.onLevel?.(0);
      resolve();
    };

    utterance.onend = finish;
    utterance.onerror = finish;
  });

  // Chrome keeps a queue, and a queued utterance from an abandoned turn will
  // speak over the current one.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  frame = requestAnimationFrame(tick);

  return {
    done,
    route: "browser",
    stop: () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      options.onLevel?.(0);
      window.speechSynthesis.cancel();
    },
  };
}

/**
 * The best English voice available.
 *
 * Left to itself the browser picks the system default, which on many machines
 * is a robotic one. Preferring a natural-sounding English voice costs nothing
 * and is the difference between a coach and a screen reader.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  if (english.length === 0) return null;

  const natural = english.find((voice) =>
    /natural|neural|google|samantha|aria|jenny/i.test(voice.name),
  );

  return natural ?? english[0] ?? null;
}

/**
 * Voices load asynchronously in Chrome and `getVoices` returns empty until they
 * do. Calling this once at startup means the first thing the coach says already
 * has a good voice rather than the default one.
 */
export function warmVoices() {
  if (!isBrowserSynthesisSupported()) return;
  window.speechSynthesis.getVoices();
}
