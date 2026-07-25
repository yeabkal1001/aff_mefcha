"""Turning a verbatim transcript into counts.

`observed` is `correct / opportunities` and nothing else. Asking a model for a number
in [0,1] would reintroduce the session-to-session drift the authored error tags exist
to remove, so the evaluator counts rather than assesses. See ADR 0004.

Two layers, and the order matters:

1. **Deterministic.** Each competency's authored `common_errors` pairs are matched
   against the transcript. A matched `wrong` means an opportunity existed and was
   missed; a matched `right` means one existed and was taken. This layer is exact,
   free, and identical every time.
2. **Model-assisted.** An LLM widens coverage to opportunities the authored patterns
   do not name, returning the same `{opportunities, correct, error_tags}` shape.

Layer one alone is a *lower bound*, which is the safe direction to be wrong in: an
unmatched turn yields zero opportunities and therefore no evidence, rather than a
zero. A learner who avoided a structure has told us nothing about whether she can use
it, and scoring silence as failure would punish exactly the hesitant beginners this
product exists for.
"""

import re
from dataclasses import dataclass, field

from app.models import Competency

_PUNCTUATION = re.compile(r"[^\w\s']+")
_WHITESPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace. Word order is preserved
    because the error patterns are word-order errors."""
    return _WHITESPACE.sub(" ", _PUNCTUATION.sub(" ", text.lower())).strip()


@dataclass
class Judgement:
    """One competency's evidence from one turn."""

    competency_id: str
    opportunities: int = 0
    correct: int = 0
    error_tags: list[str] = field(default_factory=list)
    # Which layer produced this, so a number on screen can be traced to its source.
    source: str = "deterministic"

    @property
    def observed(self) -> float | None:
        if self.opportunities == 0:
            return None
        return self.correct / self.opportunities


def judge_transcript(
    transcript_verbatim: str, targets: list[Competency]
) -> dict[str, Judgement]:
    """Match authored error patterns against what the learner actually said.

    Reads the verbatim track only. Wispr Flow's polished transcript silently repairs
    the errors we grade, so scoring it would measure the transcriber rather than the
    learner.
    """
    haystack = normalise(transcript_verbatim or "")
    judgements: dict[str, Judgement] = {}

    for competency in targets:
        judgement = Judgement(competency_id=competency.id)
        for error in competency.common_errors:
            wrong = normalise(error.wrong)
            right = normalise(error.right)

            # Check the correct form first: "I am studying software engineering"
            # contains no occurrence of "I am study software engineering", but a
            # shorter authored `wrong` could otherwise be a substring of a correct
            # sentence.
            if right and right in haystack:
                judgement.opportunities += 1
                judgement.correct += 1
            elif wrong and wrong in haystack:
                judgement.opportunities += 1
                judgement.error_tags.append(error.tag)

        judgements[competency.id] = judgement

    return judgements


def merge(
    deterministic: dict[str, Judgement], model: dict[str, Judgement]
) -> dict[str, Judgement]:
    """Combine the two layers, letting the deterministic layer set the floor.

    A model may find opportunities the authored patterns missed, but it may never
    reduce a match against authored content or contradict a detected tag — that match
    is the reason scoring is reproducible.
    """
    out: dict[str, Judgement] = {}
    for competency_id in deterministic.keys() | model.keys():
        exact = deterministic.get(competency_id)
        guess = model.get(competency_id)
        if exact is None:
            out[competency_id] = guess  # type: ignore[assignment]
            continue
        if guess is None:
            out[competency_id] = exact
            continue

        opportunities = max(exact.opportunities, guess.opportunities)
        # Correct answers cannot exceed opportunities, and the authored floor holds.
        correct = max(exact.correct, min(guess.correct, opportunities))
        tags = exact.error_tags + [t for t in guess.error_tags if t not in exact.error_tags]
        out[competency_id] = Judgement(
            competency_id=competency_id,
            opportunities=opportunities,
            correct=min(correct, opportunities),
            error_tags=tags,
            source="deterministic+model" if exact.opportunities else "model",
        )
    return out


def needs_retry(judgements: dict[str, Judgement], targeted: set[str]) -> list[str]:
    """Which explicitly targeted competencies fell below the retry trigger.

    Only targets can trigger a retry, and only when there was evidence: no
    opportunities means no judgement to retry against.
    """
    from app.engine.constants import RETRY_TRIGGER

    out = []
    for competency_id in targeted:
        judgement = judgements.get(competency_id)
        if judgement is None:
            continue
        observed = judgement.observed
        if observed is not None and observed < RETRY_TRIGGER:
            out.append(competency_id)
    return out
