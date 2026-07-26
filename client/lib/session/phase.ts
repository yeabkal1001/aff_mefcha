/**
 * Where the conversation is right now.
 *
 * The orb reads this to pick its gradient, the ambient field warms to it, and
 * the controls change shape on it — so it is the single most-consumed piece of
 * state in the product and lives on its own rather than inside any one owner.
 */
export type SessionPhase = "idle" | "listening" | "thinking" | "speaking";
