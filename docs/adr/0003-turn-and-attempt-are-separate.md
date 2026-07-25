# Turn and Attempt are separate, and evidence is counted per session-competency

`attempt` was keyed `(session, competency)` while carrying `transcript_verbatim`, `transcript_clean` and `metrics_json` — properties of one spoken utterance, not of one competency, so a single turn wrote its transcript and word timestamps to three rows. A Turn now owns the utterance and its delivery metrics; an Attempt is one competency judgement pointing at its turn.

Separately, retries meant one competency could produce three attempt rows in a single session. Counting each as evidence would have let a *failed* session reach the `evidence_count >= 3` promotion floor, and would have shrunk `alpha = max(0.15, 1/(1+evidence_count))` fastest for exactly the learners whose estimates most needed to move. Every attempt is therefore stored, but one session-and-competency pair is one piece of evidence, and mastery updates once from the final attempt at its scaffolded weight.

## Consequences

All three attempts stay queryable, which the reflection prompt depends on — "what changed between your first answer and your second?" needs both answers. Delivery metrics attach to the Turn, which is the thing that actually has pauses.
