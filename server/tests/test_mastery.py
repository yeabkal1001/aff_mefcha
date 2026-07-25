"""The mastery update, checked against the worked example in session-engine.md."""

import pytest

from app.engine.mastery import alpha_for, apply_update


def test_first_evidence_replaces_the_prior():
    """alpha = 1/(1+0) = 1, which is why the profile moves hard in the first week."""
    assert alpha_for(0) == 1.0
    assert alpha_for(1) == 0.5


def test_alpha_floors_so_estimates_keep_moving():
    assert alpha_for(100) == pytest.approx(0.15)


def test_hana_g006_01_retry_matches_the_worked_example():
    """Section 10: first evidence, EX001 grammar reliability 0.75, scaffolded.

    The document reads "weight = 0.75 x 0.6, giving roughly 0.34".
    """
    update = apply_update(
        mastery=0.0,
        stability_days=1.0,
        evidence_count=0,
        observed=0.75,
        reliability=0.75,
        scaffolded=True,
    )
    assert update.weight == pytest.approx(0.45)
    assert update.mastery_after == pytest.approx(0.3375)
    assert update.evidence_count_after == 1


def test_scaffolded_success_is_weaker_evidence():
    kwargs = dict(
        mastery=0.4, stability_days=2.0, evidence_count=2, observed=1.0, reliability=0.8
    )
    unscaffolded = apply_update(**kwargs, scaffolded=False)
    scaffolded = apply_update(**kwargs, scaffolded=True)
    assert scaffolded.mastery_after < unscaffolded.mastery_after


def test_stability_grows_on_success_and_shrinks_on_failure():
    up = apply_update(
        mastery=0.5, stability_days=2.0, evidence_count=1, observed=1.0,
        reliability=1.0, scaffolded=False,
    )
    down = apply_update(
        mastery=0.5, stability_days=2.0, evidence_count=1, observed=0.0,
        reliability=1.0, scaffolded=False,
    )
    assert up.stability_after == pytest.approx(2.9)
    assert down.stability_after == pytest.approx(1.1)
    # Never non-positive, whatever the observation.
    assert down.stability_after > 0


def test_mastery_stays_in_range():
    update = apply_update(
        mastery=0.99, stability_days=5.0, evidence_count=0, observed=1.0,
        reliability=1.0, scaffolded=False,
    )
    assert 0.0 <= update.mastery_after <= 1.0
