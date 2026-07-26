/**
 * The scenes the Stimulus Pool can address, as data.
 *
 * Split out from `scenes.tsx` so that validating a stimulus spec does not pull
 * several hundred lines of inline SVG into the bundle — the wire format needs
 * the names, not the drawings.
 */
export const sceneIds = [
  "campus_courtyard",
  "cafe_counter",
  "market_stall",
  "hotel_lobby",
  "crowded_bus",
  "quiet_library",
] as const;

export type SceneId = (typeof sceneIds)[number];
