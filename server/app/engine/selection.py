"""Reading the curriculum and the learner model into ranked candidates.

Everything here answers questions the Day Plan asks: which domain is next, which of
its competencies are addressable today, and what each one's priority is. Kept apart
from day_plan.py so the ranking can be inspected on its own — "show me why G006.01
came first" is a question the pitch has to survive.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.engine.constants import (
    NEW_CONCEPT_MASTERY_CEILING,
    PREREQ_MASTERY,
    PROMOTION_EVIDENCE_FLOOR,
    PROMOTION_MASTERY,
)
from app.engine.priority import (
    PriorityInputs,
    domain_weight_for,
    error_recency,
    l1_risk_for,
    priority,
)
from app.engine.retrievability import is_due, review_urgency
from app.models import (
    Competency,
    CompetencyPrereq,
    Domain,
    DomainRequires,
    LearnerCompetency,
    LearnerError,
    LearnerProfile,
    LifePathDomain,
)
from app.models.enums import cefr_within


@dataclass(frozen=True)
class Candidate:
    competency_id: str
    skill: str
    role: str
    priority: float
    mastery: float
    evidence_count: int
    inputs: PriorityInputs


def rank_key(candidate: Candidate) -> tuple[float, float, str]:
    """Priority first, then the weaker competency, then the ID.

    Ties are common — priority is a weighted sum of five coarse terms, so four
    competencies of equal domain role and no L1 risk score identically. Breaking the tie
    on mastery teaches the weakest thing first; falling through to the ID makes the
    order reproducible. Without that last term the same learner state could produce a
    different mission in rehearsal than on stage.
    """
    return (-candidate.priority, candidate.mastery, candidate.competency_id)


@dataclass
class LearnerView:
    """One read of everything the ranking needs, so scoring does not re-query per row."""

    profile: LearnerProfile
    competencies: dict[str, LearnerCompetency]
    errors: dict[str, tuple[int, datetime | None]]
    library: dict[str, Competency]
    path_domain_priority: dict[str, float]


async def load_learner_view(db: AsyncSession, learner_id: str) -> LearnerView:
    profile = await db.get(LearnerProfile, learner_id)
    if profile is None:
        raise LookupError(f"no learner_profile for {learner_id!r}")

    competencies = {
        row.competency_id: row
        for row in (
            await db.scalars(
                select(LearnerCompetency).where(LearnerCompetency.learner_id == learner_id)
            )
        ).all()
    }

    errors: dict[str, tuple[int, datetime | None]] = {}
    for row in (
        await db.scalars(select(LearnerError).where(LearnerError.learner_id == learner_id))
    ).all():
        count, last = errors.get(row.competency_id, (0, None))
        latest = row.last_seen if last is None else max(last, row.last_seen or last)
        errors[row.competency_id] = (count + row.count, latest)

    # Error tags are eager-loaded because the evaluation metrics for a session read
    # them, and a lazy load inside async SQLAlchemy raises rather than querying.
    library = {
        c.id: c
        for c in (
            await db.scalars(select(Competency).options(selectinload(Competency.common_errors)))
        ).all()
    }

    path_domain_priority = {
        row.domain_id: row.priority
        for row in (
            await db.scalars(
                select(LifePathDomain).where(
                    LifePathDomain.life_path_id == profile.life_path_id
                )
            )
        ).all()
    }

    return LearnerView(
        profile=profile,
        competencies=competencies,
        errors=errors,
        library=library,
        path_domain_priority=path_domain_priority,
    )


def _priority_inputs(
    view: LearnerView, competency_id: str, role: str, domain_id: str | None, at: datetime
) -> PriorityInputs:
    state = view.competencies.get(competency_id)
    competency = view.library[competency_id]
    count, last_error = view.errors.get(competency_id, (0, None))

    return PriorityInputs(
        competency_id=competency_id,
        review_urgency=(
            review_urgency(state.last_seen, state.stability_days, at) if state else 0.0
        ),
        domain_weight=domain_weight_for(role),
        path_weight=view.path_domain_priority.get(domain_id, 0.0) if domain_id else 0.0,
        error_recency=error_recency(count, last_error, at),
        l1_risk=l1_risk_for(
            competency.l1_risk_json, view.profile.l1, competency.l1_confusions_json
        ),
    )


async def expand_requirements(db: AsyncSession, view: LearnerView, domain_id: str) -> dict[str, str]:
    """Every addressable sub-competency this domain asks for, mapped to its role.

    `core` rows list their subs explicitly. `supporting` and `incidental` expand from
    the parent, filtered to the learner's band. Unobservable competencies are dropped
    here so the engine never targets something it cannot grade.
    """
    requirements = (
        await db.scalars(select(DomainRequires).where(DomainRequires.domain_id == domain_id))
    ).all()

    roles: dict[str, str] = {}
    for requirement in requirements:
        if requirement.role == "core" and requirement.explicit_subs_json:
            # Subs authored in the curriculum but not yet in the library are skipped
            # rather than dangling; see the pack's "still to author" list.
            subs = [s for s in requirement.explicit_subs_json if s in view.library]
        else:
            subs = [
                c.id
                for c in view.library.values()
                if c.parent == requirement.competency_id
            ]

        for sub in subs:
            competency = view.library[sub]
            if not competency.observable:
                continue
            if not cefr_within(view.profile.cefr, competency.cefr_min, competency.cefr_max):
                continue
            # A competency required twice takes its strongest role.
            existing = roles.get(sub)
            if existing is None or domain_weight_for(requirement.role) > domain_weight_for(existing):
                roles[sub] = requirement.role
    return roles


async def prerequisites_met(db: AsyncSession, view: LearnerView, competency_id: str) -> bool:
    prereqs = (
        await db.scalars(
            select(CompetencyPrereq.requires_id).where(
                CompetencyPrereq.competency_id == competency_id
            )
        )
    ).all()
    for requires_id in prereqs:
        state = view.competencies.get(requires_id)
        if state is not None and state.mastery < PREREQ_MASTERY:
            return False
    return True


async def review_candidates(
    db: AsyncSession, view: LearnerView, at: datetime, limit: int
) -> list[Candidate]:
    """Competencies whose retrievability has fallen below the review threshold.

    This is the pool that produces Day Three. Nothing about it is scripted: a
    competency practised on Monday decays until R < 0.85 and then competes on priority
    like anything else.
    """
    domain_roles: dict[str, str] = {}
    for row in (await db.scalars(select(DomainRequires))).all():
        for sub in row.explicit_subs_json or []:
            if domain_weight_for(row.role) > domain_weight_for(domain_roles.get(sub)):
                domain_roles[sub] = row.role

    out: list[Candidate] = []
    for competency_id, state in view.competencies.items():
        competency = view.library.get(competency_id)
        if competency is None or not competency.observable:
            continue
        if not is_due(state.last_seen, state.stability_days, at):
            continue
        role = domain_roles.get(competency_id, "supporting")
        inputs = _priority_inputs(view, competency_id, role, None, at)
        out.append(
            Candidate(
                competency_id=competency_id,
                skill=competency.skill,
                role=role,
                priority=priority(inputs),
                mastery=state.mastery,
                evidence_count=state.evidence_count,
                inputs=inputs,
            )
        )

    out.sort(key=rank_key)
    return out[:limit]


async def new_candidates(
    db: AsyncSession, view: LearnerView, domain_id: str, at: datetime, limit: int
) -> list[Candidate]:
    roles = await expand_requirements(db, view, domain_id)

    out: list[Candidate] = []
    for competency_id, role in roles.items():
        if role == "incidental":
            continue
        state = view.competencies.get(competency_id)
        mastery = state.mastery if state else 0.0
        if mastery >= NEW_CONCEPT_MASTERY_CEILING:
            continue
        if not await prerequisites_met(db, view, competency_id):
            continue
        inputs = _priority_inputs(view, competency_id, role, domain_id, at)
        out.append(
            Candidate(
                competency_id=competency_id,
                skill=view.library[competency_id].skill,
                role=role,
                priority=priority(inputs),
                mastery=mastery,
                evidence_count=state.evidence_count if state else 0,
                inputs=inputs,
            )
        )

    out.sort(key=rank_key)
    return out[:limit]


async def highest_priority_incomplete_domain(
    db: AsyncSession, view: LearnerView
) -> Domain:
    """The next domain, computed rather than stored.

    A domain is complete when every `core` sub-competency sits at mastery >= 0.75 with
    at least three pieces of evidence. Nothing is regenerated on promotion because
    nothing above the Day Plan was ever generated.
    """
    ranked = sorted(
        view.path_domain_priority.items(), key=lambda item: item[1], reverse=True
    )
    fallback: Domain | None = None

    for domain_id, _priority in ranked:
        domain = await db.get(Domain, domain_id)
        if domain is None or domain.cefr != view.profile.cefr:
            continue
        fallback = fallback or domain

        core_subs = [
            sub
            for row in (
                await db.scalars(
                    select(DomainRequires).where(
                        DomainRequires.domain_id == domain_id, DomainRequires.role == "core"
                    )
                )
            ).all()
            for sub in (row.explicit_subs_json or [])
            if sub in view.library
        ]
        complete = bool(core_subs) and all(
            (state := view.competencies.get(sub)) is not None
            and state.mastery >= PROMOTION_MASTERY
            and state.evidence_count >= PROMOTION_EVIDENCE_FLOOR
            for sub in core_subs
        )
        if not complete:
            return domain

    if fallback is None:
        raise LookupError(
            f"life path {view.profile.life_path_id!r} ranks no {view.profile.cefr} domain"
        )
    # Every ranked domain is complete: stay on the highest-priority one until content
    # for the next band exists.
    return fallback
