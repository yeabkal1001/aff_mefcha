"""Profile Dimensions: the three display rules that keep the numbers honest."""

from dataclasses import dataclass

import pytest

from app.engine.profile import MemberEvidence, compute_dimension


@dataclass
class FakeDimension:
    id: str
    name: str
    fixed: bool = True
    position: int = 1


GRAMMAR = FakeDimension(id="grammar", name="Grammar")


def evidence(competency_id, mastery, count, observable=True, weight=1.0):
    return MemberEvidence(competency_id, mastery, count, observable, weight)


def test_unattempted_dimension_is_not_zero():
    """"Not yet assessed" is a different claim from 0%, and only one of them is true."""
    result = compute_dimension(GRAMMAR, [evidence("G001.01", 0.0, 0)])
    assert result.value is None
    assert result.attempted_count == 0


def test_evidence_weighted_mean():
    result = compute_dimension(
        GRAMMAR, [evidence("G001.01", 0.4, 1), evidence("G006.01", 0.8, 3)]
    )
    # (0.4*1 + 0.8*3) / 4
    assert result.value == pytest.approx(0.7)


def test_single_observation_widens_the_band():
    thin = compute_dimension(GRAMMAR, [evidence("G001.01", 0.6, 1)])
    thick = compute_dimension(GRAMMAR, [evidence("G001.01", 0.6, 4)])
    assert thin.wide_uncertainty is True
    assert thick.wide_uncertainty is False


def test_unobservable_members_are_excluded_not_zeroed():
    """P001-P003 need phoneme scoring no API in the stack provides. Averaging in a zero
    for something we cannot measure would understate the learner."""
    result = compute_dimension(
        GRAMMAR,
        [evidence("P001.01", 0.0, 2, observable=False), evidence("P005.01", 0.8, 2)],
    )
    assert result.value == pytest.approx(0.8)
    assert result.attempted_count == 1


def test_member_weight_is_respected():
    result = compute_dimension(
        GRAMMAR,
        [evidence("F003.01", 1.0, 1, weight=1.0), evidence("F002.01", 0.0, 1, weight=0.6)],
    )
    assert result.value == pytest.approx(1.0 / 1.6)
