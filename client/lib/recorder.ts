/**
 * One stretch of speech, as a blob the server can transcribe.
 *
 * MediaRecorder is the only portable way to capture a turn in the browser without
 * a streaming STT SDK. The format is whatever the browser offers first among the
 * short preference list below — Whisper accepts all of them, so picking by
 * support rather than by brand is the right trade.
 */

const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export class TurnRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];

  async start(): Promise<void> {
    if (this.recorder?.state === "recording") return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });

    const mimeType = pickMimeType();
    this.chunks = [];
    this.recorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    // Timeslice keeps chunks flowing so a short tap still produces a blob even
    // if onstop races the last buffer.
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.cleanup();
      return Promise.resolve(new Blob());
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.cleanup();
        resolve(blob);
      };
      recorder.stop();
    });
  }

  private cleanup() {
    this.recorder = null;
    this.chunks = [];
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }
}
