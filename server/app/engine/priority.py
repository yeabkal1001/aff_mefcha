"""Why one competency is practised today and another waits.

    priority(c) = 0.35 x reviewUrgency + 0.25 x domainWeight + 0.15 x pathWeight
                + 0.15 x errorRecency + 0.10 x l1Risk

Kept pure so a ranking can be recomputed and explained after the fact. The Day Three
claim is "the scheduler chose this", which is only checkable if the choice is
reproducible from stored inputs.
"""

from dataclasses import dataclass
from datetime import datetime

from app.engine.constants import (
    ERROR_RECENCY_HALF_LIFE_DAYS,
    ERROR_RECENCY_SATURATION,
    PRIORITY_WEIGHTS,
    ROLE_WEIGHT,
)


@dataclass(frozen=True)
class PriorityInputs:
    competency_id: str
    review_urgency: float = 0.0
    domain_weight: float = 0.0
    path_weight: float = 0.0
    error_recency: float = 0.0
    l1_risk: float = 0.0


def domain_weight_for(role: str | None) -> float:
    """core 1.0, supporting 0.6, incidental 0.2 — and 0 if this domain never asked."""
    if role is None:
        return 0.0
    return ROLE_WEIGHT.get(role, 0.0)


def error_recency(count: int, last_seen: datetime | None, at: datetime) -> float:
    """A decayed tally of this learner's authored-error hits, normalised to [0, 1].

    Half-life is our choice, not the document's: a mistake made on Monday still pulls
    its competency forward on Wednesday and has faded within a fortnight.
    """
    if not count or last_seen is None:
        return 0.0
    elapsed_days = max((at - last_seen).total_seconds() / 86400.0, 0.0)
    decayed = count * 0.5 ** (elapsed_days / ERROR_RECENCY_HALF_LIFE_DAYS)
    return min(1.0, decayed / ERROR_RECENCY_SATURATION)


def l1_risk_for(
    l1_risk_json: dict | None, l1: str, l1_confusions_json: dict | None = None
) -> float:
    """Amharic interference boost. `G005.04` carries 0.8 for `am`, so it outranks a
    competency of equal domain weight for an Amharic speaker and not for anyone else.

    Two authored shapes carry the same fact. Most competencies use a flat `l1_risk` per
    language; the sound-confusion ones instead list per-pair risks under
    `l1_confusions`, because /p/-/b/ and /v/-/b/ are not equally hard. Reading only the
    flat field would score `P001.08` at zero for an Amharic speaker — silently dropping
    the single most L1-specific competency in the pack out of the ranking.
    """
    if l1_risk_json:
        value = l1_risk_json.get(l1)
        if isinstance(value, int | float):
            return float(value)

    if l1_confusions_json:
        risks = [
            float(entry["risk"])
            for entry in l1_confusions_json.get(l1, [])
            if isinstance(entry, dict) and isinstance(entry.get("risk"), int | float)
        ]
        if risks:
            # The hardest contrast sets the urgency: one confusion that wrecks a word is
            # enough of a reason to practise.
            return max(risks)

    return 0.0


def priority(inputs: PriorityInputs) -> float:
    w = PRIORITY_WEIGHTS
    return (
        w["review_urgency"] * inputs.review_urgency
        + w["domain_weight"] * inputs.domain_weight
        + w["path_weight"] * inputs.path_weight
        + w["error_recency"] * inputs.error_recency
        + w["l1_risk"] * inputs.l1_risk
    )
