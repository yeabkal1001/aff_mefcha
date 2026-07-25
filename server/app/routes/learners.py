"""Onboarding and the Communication Profile."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import now as engine_now
from app.db import get_db
from app.engine.profile import read_profile
from app.engine.retrievability import is_due
from app.models import Competency, LearnerCompetency, LearnerProfile
from app.schemas import (
    DimensionResponse,
    OnboardingRequest,
    OnboardingResponse,
    PlacementRead,
    ProfileResponse,
)
from app.services.onboarding import create_learner

router = APIRouter(tags=["learners"])


@router.post("/learners", response_model=OnboardingResponse)
async def onboard(body: OnboardingRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await create_learner(
            db,
            learner_id=body.learner_id,
            display_name=body.display_name,
            life_path_id=body.life_path_id,
            l1=body.l1,
            study_field=body.study_field,
            daily_minutes=body.daily_minutes,
            feedback_language=body.feedback_language,
            assessment_transcripts=body.assessment_transcripts,
            assessment_error_count=body.assessment_error_count,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return OnboardingResponse(
        learner_id=result.learner_id,
        cefr=result.cefr,
        seeded_competencies=result.seeded_competencies,
        placement=(
            PlacementRead(**result.placement.__dict__) if result.placement else None
        ),
    )


async def due_count(db: AsyncSession, learner_id: str) -> int:
    """How many competencies have fallen below the review threshold right now.

    The learner sees this number; the Profile does not move when something falls due.
    Decay surfaces here and in the Improve ring, never as a falling percentage.
    """
    at = engine_now()
    rows = (
        await db.execute(
            select(
                LearnerCompetency.last_seen,
                LearnerCompetency.stability_days,
            )
            .join(Competency, Competency.id == LearnerCompetency.competency_id)
            .where(
                LearnerCompetency.learner_id == learner_id,
                Competency.observable.is_(True),
            )
        )
    ).all()
    return sum(1 for last_seen, stability in rows if is_due(last_seen, stability, at))


@router.get("/learners/{learner_id}/profile", response_model=ProfileResponse)
async def profile(learner_id: str, db: AsyncSession = Depends(get_db)):
    learner = await db.get(LearnerProfile, learner_id)
    if learner is None:
        raise HTTPException(status_code=404, detail=f"no learner {learner_id!r}")

    dimensions = await read_profile(db, learner_id)
    return ProfileResponse(
        learner_id=learner_id,
        cefr=learner.cefr,
        life_path_id=learner.life_path_id,
        dimensions=[DimensionResponse(**d.__dict__) for d in dimensions],
        due_count=await due_count(db, learner_id),
    )
