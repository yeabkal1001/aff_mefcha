/**
 * One microphone, shared, with voice activity detection.
 *
 * Three problems this solves, all of which were real.
 *
 * **One stream.** The orb, the level meter and the session all want to know how
 * loud the learner is. Each of them calling `getUserMedia` opens a separate
 * capture, and on some devices the second call fails outright. This is
 * reference counted: the first `acquire` opens the mic, the last `release`
 * closes it.
 *
 * **Calibration.** A fixed gain cannot work. The same sentence spoken into a
 * laptop's built-in array and into a headset differs by more than an order of
 * magnitude in RMS, so any hard-coded multiplier is either dead for one or
 * permanently clipped for the other. Instead the engine learns the room: it
 * tracks a noise floor and a recent peak, and reports level as the learner's
 * position between them. Loud rooms and quiet talkers both end up using the
 * full range.
 *
 * **Detection, not just loudness.** "Is the learner speaking" is a different
 * question from "how loud is it", and the session needs the first one to know
 * when a turn ended. Thresholds are relative to the learned floor, with
 * separate open and close levels so a voice does not chatter on and off across
 * a single threshold, and speech only ends after a deliberate hangover — the
 * gaps inside ordinary speech are longer than people think.
 */

export interface MicStatus {
  /** Permission refused, no device, or the track died. */
  blocked: boolean;
  /** The stream is live, but nothing above the noise floor has arrived yet. */
  silent: boolean;
  /** Speech right now. */
  speaking: boolean;
  /** Whether speech has ever been detected on this stream. */
  everHeard: boolean;
}

/**
 * How long the signal must stay above the open threshold before speech is
 * declared, in milliseconds rather than frames.
 *
 * This was a frame count, which is a time constant in disguise: the same "two
 * frames" is 33ms on a healthy display and 200ms on a throttled or headless
 * one, so the detector's sensitivity silently tracked the machine's frame rate.
 */
const ATTACK_MS = 70;
/**
 * A gap this short does not reset the attack. Sampling windows do not line up
 * with syllables, so a single quiet reading mid-word is expected.
 */
const ATTACK_RESET_MS = 180;
/** Loud enough that waiting out the attack would just add latency. */
const OBVIOUS_SPEECH_RATIO = 3;
/**
 * Analysis interval. Deliberately not `requestAnimationFrame`.
 *
 * rAF is paced by the display, and when it runs slowly the loop samples 43ms
 * windows 100ms apart and simply misses most of the audio. A timer at this
 * spacing covers the stream continuously whatever the renderer is doing.
 */
const SAMPLE_MS = 25;
/**
 * Silence before speech is declared over.
 *
 * Deliberately long. A comma is 200–400ms of silence, and a learner searching
 * for a word can easily pause for a second — cutting them off there is worse
 * than waiting, because the turn they were mid-way through is the evidence.
 */
const HANGOVER_MS = 1100;
/** How long a live stream can produce nothing before we call it silent. */
const SILENCE_VERDICT_MS = 3500;

/**
 * Above the floor by this much to open the gate.
 *
 * Both a ratio and an absolute margin, because either alone fails. The ratio
 * handles a loud room, where everything scales up. The absolute margin handles a
 * near-silent one, where the ratio would put the threshold a hair above room
 * tone and the detector would trip on a fan. Room tone measures roughly
 * 0.002–0.01 RMS; speech with auto gain on lands around 0.05–0.2.
 */
const OPEN_RATIO = 2.4;
const OPEN_MARGIN = 0.012;
/** And the gate stays open until it drops closer to the floor than this. */
const CLOSE_RATIO = 1.6;
const CLOSE_MARGIN = 0.007;

/** The floor is an estimate of room tone, so keep it in the range room tone lives in. */
const MIN_NOISE_FLOOR = 0.0015;
const MAX_NOISE_FLOOR = 0.25;

/**
 * The quietest peak we will normalise against.
 *
 * Without a floor on the peak, an empty room's hiss becomes "full volume" and
 * the orb dances at nothing.
 */
const MIN_PEAK_ABOVE_FLOOR = 0.02;

/** How long the stream stays open after the last holder releases it. */
const CLOSE_GRACE_MS = 2000;

let refCount = 0;
let stream: MediaStream | null = null;
let context: AudioContext | null = null;
/** Handle for the analysis interval. */
let frame = 0;
let starting: Promise<void> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

let level = 0;
let noiseFloor = 0.01;
let peak = 0.05;
let firstAboveAt = 0;
let lastAboveAt = 0;
let lastLoudAt = 0;
let openedStreamAt = 0;

let status: MicStatus = {
  blocked: false,
  silent: false,
  speaking: false,
  everHeard: false,
};

const listeners = new Set<(status: MicStatus) => void>();

function publish(next: Partial<MicStatus>) {
  const merged = { ...status, ...next };
  if (
    merged.blocked === status.blocked &&
    merged.silent === status.silent &&
    merged.speaking === status.speaking &&
    merged.everHeard === status.everHeard
  ) {
    return;
  }
  status = merged;
  listeners.forEach((listener) => listener(status));
}

export function subscribe(listener: (status: MicStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getMicLevel(): number {
  return level;
}

export function getMicStatus(): MicStatus {
  return status;
}

async function open() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    publish({ blocked: true });
    return;
  }

  try {
    const granted = await navigator.mediaDevices.getUserMedia({
      audio: {
        /**
         * Noise suppression and auto gain are left on: they make the learner
         * easier to transcribe, which matters more than a pristine level
         * reading, and the engine calibrates around whatever they do. Echo
         * cancellation matters once the coach's voice is coming out of the
         * speakers, so the mic does not hear the coach and call it the learner.
         */
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Released while we were waiting for permission.
    if (refCount === 0) {
      granted.getTracks().forEach((track) => track.stop());
      return;
    }

    stream = granted;
    openedStreamAt = performance.now();
    publish({ blocked: false, silent: false });

    const track = granted.getAudioTracks()[0];
    track?.addEventListener("ended", () => publish({ blocked: true }));

    context = new AudioContext();
    // Chrome starts a context suspended unless the page has been interacted
    // with. Resuming is a no-op when it is already running.
    if (context.state === "suspended") await context.resume();

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    // Smoothing here would fight the engine's own envelope tracking.
    analyser.smoothingTimeConstant = 0;
    context.createMediaStreamSource(granted).connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);

    const measure = () => {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const deviation = (samples[i] - 128) / 128;
        sum += deviation * deviation;
      }
      const rms = Math.sqrt(sum / samples.length);
      const now = performance.now();

      const openAt = noiseFloor * OPEN_RATIO + OPEN_MARGIN;
      const closeAt = noiseFloor * CLOSE_RATIO + CLOSE_MARGIN;

      // Learn the room, but only from frames that are plausibly the room.
      //
      // Two rules, and both were learned the hard way. The floor only adapts
      // while the gate is shut and the frame is below the open threshold —
      // otherwise sustained speech pulls the floor up behind itself, the
      // threshold climbs past the voice that raised it, and the detector goes
      // deaf to a steady talker.
      //
      // And it is an average of those quiet frames, not a minimum. Chasing the
      // minimum sounds right and is not: the quietest sample in any stretch is
      // near digital silence, so the floor collapses toward zero, the threshold
      // collapses with it, and room tone starts reading as speech. Downward
      // adaptation is only a little faster than upward, which converges on
      // typical quiet rather than quietest-ever.
      if (!status.speaking && rms < openAt) {
        noiseFloor += (rms - noiseFloor) * (rms < noiseFloor ? 0.05 : 0.02);
      }
      noiseFloor = Math.max(MIN_NOISE_FLOOR, Math.min(noiseFloor, MAX_NOISE_FLOOR));

      // Recent peak, decaying, so the range follows the speaker rather than
      // being permanently stretched by one cough.
      peak = Math.max(rms, peak * 0.999);
      peak = Math.max(peak, noiseFloor + MIN_PEAK_ABOVE_FLOOR);

      level = Math.max(0, Math.min(1, (rms - noiseFloor) / (peak - noiseFloor)));

      if (status.speaking) {
        if (rms > closeAt) lastLoudAt = now;
        if (now - lastLoudAt > HANGOVER_MS) {
          firstAboveAt = 0;
          publish({ speaking: false });
        }
      } else {
        if (rms > openAt) {
          // A gap shorter than the reset window is treated as part of the same
          // onset, so the attack accumulates across it rather than restarting.
          if (firstAboveAt === 0 || now - lastAboveAt > ATTACK_RESET_MS) {
            firstAboveAt = now;
          }
          lastAboveAt = now;

          if (
            now - firstAboveAt >= ATTACK_MS ||
            rms > openAt * OBVIOUS_SPEECH_RATIO
          ) {
            lastLoudAt = now;
            publish({ speaking: true, everHeard: true, silent: false });
          }
        } else if (firstAboveAt !== 0 && now - lastAboveAt > ATTACK_RESET_MS) {
          firstAboveAt = 0;
        }

        if (
          !status.everHeard &&
          !status.silent &&
          now - openedStreamAt > SILENCE_VERDICT_MS
        ) {
          publish({ silent: true });
        }
      }

      if (process.env.NODE_ENV !== "production") {
        debug = { rms, noiseFloor, openAt, peak, level, frames: debug.frames + 1 };
      }
    };

    frame = window.setInterval(measure, SAMPLE_MS);
  } catch {
    publish({ blocked: true });
  }
}

/**
 * Live detector internals, for diagnosing "it isn't hearing me" reports.
 *
 * Read it from the console as `__mic()`. Development only — the whole block is
 * dropped from a production build.
 */
let debug = { rms: 0, noiseFloor: 0, openAt: 0, peak: 0, level: 0, frames: 0 };

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __mic: () => unknown }).__mic = () => ({
    ...debug,
    ...status,
    refCount,
    hasStream: stream !== null,
    contextState: context?.state ?? null,
  });
}

/** Open the microphone, or join the one already open. */
export function acquireMic() {
  refCount += 1;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (refCount > 1 || starting || stream) return;
  starting = open().finally(() => {
    starting = null;
  });
}

/**
 * Give it up. The mic closes when the last holder lets go — but not instantly.
 *
 * React runs an effect's cleanup before the next effect's setup, so a component
 * that re-subscribes on a dependency change drops the count to zero for a tick.
 * Closing on that would tear the stream down and reopen it, which costs several
 * hundred milliseconds of dead microphone and discards the learned noise floor.
 * The grace period makes any handover free.
 */
export function releaseMic() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || closeTimer) return;

  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (refCount > 0) return;
    closeNow();
  }, CLOSE_GRACE_MS);
}

function closeNow() {
  window.clearInterval(frame);
  stream?.getTracks().forEach((track) => track.stop());
  void context?.close();

  stream = null;
  context = null;
  level = 0;
  firstAboveAt = 0;
  lastAboveAt = 0;
  noiseFloor = 0.01;
  peak = 0.05;
  publish({ speaking: false, silent: false, everHeard: false });
}

/**
 * Forget what was learned about the room.
 *
 * Called when a fresh turn starts, so a previous turn's shouting does not keep
 * the range stretched and make the next one look quiet.
 */
export function recalibrateMic() {
  peak = noiseFloor + MIN_PEAK_ABOVE_FLOOR;
}
