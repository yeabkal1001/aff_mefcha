# `observed` is an opportunity ratio, not a model score

Every downstream quantity — mastery, Profile Dimensions, promotion, the retry trigger — is a function of `observed`, so asking an LLM for a number in `[0, 1]` would have reintroduced exactly the session-to-session drift that authored `common_errors` were added to eliminate. The evaluator instead returns a structured count per targeted competency, `{ opportunities, correct, error_tags }`, and `observed` is `correct / opportunities`.

## Consequences

A turn with zero opportunities for a competency yields no evidence rather than a zero, so silence and avoidance never look like failure — this is the trap the ratio exists to avoid. Scores become defensible to a judge and reproducible across sessions, at the cost of an evaluator prompt that must count rather than merely assess.
