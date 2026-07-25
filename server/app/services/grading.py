"""Recording what the learner said, judging it, and writing the evidence.

The order is fixed and each step owns one thing:

    record_turn      one utterance, its audio, both transcripts, its delivery metrics
    grade_turn       one competency judgement per target, stored as counts
    finalise_session one mastery update per targeted competency, from the final attempt

The invariant that shapes all of it: every attempt is stored, because "what changed
between your first answer and your second?" needs both, but **one session-and-competency
pair is one piece of evidence**. Counting retries separately would let a failed session
with two retries reach the promotion floor, and would shrink alpha fastest for exactly
the learners whose estimates most need to keep moving. See ADR 0003.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.clock import now as engine_now
from app.engine.constants import MAX_RETRIES, RETRY_TRIGGER, STABILITY_RESET
from app.engine.delivery import judge_delivery
from app.engine.evaluator import Judgement, judge_transcript, merge
from app.engine.mastery import MasteryUpdate, apply_update
from app.engine.metrics import compute_metrics
from app.models import (
    Attempt,
    Competency,
    DayPlan,
    LearnerCompetency,
    LearnerError,
    Session,
    SessionTarget,
    Template,
    TemplateMeasures,
    Turn,
)


@dataclass(frozen=True)
class GradedTurn:
    turn_id: str
    judgements: dict[str, Judgement]
    retry_needed: list[str]
    scaffold_level: int
    retries_exhausted: bool


@dataclass(frozen=True)
class SessionOutcome:
    session_id: str
    updates: dict[str, MasteryUpdate]
    # Competencies that failed twice: stability is reset and their prerequisites want
    # re-checking, since a repeated failure at G012 should surface as a G007 problem.
    prerequisite_recheck: list[str]


async def _session_targets(db: AsyncSession, session_id: str) -> list[SessionTarget]:
    return list(
        (
            await db.scalars(
                select(SessionTarget).where(SessionTarget.session_id == session_id)
            )
        ).all()
    )


async def record_turn(
    db: AsyncSession,
    *,
    session_id: str,
    audio_url: str | None = None,
    transcript_verbatim: str | None = None,
    transcript_clean: str | None = None,
    words: list[dict] | None = None,
    scaffold_level: int = 0,
) -> Turn:
    """Store one uninterrupted stretch of speech.

    `transcript_verbatim` and the word timestamps come from the transcriber and are what
    every measurement reads. `transcript_clean` is the polished version, kept for the
    reflection screen's "how it could sound" panel and never graded.
    """
    at = engine_now()
    next_index = (
        await db.scalar(
            select(Turn.index)
            .where(Turn.session_id == session_id)
            .order_by(Turn.index.desc())
            .limit(1)
        )
    )
    metrics = compute_metrics(words or [], punctuated_transcript=transcript_clean)

    turn = Turn(
        session_id=session_id,
        index=0 if next_index is None else next_index + 1,
        audio_url=audio_url,
        transcript_verbatim=transcript_verbatim,
        transcript_clean=transcript_clean,
        metrics_json=metrics.as_json(),
        scaffold_level=scaffold_level,
        created_at=at,
    )
    db.add(turn)
    await db.flush()
    return turn


async def grade_turn(
    db: AsyncSession, turn_id: str, *, model_judgements: dict[str, Judgement] | None = None
) -> GradedTurn:
    """Judge one turn against the competencies its session targets.

    Untargeted competencies are not judged: a session says what it is looking at, and
    grading everything would produce evidence from templates that cannot observe it.
    """
    turn = await db.get(Turn, turn_id)
    if turn is None:
        raise LookupError(f"no turn {turn_id!r}")

    session = await db.get(Session, turn.session_id)
    template = await db.get(Template, session.template_id)
    targets = await _session_targets(db, session.id)
    targeted = {t.competency_id for t in targets}

    competencies = list(
        (
            await db.scalars(
                select(Competency)
                .options(selectinload(Competency.common_errors))
                .where(Competency.id.in_(targeted))
            )
        ).all()
    )

    judgements = judge_transcript(turn.transcript_verbatim or "", competencies)
    delivery = judge_delivery(
        compute_metrics([], punctuated_transcript=None)
        if not turn.metrics_json
        else _metrics_from_json(turn.metrics_json),
        targeted,
        is_answer=template.interaction_mode == "dialogue",
    )
    judgements = merge(judgements, delivery)
    if model_judgements:
        judgements = merge(judgements, model_judgements)

    for competency_id, judgement in judgements.items():
        await db.execute(
            pg_insert(Attempt)
            .values(
                turn_id=turn.id,
                competency_id=competency_id,
                opportunities=judgement.opportunities,
                correct=judgement.correct,
                error_tags_json=judgement.error_tags,
                scaffold_level=turn.scaffold_level,
                is_final=False,
                created_at=turn.created_at,
            )
            .on_conflict_do_update(
                index_elements=["turn_id", "competency_id"],
                set_={
                    "opportunities": judgement.opportunities,
                    "correct": judgement.correct,
                    "error_tags_json": judgement.error_tags,
                },
            )
        )
    await db.flush()

    failing = [
        competency_id
        for competency_id in targeted
        if (j := judgements.get(competency_id)) is not None
        and j.observed is not None
        and j.observed < RETRY_TRIGGER
    ]

    return GradedTurn(
        turn_id=turn.id,
        judgements=judgements,
        retry_needed=failing if turn.scaffold_level < MAX_RETRIES else [],
        scaffold_level=turn.scaffold_level,
        retries_exhausted=bool(failing) and turn.scaffold_level >= MAX_RETRIES,
    )


def _metrics_from_json(metrics_json: dict):
    from app.engine.metrics import TurnMetrics

    fields = TurnMetrics.__dataclass_fields__
    return TurnMetrics(**{k: metrics_json.get(k, 0) for k in fields})


async def finalise_session(db: AsyncSession, session_id: str) -> SessionOutcome:
    """Resolve a session's attempts into one mastery update per competency.

    The final attempt with any opportunities wins, at its scaffolded weight, because a
    scaffolded success is weaker evidence than an unscaffolded one. A competency the
    learner never got an opportunity on produces no evidence and no update.
    """
    at = engine_now()
    session = await db.get(Session, session_id)
    if session is None:
        raise LookupError(f"no session {session_id!r}")

    day_plan = await db.get(DayPlan, session.day_plan_id)
    learner_id = day_plan.learner_id
    targets = await _session_targets(db, session_id)
    targeted = {t.competency_id for t in targets}

    reliability = {
        row.skill: row.reliability
        for row in (
            await db.scalars(
                select(TemplateMeasures).where(
                    TemplateMeasures.template_id == session.template_id
                )
            )
        ).all()
    }

    turns = list(
        (
            await db.scalars(
                select(Turn).where(Turn.session_id == session_id).order_by(Turn.index)
            )
        ).all()
    )
    attempts = list(
        (
            await db.scalars(
                select(Attempt)
                .where(Attempt.turn_id.in_([t.id for t in turns]))
                .order_by(Attempt.created_at)
            )
        ).all()
    )
    turn_index = {t.id: t.index for t in turns}

    updates: dict[str, MasteryUpdate] = {}
    recheck: list[str] = []

    for competency_id in targeted:
        relevant = [
            a
            for a in attempts
            if a.competency_id == competency_id and a.opportunities > 0
        ]
        for a in relevant:
            a.is_final = False
        if not relevant:
            continue

        final = max(relevant, key=lambda a: turn_index.get(a.turn_id, 0))
        final.is_final = True

        competency = await db.get(Competency, competency_id)
        state = await db.get(LearnerCompetency, (learner_id, competency_id))
        if state is None:
            state = LearnerCompetency(
                learner_id=learner_id,
                competency_id=competency_id,
                mastery=0.0,
                stability_days=1.0,
                evidence_count=0,
            )
            db.add(state)

        observed = final.correct / final.opportunities
        update = apply_update(
            mastery=state.mastery,
            stability_days=state.stability_days,
            evidence_count=state.evidence_count,
            observed=observed,
            reliability=reliability.get(competency.skill, 0.0),
            scaffolded=final.scaffold_level > 0,
        )

        state.mastery = update.mastery_after
        state.stability_days = update.stability_after
        state.evidence_count = update.evidence_count_after
        # Set on every piece of evidence, not only on success. Leaving it unset after a
        # failure would make retrievability undefined and the competency would never
        # come due — failure already shortens the interval by shrinking stability.
        state.last_seen = at
        state.last_template = session.template_id
        state.last_theme = day_plan.theme

        if observed < RETRY_TRIGGER and final.scaffold_level >= MAX_RETRIES:
            state.stability_days = STABILITY_RESET
            recheck.append(competency_id)

        for tag in final.error_tags_json or []:
            await db.execute(
                pg_insert(LearnerError)
                .values(
                    learner_id=learner_id,
                    competency_id=competency_id,
                    tag=tag,
                    count=1,
                    last_seen=at,
                )
                .on_conflict_do_update(
                    index_elements=["learner_id", "competency_id", "tag"],
                    set_={
                        "count": LearnerError.__table__.c.count + 1,
                        "last_seen": at,
                    },
                )
            )

        updates[competency_id] = update

    session.completed_at = at
    await db.commit()

    return SessionOutcome(session_id=session_id, updates=updates, prerequisite_recheck=recheck)
