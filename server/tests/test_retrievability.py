"""The spaced review rule, including the case the whole demo rests on."""

from datetime import UTC, datetime, timedelta

import pytest

from app.engine.retrievability import (
    days_until_due,
    is_due,
    retrievability,
    review_urgency,
)

MONDAY = datetime(2026, 7, 26, 9, 0, tzinfo=UTC)


def test_unseen_is_not_due_and_not_urgent():
    """None is not zero. An unseen competency has nothing to decay from, and treating
    it as maximally urgent would put brand new material in the review pool."""
    assert retrievability(None, 2.0, MONDAY) is None
    assert is_due(None, 2.0, MONDAY) is False
    assert review_urgency(None, 2.0, MONDAY) == 0.0


def test_fresh_retrieval_is_fully_retrievable():
    assert retrievability(MONDAY, 2.0, MONDAY) == pytest.approx(1.0)


def test_decays_exponentially():
    one_day = retrievability(MONDAY, 2.0, MONDAY + timedelta(days=1))
    two_days = retrievability(MONDAY, 2.0, MONDAY + timedelta(days=2))
    assert one_day == pytest.approx(0.6065, abs=1e-4)
    assert two_days < one_day


def test_day_three_is_due():
    """Hana practises G006.01 on Monday; the clock advances seventy-two hours.

    Nobody wrote Day Three — this is the assertion behind that claim.
    """
    thursday = MONDAY + timedelta(hours=72)
    assert is_due(MONDAY, 1.225, thursday) is True


def test_days_until_due_follows_the_threshold():
    """R < 0.85 is reached at 0.1625 x stability, which is far sooner than the two days
    section 10 describes. Asserted so the discrepancy stays visible rather than being
    discovered during a demo."""
    assert days_until_due(1.0) == pytest.approx(0.1625, abs=1e-4)
    assert days_until_due(12.3) == pytest.approx(2.0, abs=0.01)
