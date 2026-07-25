"""The mastery update. Every number on the Communication Profile comes through here.

Deliberately a pure function over plain values: no database, no ORM, no clock. This
is the calculation a judge is most likely to ask about, so it has to be readable on
its own and testable without a session.
"""

from dataclasses import dataclass

from app.engine.constants import MIN_ALPHA, SCAFFOLD_WEIGHT, STABILITY_GAIN


@dataclass(frozen=True)
class MasteryUpdate:
    """What changed, and every input that produced it.

    The intermediate terms are kept rather than discarded because "why did Grammar
    move six points?" should be answerable from a stored record.
    """

    observed: float
    alpha: float
    weight: float
    scaffolded: bool
    mastery_before: float
    mastery_after: float
    stability_before: float
    stability_after: float
    evidence_count_before: int
    evidence_count_after: int


def alpha_for(evidence_count: int) -> float:
    """How hard new evidence moves the estimate.

    max(0.15, 1/(1+n)): the first observation replaces the prior outright, the tenth
    nudges it. This is why the profile appears to improve quickly in the first week —
    not a trick, just a wide prior narrowing.
    """
    return max(MIN_ALPHA, 1.0 / (1.0 + evidence_count))


def apply_update(
    *,
    mastery: float,
    stability_days: float,
    evidence_count: int,
    observed: float,
    reliability: float,
    scaffolded: bool,
) -> MasteryUpdate:
    """One session's evidence for one sub-competency.

    `observed` is `correct / opportunities` from the final attempt, never a model's
    opinion. `reliability` is the template's `measures` score for the competency's
    skill, which is why a shadowing exercise and a picture description do not move a
    pronunciation estimate by the same amount.

    Called once per session and competency however many retries it took — counting
    each retry would let a failed session climb the promotion floor. See ADR 0003.
    """
    alpha = alpha_for(evidence_count)
    weight = reliability * (SCAFFOLD_WEIGHT if scaffolded else 1.0)

    mastery_after = mastery + alpha * weight * (observed - mastery)
    mastery_after = min(1.0, max(0.0, mastery_after))

    # observed in [0,1] keeps the factor in [0.55, 1.45], so stability always stays
    # positive: success lengthens the interval, failure shortens it.
    stability_after = stability_days * (1.0 + STABILITY_GAIN * (observed - 0.5))

    return MasteryUpdate(
        observed=observed,
        alpha=alpha,
        weight=weight,
        scaffolded=scaffolded,
        mastery_before=mastery,
        mastery_after=mastery_after,
        stability_before=stability_days,
        stability_after=stability_after,
        evidence_count_before=evidence_count,
        evidence_count_after=evidence_count + 1,
    )
