"""Delivery metrics as evidence on competencies.

Confidence was originally specified as a competency plus a `derived` array of raw
delivery metrics, which would have made it the one number on the dashboard sourced
from something other than mastery. Instead the metrics became an evidence source:
latency and underproduction produce an `observed` for the delivery-sensitive
sub-competencies, those update mastery through the ordinary path, and Confidence is a
bundle like Grammar. It still moves visibly session to session, but through the
learner model rather than around it. See ADR 0002.

Each rule below is read straight off the competency's authored `success_criteria`, so
the mapping is traceable rather than invented:

    F003.01  "Answers within four seconds with a complete clause rather than a
              single word."
    F002.01  "Produces at least three connected sentences about a person without
              prompting."

The full metric-to-competency mapping is on the "still to author" list; these are the
two delivery-sensitive competencies inside the demo slice.
"""

from app.engine.evaluator import Judgement
from app.engine.metrics import TurnMetrics

# From F003.01's success criteria.
ANSWER_LATENCY_SECONDS = 4.0

# From F002.01's success criteria.
CONNECTED_SENTENCES = 3


def judge_delivery(
    metrics: TurnMetrics, targeted: set[str], *, is_answer: bool
) -> dict[str, Judgement]:
    """Score the delivery-sensitive targets from this turn's timestamps.

    Only competencies the session explicitly targeted are judged, and a turn with no
    words produces no evidence at all rather than a zero.
    """
    out: dict[str, Judgement] = {}
    if metrics.word_count == 0:
        return out

    if "F003.01" in targeted and is_answer:
        answered_in_time = metrics.first_word_latency_seconds <= ANSWER_LATENCY_SECONDS
        full_clause = metrics.word_count >= 3
        correct = 1 if (answered_in_time and full_clause) else 0
        out["F003.01"] = Judgement(
            competency_id="F003.01",
            opportunities=1,
            correct=correct,
            error_tags=[] if correct else ["latency_underproduction"],
            source="delivery_metrics",
        )

    if "F002.01" in targeted:
        correct = 1 if metrics.sentence_count >= CONNECTED_SENTENCES else 0
        out["F002.01"] = Judgement(
            competency_id="F002.01",
            opportunities=1,
            correct=correct,
            error_tags=[] if correct else ["underproduction"],
            source="delivery_metrics",
        )

    return out
