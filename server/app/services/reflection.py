"""Stage six: the learner names what changed.

This is the smallest moment in a session and possibly the most important one. Because
she named the error herself, the system knows the correction landed instead of merely
being heard — so a matching self-report raises confidence in the estimate rather than
mastery itself. Metacognitive accuracy tells you the number is trustworthy, not that
the skill is stronger.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clock import now as engine_now
from app.engine.evaluator import normalise
from app.models import (
    Attempt,
    Competency,
    DayPlan,
    LearnerCompetency,
    Reflection,
    Session,
    Turn,
)


@dataclass(frozen=True)
class ReflectionResult:
    session_id: str
    matched_error_tag: str | None
    # Which competency's confidence went up, if any.
    confidence_raised_for: str | None


def _distinctive_words(wrong: str, right: str) -> set[str]:
    """Words that appear in the corrected form but not the mistaken one.

    For "I am study" -> "I am studying" that is {"studying"}, so a learner who says
    "I said studying, not study" has demonstrably named the change.
    """
    return set(normalise(right).split()) - set(normalise(wrong).split())


async def record_reflection(
    db: AsyncSession, *, session_id: str, learner_text: str
) -> ReflectionResult:
    session = await db.get(Session, session_id)
    if session is None:
        raise LookupError(f"no session {session_id!r}")

    said = set(normalise(learner_text).split())

    turn_ids = list(
        (await db.scalars(select(Turn.id).where(Turn.session_id == session_id))).all()
    )
    attempts = list(
        (
            await db.scalars(
                select(Attempt).where(
                    Attempt.turn_id.in_(turn_ids), Attempt.error_tags_json != []
                )
            )
        ).all()
    )

    matched_tag: str | None = None
    matched_competency: str | None = None

    for attempt in attempts:
        detected = set(attempt.error_tags_json or [])
        if not detected:
            continue
        competency = await db.scalar(
            select(Competency)
            .options(selectinload(Competency.common_errors))
            .where(Competency.id == attempt.competency_id)
        )
        if competency is None:
            continue
        for error in competency.common_errors:
            if error.tag not in detected:
                continue
            if _distinctive_words(error.wrong, error.right) & said:
                matched_tag = error.tag
                matched_competency = competency.id
                break
        if matched_tag:
            break

    at = engine_now()
    existing = await db.get(Reflection, session_id)
    if existing is None:
        db.add(
            Reflection(
                session_id=session_id,
                learner_text=learner_text,
                matched_error_tag=matched_tag,
                created_at=at,
            )
        )
    else:
        existing.learner_text = learner_text
        existing.matched_error_tag = matched_tag

    if matched_competency is not None:
        day_plan = await db.get(DayPlan, session.day_plan_id)
        state = await db.get(
            LearnerCompetency, (day_plan.learner_id, matched_competency)
        )
        if state is not None:
            # Confidence in the estimate, not the estimate itself: a higher evidence
            # count lowers alpha, so the number stops swinging rather than climbing.
            state.evidence_count += 1

    await db.commit()
    return ReflectionResult(
        session_id=session_id,
        matched_error_tag=matched_tag,
        confidence_raised_for=matched_competency,
    )
