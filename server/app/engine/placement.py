"""CEFR placement from a global complexity read of the speech itself.

Placing a learner as "the highest band where seeded competencies average >= 0.5"
cannot work, because the assessment has to use stimuli pitched at some band before the
band is known: probe at A2 and a B2 speaker scores 1.0 on A2 competencies while
producing no evidence at all about B1 ones, so their average is undefined rather than
high, and the rule can never return above the band you happened to probe at.

So placement measures the language rather than checking it against a syllabus — mean
sentence length, subordination, lexical range and error density across all samples.
Seeding competencies is a separate job that happens afterwards, inside the placed
band. See ADR 0005.
"""

import re
from dataclasses import dataclass

from app.models.enums import CEFR_ORDER, Cefr, cefr_rank

# Only A2 content is authored, so placement cannot honestly return higher yet. The
# mechanism will place higher the moment B1 content exists — this is a content ceiling,
# not a rule that only appeared to work.
AUTHORED_MAX_BAND = Cefr.A2

SUBORDINATORS = {
    "because", "although", "though", "while", "whereas", "since", "unless",
    "which", "who", "whom", "whose", "that", "when", "whenever", "where",
    "if", "after", "before", "until", "so",
}

_SENTENCE_SPLIT = re.compile(r"[.?!]+")
_WORD = re.compile(r"[\w']+")

# Band floors on the composite read. Ties round down: starting a learner too low costs
# one easy week, starting her too high costs her confidence.
BAND_FLOORS: list[tuple[Cefr, float]] = [
    (Cefr.C2, 0.86),
    (Cefr.C1, 0.72),
    (Cefr.B2, 0.56),
    (Cefr.B1, 0.38),
    (Cefr.A2, 0.0),
]


@dataclass(frozen=True)
class ComplexityRead:
    mean_sentence_length: float
    subordination_rate: float
    lexical_range: float
    error_density: float
    composite: float
    measured_band: str
    band: str
    capped_by_content: bool


def read_complexity(transcripts: list[str], *, error_count: int = 0) -> ComplexityRead:
    """Fold the assessment samples into one band.

    Needs no band-specific content because it never asks whether a particular
    structure was correct — only how complex the language was and how often it broke.
    """
    text = " ".join(t for t in transcripts if t).strip()
    words = [w.lower() for w in _WORD.findall(text)]
    sentences = [s for s in _SENTENCE_SPLIT.split(text) if s.strip()]

    if not words:
        return ComplexityRead(0.0, 0.0, 0.0, 0.0, 0.0, Cefr.A2, AUTHORED_MAX_BAND, False)

    sentence_count = max(len(sentences), 1)
    mean_sentence_length = len(words) / sentence_count
    subordination_rate = sum(1 for w in words if w in SUBORDINATORS) / sentence_count
    lexical_range = len(set(words)) / len(words)
    error_density = error_count / len(words) * 100.0

    # Each term normalised to roughly [0,1] over the A2-C2 range, then averaged. Error
    # density subtracts: fluent-but-broken speech is not a higher band.
    composite = (
        0.35 * min(mean_sentence_length / 18.0, 1.0)
        + 0.30 * min(subordination_rate / 1.5, 1.0)
        + 0.25 * min(lexical_range / 0.6, 1.0)
        + 0.10 * max(0.0, 1.0 - error_density / 12.0)
    )

    measured = next(band for band, floor in BAND_FLOORS if composite >= floor)
    capped = cefr_rank(measured) > cefr_rank(AUTHORED_MAX_BAND)

    return ComplexityRead(
        mean_sentence_length=mean_sentence_length,
        subordination_rate=subordination_rate,
        lexical_range=lexical_range,
        error_density=error_density,
        composite=composite,
        measured_band=measured,
        band=AUTHORED_MAX_BAND if capped else measured,
        capped_by_content=capped,
    )


def bands_up_to(band: str) -> list[str]:
    return [b for b in CEFR_ORDER if cefr_rank(b) <= cefr_rank(band)]
