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

/**
 * Why the microphone is unavailable.
 *
 * A single `blocked` flag sent every failure to the same sentence — "allow
 * access in your address bar" — which is wrong advice for four of these five
 * and actively misleading on `insecure`, where there is no prompt to allow.
 * The learner can only fix the problem they actually have.
 */
export type MicBlockReason =
  /** The learner said no, or the browser remembers them saying no. */
  | "denied"
  /** No capture device at all. */
  | "no-device"
  /** Another application holds the device.  */
  | "in-use"
  /** Not HTTPS and not localhost, so `getUserMedia` does not exist. */
  | "insecure"
  /** The prompt was never answered, or the device never opened. */
  | "timeout"
  /** Everything else, including a track that died mid-session. */
  | "unknown";

export interface MicStatus {
  /** Permission refused, no device, or the track died. */
  blocked: boolean;
  /** Set whenever `blocked` is, so the notice can say something useful. */
  reason: MicBlockReason | null;
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
  reason: null,
  silent: false,
  speaking: false,
  everHeard: false,
};

const listeners = new Set<(status: MicStatus) => void>();

function publish(next: Partial<MicStatus>) {
  const merged = { ...status, ...next };
  if (
    merged.blocked === status.blocked &&
    merged.reason === status.reason &&
    merged.silent === status.silent &&
    merged.speaking === status.speaking &&
    merged.everHeard === status.everHeard
  ) {
    return;
  }
  status = merged;
  listeners.forEach((listener) => listener(status));
}

/**
 * Map a `getUserMedia` rejection to something the learner can act on.
 *
 * The names are from the Media Capture spec; browsers disagree on which they
 * throw for a device that is busy, so `NotReadableError` and `AbortError` are
 * both treated as "something else has it".
 */
function reasonFor(error: unknown): MicBlockReason {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
    case "AbortError":
      return "in-use";
    default:
      return "unknown";
  }
}

/**
 * Give up on a permission prompt nobody is answering.
 *
 * `getUserMedia` never settles while the prompt is open, and a learner who
 * ignores it leaves `starting` pending forever — which, because `acquireMic`
 * bails while a start is in flight, means no later attempt can ever run. The
 * session would sit in `listening` against a microphone that was never opened.
 */
const OPEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("getUserMedia timed out");
      error.name = "TimeoutError";
      reject(error);
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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

/**
 * Bring an audio context to `running`, now or at the first opportunity.
 *
 * Resolves immediately when the page has already been interacted with. When it
 * has not, the gesture listeners are `once` and passive, and they remove each
 * other as soon as any one of them fires.
 */
async function resumeWhenAllowed(target: AudioContext) {
  try {
    await target.resume();
    if (target.state === "running") return;
  } catch {
    // Autoplay policy. Fall through and wait for a gesture.
  }

  const events = ["pointerdown", "keydown", "touchstart"] as const;

  const wake = () => {
    events.forEach((event) => window.removeEventListener(event, wake));
    // The context may have been torn down while we waited.
    if (target.state === "closed") return;
    void target.resume();
  };

  events.forEach((event) =>
    window.addEventListener(event, wake, { once: true, passive: true }),
  );
}

/** Clear every timer the detector carries, so a new stream starts cold. */
function resetDetector() {
  level = 0;
  noiseFloor = 0.01;
  peak = 0.05;
  firstAboveAt = 0;
  lastAboveAt = 0;
  lastLoudAt = 0;
}

async function open() {
  if (typeof navigator === "undefined") return;

  // `navigator.mediaDevices` is undefined outside a secure context, so on a
  // plain-http deploy the microphone is not blocked — it does not exist, and
  // no amount of clicking the address bar will produce it. Say which.
  if (!navigator.mediaDevices?.getUserMedia) {
    const secure = typeof window !== "undefined" && window.isSecureContext;
    publish({ blocked: true, reason: secure ? "unknown" : "insecure" });
    return;
  }

  try {
    const granted = await withTimeout(
      navigator.mediaDevices.getUserMedia({
        audio: {
          /**
           * Noise suppression and auto gain are left on: they make the learner
           * easier to transcribe, which matters more than a pristine level
           * reading, and the engine calibrates around whatever they do. Echo
           * cancellation matters once the coach's voice is coming out of the
           * speakers, so the mic does not hear the coach and call it the
           * learner.
           */
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }),
      OPEN_TIMEOUT_MS,
    );

    // Released while we were waiting for permission.
    if (refCount === 0) {
      granted.getTracks().forEach((track) => track.stop());
      return;
    }

    stream = granted;
    openedStreamAt = performance.now();

    // A fresh stream is a fresh room. Leaving the detector's timers set from
    // the previous one made the first turn after a reopen end instantly:
    // `lastLoudAt` was minutes in the past, so the very first frame of speech
    // was already past its hangover.
    resetDetector();
    publish({ blocked: false, reason: null, silent: false });

    const track = granted.getAudioTracks()[0];
    // The device was unplugged, or the OS revoked the capture.
    track?.addEventListener("ended", () =>
      publish({ blocked: true, reason: "no-device", speaking: false }),
    );

    context = new AudioContext();
    // Chrome starts a context suspended until the page has been interacted
    // with, and `resume()` *rejects* rather than waiting when it is called too
    // early. Awaiting it unguarded meant an autoplay-policy refusal fell into
    // the catch below and was reported as a blocked microphone — to a learner
    // who had just granted permission, with a working device, and no way to
    // clear it. The stream is fine; only the analysis graph is asleep. Arm it
    // to wake on the next gesture and carry on.
    void resumeWhenAllowed(context);

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
  } catch (error) {
    // Denied, no device, or the device is held by something else. Tear down
    // whatever got as far as existing — a granted stream with a failed
    // AudioContext behind it would otherwise sit here holding the recording
    // indicator on while measuring nothing, and block the retry guard in
    // `acquireMic`.
    closeNow();
    publish({
      blocked: true,
      reason:
        error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : reasonFor(error),
    });
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

/**
 * Open the microphone, or join the one already open.
 *
 * The guard is on the stream rather than on the holder count. It used to bail
 * whenever `refCount > 1`, which meant that once an attempt had failed — a
 * denied permission, a device already in use — no later holder could trigger
 * another one while the first was still mounted. A learner who granted
 * permission in browser settings had to leave the screen and come back before
 * anything would try again. A repeated attempt after a standing denial is
 * rejected by the browser immediately and costs nothing.
 */
export function acquireMic() {
  refCount += 1;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (starting || stream) return;
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
  resetDetector();
  // `blocked` is deliberately left alone. It describes the device, not the
  // stream, and clearing it here would flash "microphone ready" between a
  // denial and the next attempt.
  publish({ speaking: false, silent: false, everHeard: false });
}

/**
 * Try again after a failure, discarding the standing verdict.
 *
 * The retry path for a learner who has just fixed the problem — granted
 * permission, plugged a headset back in, quit the app that held the device.
 * Without this the only way back was a page reload.
 */
export function retryMic() {
  if (starting) return;
  closeNow();
  publish({ blocked: false, reason: null });
  if (refCount > 0) {
    starting = open().finally(() => {
      starting = null;
    });
  }
}

/**
 * A device appeared or vanished while we were blocked.
 *
 * Plugging in a headset after arriving with no microphone is the single most
 * common way a learner fixes this, and it fires no other event we listen for.
 * Only retried while someone is actually waiting on the mic, and only out of a
 * blocked state, so this never disturbs a healthy stream.
 */
if (typeof navigator !== "undefined" && navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    if (refCount > 0 && status.blocked) retryMic();
  });
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
