/**
 * How loud the coach is, right now.
 *
 * A module-level number rather than React state, deliberately. This is written
 * once per animation frame by whichever voice is speaking and read once per
 * animation frame by the orb; routing sixty updates a second through a context
 * would re-render the practice screen sixty times a second to move a gradient.
 *
 * It also has to be readable from outside a React tree — `lib/speech/synthesis`
 * is a plain module — which a context could not provide.
 *
 * `hasVoice` is the part that matters for honesty. When no real voice is
 * playing, the orb falls back to a synthesised speech-shaped pulse; when one
 * is, it must not, or the coach's actual silences would be papered over by a
 * loop that keeps dancing.
 */

let level = 0;
let voices = 0;

/** Called by the speech layer, roughly every frame while speaking. */
export function setCoachLevel(value: number) {
  level = Math.max(0, Math.min(1, value));
}

export function getCoachLevel(): number {
  return level;
}

/** True while a real audio source is driving the level. */
export function hasCoachVoice(): boolean {
  return voices > 0;
}

/**
 * Bracket a real utterance. Counted rather than a boolean because a reply can
 * begin while the previous one is still fading out, and a boolean would have
 * the second one's `end` switch the orb back to synthetic mid-sentence.
 */
export function beginCoachVoice() {
  voices += 1;
}

export function endCoachVoice() {
  voices = Math.max(0, voices - 1);
  if (voices === 0) level = 0;
}
