# The Communication Profile reads only from mastery

Two things could have fed the dashboard besides mastery — time decay, and the delivery metrics computed from Whisper word timestamps — and we rejected both, because a Profile Dimension is defined as a bundle of sub-competencies and any second input would give the dashboard a source of truth that drifts from the learner model. Decay is real but it surfaces as a due count and the Improve ring instead of as a falling percentage; delivery metrics are real but they now produce evidence for fluency and delivery sub-competencies, updating mastery the ordinary way rather than scoring in parallel.

## Considered options

Showing mastery × retrievability would be the honest answer to "what can she do right now," and it creates genuine return pressure, but it drops a learner's visible score for time passing rather than for anything she did — the mechanic Duolingo removed for being demoralising.

## Consequences

Three learner-facing surfaces stay distinct: Rings mean showing up, the Profile means getting better, the due count means act now.

Confidence was the special case this decision was written around — a dimension with a `derived` array of raw delivery metrics. Routing those metrics through mastery removed the special case, and [`0006-confidence-and-presentation-are-not-dimensions.md`](./0006-confidence-and-presentation-are-not-dimensions.md) later removed the dimension itself, because what the metrics measure is delivery rather than confidence. The rule here is unchanged and is what made that possible: the metrics are still evidence on sub-competencies, so nothing reaches the Profile except through mastery.
