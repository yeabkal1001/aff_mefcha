"""Assembling Today's Mission.

    budget  = LOAD_TABLE[cefr]
    domain  = highestPriorityIncompleteDomain(life_path, cefr)
    reviews = due competencies by priority
    new     = domain requirements, prerequisites met, mastery < 0.5, by priority
    theme   = life path substitution of the domain's next practice context

A Mission is the themed Day Plan and the sessions are the activities inside it, which
is why four activities read as one story rather than four drills. This is the top of
the stored hierarchy: nothing above it is a row anywhere. See ADR 0001.
"""

import math
from dataclasses import dataclass
from datetime import date as date_type
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import now as engine_now
from app.engine.constants import LOAD_TABLE, RECENT_SESSION_WINDOW
from app.engine.selection import (
    Candidate,
    LearnerView,
    highest_priority_incomplete_domain,
    load_learner_view,
    new_candidates,
    review_candidates,
)
from app.engine.session_builder import (
    build_evaluation_metrics,
    choose_template,
    load_template_views,
    resolve_stimulus,
    retry_rules,
    target_set_key,
)
from app.engine.wording import learning_objective, opening_prompt, reflection_prompt
from app.models import (
    DayPlan,
    Domain,
    DomainContext,
    LifePathContext,
    LifePathTemplatePref,
    Session,
    SessionTarget,
)


@dataclass(frozen=True)
class PlannedTarget:
    candidate: Candidate
    # new | review — why this competency is in today's plan, as opposed to the
    # curriculum role that gave it its weight.
    target_role: str


def group_into_sessions(
    targets: list[PlannedTarget], session_count: int
) -> list[list[PlannedTarget]]:
    """Spread targets across the day's activities in priority order.

    Fills the day's session budget rather than packing targets into as few activities as
    possible: the learner was promised four short activities, and three long ones is a
    different experience. Any remainder goes to the earliest groups, so the two
    strongest targets share an activity — naming your field of study and describing what
    you are doing are one piece of speech, not two.
    """
    if not targets or session_count <= 0:
        return []

    groups: list[list[PlannedTarget]] = []
    remaining = len(targets)
    index = 0
    for slot in range(min(session_count, len(targets))):
        slots_left = min(session_count, len(targets)) - slot
        take = math.ceil(remaining / slots_left)
        groups.append(targets[index : index + take])
        index += take
        remaining -= take
    return groups


async def resolve_theme(db: AsyncSession, view: LearnerView, domain: Domain) -> str:
    """The Practice Context this domain offers next, rewritten into the learner's world.

    Rotation is by how many day plans this learner has already had in this domain, so
    day three lands on a different scene without anyone scheduling one. A context with
    no substitution authored passes through unchanged rather than failing.
    """
    contexts = (
        await db.scalars(
            select(DomainContext.text)
            .where(DomainContext.domain_id == domain.id)
            .order_by(DomainContext.position)
        )
    ).all()
    if not contexts:
        return domain.name

    used = await db.scalar(
        select(func.count(DayPlan.id)).where(
            DayPlan.learner_id == view.profile.learner_id, DayPlan.domain_id == domain.id
        )
    )
    practice_context = contexts[(used or 0) % len(contexts)]

    substituted = await db.scalar(
        select(LifePathContext.to_context).where(
            LifePathContext.life_path_id == view.profile.life_path_id,
            LifePathContext.from_context == practice_context,
        )
    )
    return substituted or practice_context


async def build_day_plan(
    db: AsyncSession, learner_id: str, *, at: datetime | None = None
) -> DayPlan:
    """Build and persist one day's mission. Existing plans for the date are returned.

    Re-running is a read: the plan for a date is built once, so a learner refreshing
    the dashboard does not get a different mission halfway through the morning.
    """
    at = at or engine_now()
    plan_date: date_type = at.date()

    existing = await db.scalar(
        select(DayPlan).where(DayPlan.learner_id == learner_id, DayPlan.date == plan_date)
    )
    if existing is not None:
        return existing

    view = await load_learner_view(db, learner_id)
    budget = LOAD_TABLE[view.profile.cefr]
    domain = await highest_priority_incomplete_domain(db, view)
    theme = await resolve_theme(db, view, domain)

    reviews = await review_candidates(db, view, at, budget.reviews)

    # "Day 1 has nothing due, so all slots go to new concepts." An unfilled review slot
    # is not a shorter day, it is room for something new — otherwise a beginner's first
    # mission is two thirds the length of every later one.
    new_budget = budget.new_concepts + (budget.reviews - len(reviews))
    new = await new_candidates(db, view, domain.id, at, new_budget)

    planned = [PlannedTarget(c, "new") for c in new] + [
        PlannedTarget(c, "review") for c in reviews
    ]
    if not planned:
        raise LookupError(
            f"nothing to practise for {learner_id!r}: no due competencies and no "
            f"unmastered requirements in {domain.id}"
        )

    plan = DayPlan(
        learner_id=learner_id,
        date=plan_date,
        domain_id=domain.id,
        theme=theme,
        created_at=at,
    )
    db.add(plan)
    await db.flush()

    template_views = await load_template_views(db)
    template_prefs = {
        row.template_id: row.multiplier
        for row in (
            await db.scalars(
                select(LifePathTemplatePref).where(
                    LifePathTemplatePref.life_path_id == view.profile.life_path_id
                )
            )
        ).all()
    }
    # The variety penalty needs the templates from the learner's last few *sessions*,
    # which is not the same as the templates recorded against their competencies: a
    # template used for something not practised today still makes today repetitive.
    recent_template_ids = list(
        (
            await db.scalars(
                select(Session.template_id)
                .join(DayPlan, DayPlan.id == Session.day_plan_id)
                .where(DayPlan.learner_id == learner_id)
                .order_by(Session.created_at.desc())
                .limit(RECENT_SESSION_WINDOW)
            )
        ).all()
    )

    minutes_remaining = budget.minutes
    previous_stimulus_type: str | None = None

    for position, group in enumerate(group_into_sessions(planned, budget.sessions)):
        candidates = [p.candidate for p in group]
        choice = await choose_template(
            db,
            view,
            targets=candidates,
            theme=theme,
            template_prefs=template_prefs,
            recent_template_ids=recent_template_ids,
            previous_stimulus_type=previous_stimulus_type,
            minutes_remaining=minutes_remaining,
            template_views=template_views,
        )
        tv = template_views[choice.template_id]
        target_ids = [c.competency_id for c in candidates]

        stimulus = await resolve_stimulus(
            db, template=tv.template, target_ids=target_ids, theme=theme
        )
        primary = view.library[candidates[0].competency_id]

        session = Session(
            day_plan_id=plan.id,
            template_id=choice.template_id,
            stimulus_id=stimulus.stimulus_id,
            position=position,
            skill_focus=primary.skill,
            prompt=opening_prompt(tv.template.family, theme),
            created_at=at,
            spec_json={
                "cefr": view.profile.cefr,
                "learning_objective": learning_objective(primary, theme),
                "expected_duration_minutes": tv.template.duration_min,
                "stimulus": {
                    "type": tv.template.stimulus_type,
                    "asset_url": stimulus.asset_url,
                    "resolution": stimulus.resolution,
                    "queue_needed": stimulus.queue_needed,
                    "target_set_key": target_set_key(target_ids),
                    "spec": stimulus.spec,
                },
                "evaluation_metrics": build_evaluation_metrics(candidates, view, tv),
                "retry_rules": retry_rules(tv),
                "reflection_prompt": reflection_prompt(),
                "spaced_review_rule": {"model": "exp_decay", "target_retrievability": 0.85},
                "feedback_language": view.profile.feedback_language,
                # Kept so "why this template?" is answerable from the row itself.
                "selection": {
                    "score": choice.score,
                    "breakdown": choice.breakdown,
                    "rejected": choice.rejected,
                },
            },
        )
        db.add(session)
        await db.flush()

        for planned_target in group:
            db.add(
                SessionTarget(
                    session_id=session.id,
                    competency_id=planned_target.candidate.competency_id,
                    role=planned_target.target_role,
                    priority=planned_target.candidate.priority,
                )
            )

        minutes_remaining = max(0, minutes_remaining - tv.template.duration_min)
        previous_stimulus_type = tv.template.stimulus_type
        recent_template_ids.append(choice.template_id)

    await db.commit()
    await db.refresh(plan)
    return plan
