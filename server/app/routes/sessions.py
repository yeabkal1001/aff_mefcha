"""Running one activity: speak, get judged, retry, reflect, record."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.engine.profile import read_profile
from app.models import CompetencyError, DayPlan, Session, Template
from app.routes.day_plans import serialise_session
from app.schemas import (
    CorrectionHint,
    DimensionResponse,
    JudgementResponse,
    MasteryUpdateResponse,
    ReflectionRequest,
    ReflectionResponse,
    SessionOutcomeResponse,
    SessionResponse,
    TurnRequest,
    TurnResponse,
)
from app.services.grading import finalise_session, grade_turn, record_turn
from app.services.reflection import record_reflection

router = APIRouter(tags=["sessions"])


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"no session {session_id!r}")
    return await serialise_session(db, session)


@router.post("/sessions/{session_id}/turns", response_model=TurnResponse)
async def post_turn(
    session_id: str, body: TurnRequest, db: AsyncSession = Depends(get_db)
):
    """Record a turn and judge it against the session's targets.

    The response carries the retry decision: `observed < 0.6` on any explicitly
    targeted competency triggers one, and the scaffold prompt is the next rung of the
    template's ladder. Mastery does not move here — only the final attempt counts, and
    that is resolved when the session is finalised.
    """
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"no session {session_id!r}")

    turn = await record_turn(
        db,
        session_id=session_id,
        audio_url=body.audio_url,
        transcript_verbatim=body.transcript_verbatim,
        transcript_clean=body.transcript_clean,
        words=body.words,
        scaffold_level=body.scaffold_level,
    )
    graded = await grade_turn(db, turn.id)
    await db.commit()

    scaffold_prompt = None
    if graded.retry_needed:
        template = await db.get(Template, session.template_id)
        ladder = (template.scaffold_ladder_json or []) if template else []
        rung = min(turn.scaffold_level, len(ladder) - 1) if ladder else -1
        scaffold_prompt = ladder[rung] if rung >= 0 else None

    # Pull the authored wrong/right forms for every tag that fired, so the
    # correction card can mark a span without inventing one.
    tagged: list[tuple[str, str]] = []
    for competency_id, judgement in graded.judgements.items():
        for tag in judgement.error_tags:
            tagged.append((competency_id, tag))

    corrections: list[CorrectionHint] = []
    if tagged:
        tags = {tag for _, tag in tagged}
        rows = list(
            (
                await db.scalars(
                    select(CompetencyError).where(CompetencyError.tag.in_(tags))
                )
            ).all()
        )
        by_key = {(row.competency_id, row.tag): row for row in rows}
        seen: set[tuple[str, str]] = set()
        for competency_id, tag in tagged:
            key = (competency_id, tag)
            if key in seen:
                continue
            seen.add(key)
            row = by_key.get(key)
            if row is None:
                continue
            corrections.append(
                CorrectionHint(
                    competency_id=competency_id,
                    tag=tag,
                    wrong=row.wrong,
                    right=row.right,
                )
            )

    return TurnResponse(
        turn_id=turn.id,
        metrics=turn.metrics_json or {},
        judgements=[
            JudgementResponse(
                competency_id=j.competency_id,
                opportunities=j.opportunities,
                correct=j.correct,
                observed=j.observed,
                error_tags=j.error_tags,
                source=j.source,
            )
            for j in graded.judgements.values()
        ],
        retry_needed=graded.retry_needed,
        retries_exhausted=graded.retries_exhausted,
        scaffold_prompt=scaffold_prompt,
        corrections=corrections,
    )


@router.post("/sessions/{session_id}/finalise", response_model=SessionOutcomeResponse)
async def post_finalise(session_id: str, db: AsyncSession = Depends(get_db)):
    """Resolve the session into evidence and move the learner model.

    One update per targeted competency, from the final attempt at its scaffolded
    weight. The returned dimensions are recomputed from the learner model, which is why
    the before/after screen cannot disagree with it.
    """
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"no session {session_id!r}")

    outcome = await finalise_session(db, session_id)
    day_plan = await db.get(DayPlan, session.day_plan_id)
    dimensions = await read_profile(db, day_plan.learner_id)

    return SessionOutcomeResponse(
        session_id=session_id,
        updates=[
            MasteryUpdateResponse(
                competency_id=competency_id,
                observed=u.observed,
                alpha=u.alpha,
                weight=u.weight,
                scaffolded=u.scaffolded,
                mastery_before=u.mastery_before,
                mastery_after=u.mastery_after,
                stability_before=u.stability_before,
                stability_after=u.stability_after,
                evidence_count_after=u.evidence_count_after,
            )
            for competency_id, u in outcome.updates.items()
        ],
        prerequisite_recheck=outcome.prerequisite_recheck,
        dimensions=[DimensionResponse(**d.__dict__) for d in dimensions],
    )


@router.post("/sessions/{session_id}/reflection", response_model=ReflectionResponse)
async def post_reflection(
    session_id: str, body: ReflectionRequest, db: AsyncSession = Depends(get_db)
):
    try:
        result = await record_reflection(
            db, session_id=session_id, learner_text=body.learner_text
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ReflectionResponse(
        session_id=result.session_id,
        matched_error_tag=result.matched_error_tag,
        confidence_raised_for=result.confidence_raised_for,
    )
