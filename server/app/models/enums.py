"""Closed value sets shared by the schema and the engine.

Stored as VARCHAR with a CHECK constraint rather than a native Postgres enum, so
adding a template family or a stimulus type stays a one-line migration.
"""

from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class Skill(StrEnum):
    """The four master libraries. A competency belongs to exactly one."""

    VOCABULARY = "vocabulary"
    GRAMMAR = "grammar"
    PRONUNCIATION = "pronunciation"
    FLUENCY = "fluency"


class Cefr(StrEnum):
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class RequirementRole(StrEnum):
    """How much a domain cares about a competency. Weights live in engine.priority."""

    CORE = "core"
    SUPPORTING = "supporting"
    INCIDENTAL = "incidental"


class TargetRole(StrEnum):
    """Why a competency is in today's session."""

    NEW = "new"
    REVIEW = "review"
    INCIDENTAL = "incidental"


class StimulusType(StrEnum):
    IMAGE = "image"
    TWO_IMAGES = "two_images"
    IMAGE_SEQUENCE = "image_sequence"
    AUDIO = "audio"
    AUDIO_QUESTION = "audio_question"
    SCENARIO = "scenario"
    STATEMENT = "statement"
    TOPIC = "topic"
    TEXT = "text"


class InteractionMode(StrEnum):
    MONOLOGUE = "monologue"
    DIALOGUE = "dialogue"


CEFR_ORDER: tuple[Cefr, ...] = (Cefr.A2, Cefr.B1, Cefr.B2, Cefr.C1, Cefr.C2)


def cefr_rank(band: str) -> int:
    """Ordinal position, so `cefr_min <= learner.cefr <= cefr_max` is comparable."""
    return CEFR_ORDER.index(Cefr(band))


def cefr_within(band: str, minimum: str, maximum: str) -> bool:
    """Has the learner reached this band, and not outgrown it?

    Also the definition of `unlocked` in the template gate: an A2 learner has not
    unlocked `F009 Expressing Opinions` because it starts at B1, which is exactly why
    Debate is never offered to Hana.
    """
    return cefr_rank(minimum) <= cefr_rank(band) <= cefr_rank(maximum)


def skill_enum(name: str) -> SAEnum:
    return SAEnum(Skill, name=name, native_enum=False, values_callable=lambda e: [m.value for m in e])


def cefr_enum(name: str) -> SAEnum:
    return SAEnum(Cefr, name=name, native_enum=False, values_callable=lambda e: [m.value for m in e])
