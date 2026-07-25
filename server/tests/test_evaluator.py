"""The evaluator, including the line the demo turns on."""

from dataclasses import dataclass

from app.engine.evaluator import Judgement, judge_transcript, merge, normalise


@dataclass
class FakeError:
    wrong: str
    right: str
    tag: str


@dataclass
class FakeCompetency:
    id: str
    common_errors: list[FakeError]


G006_01 = FakeCompetency(
    id="G006.01",
    common_errors=[
        FakeError("I am study software engineering", "I am studying software engineering",
                  "missing_participle"),
        FakeError("I study now", "I am studying now", "tense_substitution"),
    ],
)


def test_normalise_strips_punctuation_and_case():
    assert normalise("I am study, Software Engineering!") == "i am study software engineering"


def test_catches_the_demo_error_deterministically():
    """"I am study software engineering" matches `missing_participle` exactly — no
    open-ended judgement, so it is graded the same way every time."""
    judgements = judge_transcript(
        "Hello, my name is Hana. I am study software engineering.", [G006_01]
    )
    j = judgements["G006.01"]
    assert j.opportunities == 1
    assert j.correct == 0
    assert j.error_tags == ["missing_participle"]
    assert j.observed == 0.0


def test_credits_the_corrected_form_on_retry():
    judgements = judge_transcript("I am studying software engineering.", [G006_01])
    j = judgements["G006.01"]
    assert j.opportunities == 1
    assert j.correct == 1
    assert j.observed == 1.0


def test_silence_yields_no_evidence_rather_than_zero():
    """The trap the opportunity ratio exists to avoid: a learner who avoids a structure
    has told you nothing about whether she can use it."""
    judgements = judge_transcript("Yes.", [G006_01])
    j = judgements["G006.01"]
    assert j.opportunities == 0
    assert j.observed is None


def test_merge_keeps_the_authored_floor():
    """A model may widen coverage; it may not overrule a match against authored content."""
    deterministic = {
        "G006.01": Judgement("G006.01", opportunities=1, correct=0,
                             error_tags=["missing_participle"])
    }
    model = {"G006.01": Judgement("G006.01", opportunities=3, correct=3, error_tags=[])}
    merged = merge(deterministic, model)["G006.01"]
    assert merged.opportunities == 3
    assert merged.correct <= merged.opportunities
    assert "missing_participle" in merged.error_tags
