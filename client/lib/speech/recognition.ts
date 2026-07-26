/**
 * Speech to text, in the browser.
 *
 * The Web Speech API rather than uploading audio, because it is free, it is
 * instant, and it streams interim results — which is what makes the transcript
 * appear as the learner talks instead of after they stop. The cost is that it
 * only exists in Chromium and Safari, and that it gives words with no timings.
 * Both are handled: `isRecognitionSupported` lets the caller fall back to the
 * server's Whisper endpoint, and the metrics below are derived from the arrival
 * times of results rather than from timings we do not have.
 *
 * This module owns no React. It is a plain object with a lifecycle, because the
 * recogniser is a long-lived browser resource and tying it to a render would
 * mean restarting it on every state change — which, in Chrome, plays the
 * start-of-recording chime each time.
 */

/* The API is still unprefixed-in-name-only, and TypeScript's DOM library does
 * not describe it at all. These are the parts actually used. */

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}

interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}

interface RecognitionEvent extends Event {
  resultIndex: number;
  results: RecognitionResultList;
}

interface RecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function constructorFor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return constructorFor() !== null;
}

/** Why listening stopped, when it stopped for a reason worth telling anyone. */
export type RecognitionFailure =
  | "not-supported"
  | "not-allowed" // Microphone permission, which is the mic engine's problem too.
  | "no-speech"
  | "network"
  | "aborted"
  | "unknown";

export interface TurnTranscript {
  /** Everything heard, final results joined. */
  text: string;
  /** Derived timings. The server clamps all of these before believing them. */
  metrics: {
    wordCount: number;
    speechMs: number;
    totalMs: number;
    pauseCount: number;
    pauseMs: number;
    hesitationCount: number;
    responseLatencyMs: number;
    sentenceCount: number;
  };
}

export interface RecognitionHandlers {
  /** Fires continuously, including partial words. For the live transcript. */
  onPartial?: (text: string) => void;
  /** Fires once per completed phrase. */
  onFinal?: (text: string) => void;
  onError?: (failure: RecognitionFailure) => void;
}

/**
 * A gap longer than this counts as a pause rather than the space between two
 * words. 700ms is the threshold the delivery scoring uses on the server; the
 * two have to agree or the pause ratio means nothing.
 */
const PAUSE_MS = 700;

/** um, uh, eh, er, and the Amharic-influenced "ehm". Counted, not corrected. */
const HESITATION = /\b(u+m+|u+h+|e+h+m?|e+r+|ah+)\b/gi;

export interface RecognitionSession {
  /** Stop listening and return what was heard, with its metrics. */
  stop: () => Promise<TurnTranscript>;
  /** Throw the turn away — the learner cancelled. */
  cancel: () => void;
}

/**
 * Listen for one turn.
 *
 * `startedAt` is when the coach stopped speaking, not when this was called, so
 * that response latency measures the learner's thinking time rather than our
 * own setup cost.
 */
export function listen(
  handlers: RecognitionHandlers,
  options: { lang?: string; startedAt?: number } = {},
): RecognitionSession {
  const Recognition = constructorFor();

  if (!Recognition) {
    handlers.onError?.("not-supported");
    return {
      stop: () => Promise.resolve(emptyTranscript()),
      cancel: () => undefined,
    };
  }

  const recognition = new Recognition();
  // `en-US` and not the learner's L1: they are practising English, and telling
  // the recogniser to expect Amharic would make it transcribe nothing.
  recognition.lang = options.lang ?? "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  const openedAt = options.startedAt ?? Date.now();
  let firstSoundAt: number | null = null;
  let lastResultAt = 0;
  let speechMs = 0;
  let pauseCount = 0;
  let pauseMs = 0;
  const finals: string[] = [];

  let settle: ((value: TurnTranscript) => void) | null = null;
  let cancelled = false;

  recognition.onresult = (event) => {
    const now = Date.now();
    firstSoundAt ??= now;

    if (lastResultAt > 0) {
      const gap = now - lastResultAt;
      if (gap > PAUSE_MS) {
        pauseCount += 1;
        pauseMs += gap;
      } else {
        // Time between results with no pause between them is time spent
        // talking. Approximate, and honest about being so: the alternative is
        // calling the whole turn "speech", which would report every learner as
        // perfectly fluent.
        speechMs += gap;
      }
    }
    lastResultAt = now;

    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result) continue;
      const alternative = result[0];
      if (!alternative) continue;

      if (result.isFinal) {
        finals.push(alternative.transcript.trim());
        handlers.onFinal?.(alternative.transcript.trim());
      } else {
        interim += alternative.transcript;
      }
    }

    handlers.onPartial?.([...finals, interim].join(" ").trim());
  };

  recognition.onerror = (event) => {
    // `no-speech` and `aborted` are ordinary: the learner paused too long, or
    // we stopped it ourselves. Reporting them as errors would put a warning on
    // screen for the most common thing that happens.
    if (event.error === "aborted") return;
    handlers.onError?.(failureFrom(event.error));
  };

  recognition.onend = () => {
    if (cancelled) return;
    settle?.(collect());
    settle = null;
  };

  function collect(): TurnTranscript {
    const text = finals.join(" ").replace(/\s+/g, " ").trim();
    const totalMs = Math.max(0, Date.now() - openedAt);
    const words = text ? text.split(/\s+/).length : 0;

    return {
      text,
      metrics: {
        wordCount: words,
        // Never claim more speech than the turn was long.
        speechMs: Math.min(speechMs, totalMs),
        totalMs,
        pauseCount,
        pauseMs: Math.min(pauseMs, totalMs),
        hesitationCount: (text.match(HESITATION) ?? []).length,
        responseLatencyMs: firstSoundAt ? Math.max(0, firstSoundAt - openedAt) : totalMs,
        // Web Speech returns no punctuation in most browsers, so a "sentence"
        // is a final result: the recogniser ends one where the speaker's
        // intonation and pausing say a thought finished, which is the same
        // judgement a listener makes. Sentence Structure is scored by the
        // evaluator from the text, not from this — this only feeds mean length.
        sentenceCount: Math.max(finals.length, text ? 1 : 0),
      },
    };
  }

  try {
    recognition.start();
  } catch {
    // Already started, which happens if a stop is still settling. Not fatal:
    // the existing session is the one we want anyway.
  }

  return {
    stop() {
      return new Promise<TurnTranscript>((resolve) => {
        settle = resolve;
        try {
          recognition.stop();
        } catch {
          resolve(collect());
        }
        // `onend` is not guaranteed to fire if the recogniser was already
        // closing. Without this the turn would hang forever waiting for it.
        setTimeout(() => {
          if (settle) {
            settle(collect());
            settle = null;
          }
        }, 1_500);
      });
    },
    cancel() {
      cancelled = true;
      try {
        recognition.abort();
      } catch {
        // Already gone.
      }
    },
  };
}

function failureFrom(code: string): RecognitionFailure {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

function emptyTranscript(): TurnTranscript {
  return {
    text: "",
    metrics: {
      wordCount: 0,
      speechMs: 0,
      totalMs: 0,
      pauseCount: 0,
      pauseMs: 0,
      hesitationCount: 0,
      responseLatencyMs: 0,
      sentenceCount: 0,
    },
  };
}
