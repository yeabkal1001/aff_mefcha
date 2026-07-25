"""Creating a learner, placing them, and seeding the opening profile.

Onboarding asks four things — native language, Life Path, study field, daily time and
feedback language — and never asks for a CEFR level. Most learners do not know it, and
the ones who think they do guess high.

The four-minute assessment is a **prop** for the demo, and this is where the fake
lives. Read `seed_opening_profile` for what exactly is faked and what is not.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import now as engine_now
from app.engine.placement import ComplexityRead, read_complexity
from app.models import Competency, LearnerCompetency, LearnerProfile
from app.models.enums import cefr_within

# PROP: the opening numbers a real four-minute assessment would produce. The engine
# that consumes them is real — these are written as ordinary `learner_competency` rows
# with evidence_count = 1, so the very first session updates them through the normal
# mastery path in engine/mastery.py and the Profile is computed from them like any
# other day. Spending four minutes of stage time to generate a number the audience
# never sees is waste; faking the *input* and letting real code run on it is the whole
# technique (see .cursor/skills/demo-fidelity/PROPS.md).
#
# Narration if a judge asks: "The opening profile is seeded. Every number you watch
# move after it was computed by the engine you just saw run."
#
# The per-skill value is the learner's general level in that skill. It is a *baseline*,
# not a flat fill: a learner is not equally good at every grammar point, and seeding her
# that way has a consequence beyond realism. A competency only enters the new-concept
# pool below NEW_CONCEPT_MASTERY_CEILING, so a flat 0.62 across grammar makes every
# grammar competency permanently ineligible and the scheduler can only ever pick
# fluency. The overrides below are what give the engine something to teach.
SEED_BASELINE: dict[str, float] = {
    "grammar": 0.66,
    "vocabulary": 0.72,
    "pronunciation": 0.65,
    "fluency": 0.47,
}

# Hana's specific weaknesses, and the reason each one is where it is. The baselines
# above are chosen so that these average out to the opening Profile in persona.md:
# Grammar 62%, Vocabulary 67%, Pronunciation 58%, Fluency 44%, Confidence 39%.
SEED_OVERRIDES: dict[str, float] = {
    # The competency the whole demo turns on. Must sit below the new-concept ceiling or
    # "I am study software engineering" never gets scheduled on day one.
    "G006.01": 0.30,
    # She has to name her field, and cannot yet.
    "V001.05": 0.40,
    # Amharic /p/ vs /b/ on "programming" and "presentation".
    "P001.08": 0.45,
    # Delivery-sensitive, and lower than Fluency's average — this is what makes the
    # Confidence bundle open at 39% rather than at 47%.
    "F003.01": 0.39,
    "F002.01": 0.39,
}

# Deliberately weak: alpha = 1/(1+1) = 0.5, so the second week of real sessions can
# move an estimate substantially. That is why the profile appears to improve quickly at
# first — not a trick, just a wide prior narrowing.
SEED_EVIDENCE_COUNT = 1


@dataclass(frozen=True)
class OnboardingResult:
    learner_id: str
    cefr: str
    placement: ComplexityRead | None
    seeded_competencies: int


async def create_learner(
    db: AsyncSession,
    *,
    learner_id: str,
    display_name: str | None,
    life_path_id: str,
    l1: str = "am",
    study_field: str | None = None,
    daily_minutes: int = 20,
    feedback_language: str = "am",
    assessment_transcripts: list[str] | None = None,
    assessment_error_count: int = 0,
) -> OnboardingResult:
    """Place the learner, then seed inside the placed band.

    Two independent jobs: the complexity read sets the band, and seeding fills the
    learner model so no fixed dimension opens empty.
    """
    at = engine_now()

    placement = (
        read_complexity(assessment_transcripts, error_count=assessment_error_count)
        if assessment_transcripts
        else None
    )
    cefr = placement.band if placement else "A2"

    existing = await db.get(LearnerProfile, learner_id)
    if existing is not None:
        raise ValueError(f"learner {learner_id!r} already exists")

    db.add(
        LearnerProfile(
            learner_id=learner_id,
            display_name=display_name,
            cefr=cefr,
            l1=l1,
            life_path_id=life_path_id,
            study_field=study_field,
            daily_minutes=daily_minutes,
            feedback_language=feedback_language,
            created_at=at,
        )
    )
    await db.flush()

    seeded = await seed_opening_profile(db, learner_id=learner_id, cefr=cefr, at=at)
    await db.commit()

    return OnboardingResult(
        learner_id=learner_id, cefr=cefr, placement=placement, seeded_competencies=seeded
    )


async def seed_opening_profile(
    db: AsyncSession, *, learner_id: str, cefr: str, at=None
) -> int:
    """Write the baseline the assessment stands in for.

    Only observable competencies inside the placed band are seeded, because the engine
    must never hold an estimate for something it cannot grade. `last_seen` is set so
    retrievability is defined from the start — otherwise nothing would ever fall due
    and the scheduler would have nothing to schedule.
    """
    at = at or engine_now()
    competencies = (await db.scalars(select(Competency))).all()

    count = 0
    for competency in competencies:
        if not competency.observable:
            continue
        if not cefr_within(cefr, competency.cefr_min, competency.cefr_max):
            continue
        mastery = SEED_OVERRIDES.get(competency.id, SEED_BASELINE.get(competency.skill))
        if mastery is None:
            continue
        db.add(
            LearnerCompetency(
                learner_id=learner_id,
                competency_id=competency.id,
                mastery=mastery,
                stability_days=1.0,
                evidence_count=SEED_EVIDENCE_COUNT,
                last_seen=at,
            )
        )
        count += 1

    await db.flush()
    return count
