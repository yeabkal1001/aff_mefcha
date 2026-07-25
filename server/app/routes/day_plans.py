"""Today's Mission."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.engine.day_plan import build_day_plan
from app.models import Competency, DayPlan, Session, SessionTarget, Template
from app.schemas import DayPlanResponse, SessionResponse, SessionTargetResponse

router = APIRouter(tags=["day plans"])


async def serialise_session(db: AsyncSession, session: Session) -> SessionResponse:
    template = await db.get(Template, session.template_id)
    spec = session.spec_json or {}
    stimulus = spec.get("stimulus", {})

    targets = (
        await db.execute(
            select(SessionTarget, Competency.name)
            .join(Competency, Competency.id == SessionTarget.competency_id)
            .where(SessionTarget.session_id == session.id)
            .order_by(SessionTarget.priority.desc())
        )
    ).all()

    return SessionResponse(
        id=session.id,
        position=session.position,
        template_id=session.template_id,
        template_name=template.name if template else session.template_id,
        skill_focus=session.skill_focus,
        prompt=session.prompt,
        learning_objective=spec.get("learning_objective"),
        expected_duration_minutes=spec.get("expected_duration_minutes"),
        stimulus_type=stimulus.get("type"),
        stimulus_url=stimulus.get("asset_url"),
        targets=[
            SessionTargetResponse(
                competency_id=target.competency_id,
                name=name,
                role=target.role,
                priority=target.priority,
            )
            for target, name in targets
        ],
        completed_at=session.completed_at,
    )


@router.get("/learners/{learner_id}/day-plan", response_model=DayPlanResponse)
async def day_plan(learner_id: str, db: AsyncSession = Depends(get_db)):
    """Build today's mission, or return the one already built for today.

    The date comes from the engine clock, so advancing it by seventy-two hours runs the
    real scheduler against real rows and produces Day Three. The only fake thing is the
    date, which is why "try four days instead" still works.
    """
    try:
        plan = await build_day_plan(db, learner_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    sessions = (
        await db.scalars(
            select(Session).where(Session.day_plan_id == plan.id).order_by(Session.position)
        )
    ).all()

    return DayPlanResponse(
        id=plan.id,
        learner_id=plan.learner_id,
        date=plan.date,
        domain_id=plan.domain_id,
        theme=plan.theme,
        sessions=[await serialise_session(db, s) for s in sessions],
    )


@router.get("/day-plans/{day_plan_id}", response_model=DayPlanResponse)
async def get_day_plan(day_plan_id: str, db: AsyncSession = Depends(get_db)):
    plan = await db.get(DayPlan, day_plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail=f"no day plan {day_plan_id!r}")

    sessions = (
        await db.scalars(
            select(Session).where(Session.day_plan_id == plan.id).order_by(Session.position)
        )
    ).all()
    return DayPlanResponse(
        id=plan.id,
        learner_id=plan.learner_id,
        date=plan.date,
        domain_id=plan.domain_id,
        theme=plan.theme,
        sessions=[await serialise_session(db, s) for s in sessions],
    )
