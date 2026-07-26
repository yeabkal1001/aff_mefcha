/**
 * The on-screen transcript while the learner is still talking.
 *
 * This is the polished / display track. Whisper (via POST /audio/transcribe) is
 * the graded track — it runs after the turn ends, with word timestamps. The
 * browser's SpeechRecognition fills the Wispr-shaped hole for the live caption:
 * it is lossy and it cleans speech up, which is exactly why it must never be
 * graded.
 *
 * PROP: SpeechRecognition is a browser API, not our pipeline. The claim the
 * product makes ("these numbers are measured") rests on the Whisper result that
 * arrives after stop, not on these interim words.
 */

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string };
    };
  };
}

function recognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function liveSpeechAvailable(): boolean {
  return recognitionCtor() !== null;
}

export class LiveSpeech {
  private recognition: SpeechRecognitionLike | null = null;
  private finals = "";
  private onUpdate: (text: string) => void;
  private shouldRun = false;

  constructor(onUpdate: (text: string) => void) {
    this.onUpdate = onUpdate;
  }

  start(lang = "en-US") {
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    this.stop();
    this.shouldRun = true;
    this.finals = "";
    this.onUpdate("");

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) {
          this.finals = `${this.finals} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      this.onUpdate(`${this.finals} ${interim}`.trim());
    };

    // Chrome ends recognition after a pause. Restart while the turn is still
    // open so a mid-sentence silence does not kill the caption.
    recognition.onend = () => {
      if (!this.shouldRun) return;
      try {
        recognition.start();
      } catch {
        // Already started, or the browser refused — neither is fatal.
      }
    };

    recognition.onerror = (event) => {
      // `no-speech` and `aborted` are normal; anything else just ends the caption.
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.shouldRun = false;
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.shouldRun = false;
    }
  }

  stop() {
    this.shouldRun = false;
    if (!this.recognition) return;
    try {
      this.recognition.onend = null;
      this.recognition.stop();
    } catch {
      // Already stopped.
    }
    this.recognition = null;
  }
}
