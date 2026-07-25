"""The spaced review rule: R(c, t) = exp(-(t - last_seen) / stability_days).

Retrievability and Mastery are different things and the distinction is the whole
point. Retrievability falls with time alone; mastery does not. A learner returning
after a month finds her Communication Profile where she left it and a large due
count, which is deliberate — see ADR 0002.
"""

import math
from datetime import datetime

from app.engine.constants import REVIEW_THRESHOLD


def retrievability(
    last_seen: datetime | None, stability_days: float, at: datetime
) -> float | None:
    """How likely the learner is to recall this right now.

    None means never practised. That is not the same as zero: an unseen competency
    has nothing to decay from, and treating it as maximally urgent would put brand
    new material in the review pool.
    """
    if last_seen is None:
        return None
    elapsed_days = (at - last_seen).total_seconds() / 86400.0
    if elapsed_days <= 0:
        return 1.0
    return math.exp(-elapsed_days / max(stability_days, 1e-6))


def is_due(last_seen: datetime | None, stability_days: float, at: datetime) -> bool:
    r = retrievability(last_seen, stability_days, at)
    return r is not None and r < REVIEW_THRESHOLD


def review_urgency(last_seen: datetime | None, stability_days: float, at: datetime) -> float:
    """`1 - R`, and zero for unseen items, as section 9 specifies."""
    r = retrievability(last_seen, stability_days, at)
    return 0.0 if r is None else 1.0 - r


def days_until_due(stability_days: float) -> float:
    """When this will next fall due, measured from the last successful retrieval.

    Solving exp(-d/S) = threshold gives d = -S * ln(threshold).
    """
    return -stability_days * math.log(REVIEW_THRESHOLD)
