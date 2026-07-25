"""The Communication Profile: eight dimensions, computed, never stored.

A dimension's value is the evidence-weighted mean mastery of its members, restricted
to competencies the learner has actually attempted. Storing it would create a second
source of truth that drifts from the learner model within a day, and the drift would
show on the one screen the pitch ends on. See ADR 0002.

Three display rules keep the numbers honest:
  - no attempted members reads as "not yet assessed", not 0%
  - every member at evidence_count 1 is drawn with a wider uncertainty band
  - nothing decays, because retrievability falls with time and mastery does not
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.patterns import matches
from app.models import (
    Competency,
    Dimension,
    DimensionMember,
    LearnerCompetency,
    LearnerProfile,
)


@dataclass(frozen=True)
class MemberEvidence:
    competency_id: str
    mastery: float
    evidence_count: int
    observable: bool
    weight: float


@dataclass(frozen=True)
class DimensionValue:
    id: str
    name: str
    fixed: bool
    position: int

    # None means not yet assessed. A dimension the learner has never touched must not
    # read as zero — zero is a claim about ability, absence is not.
    value: float | None

    # True when every contributing member rests on a single observation, which the UI
    # draws as a wider band rather than a hard number.
    wide_uncertainty: bool
    attempted_count: int


def compute_dimension(
    dimension: Dimension, evidence: list[MemberEvidence]
) -> DimensionValue:
    """Fold one bundle's member evidence into a single displayed number.

    Unobservable members are excluded rather than counted as zero: P001-P003 need
    phoneme scoring no API in our stack provides, and averaging in a zero for
    something we cannot measure would understate the learner.
    """
    attempted = [e for e in evidence if e.evidence_count > 0 and e.observable]

    if not attempted:
        return DimensionValue(
            id=dimension.id,
            name=dimension.name,
            fixed=dimension.fixed,
            position=dimension.position,
            value=None,
            wide_uncertainty=False,
            attempted_count=0,
        )

    total_weight = sum(e.weight * e.evidence_count for e in attempted)
    weighted = sum(e.mastery * e.weight * e.evidence_count for e in attempted)

    return DimensionValue(
        id=dimension.id,
        name=dimension.name,
        fixed=dimension.fixed,
        position=dimension.position,
        value=weighted / total_weight if total_weight else None,
        wide_uncertainty=all(e.evidence_count <= 1 for e in attempted),
        attempted_count=len(attempted),
    )


async def read_profile(db: AsyncSession, learner_id: str) -> list[DimensionValue]:
    """The learner's eight dimensions: five fixed plus three from their Life Path."""
    profile = await db.get(LearnerProfile, learner_id)
    if profile is None:
        raise LookupError(f"no learner_profile for {learner_id!r}")

    dimensions = (
        await db.scalars(
            select(Dimension)
            .where(
                (Dimension.fixed.is_(True)) | (Dimension.life_path_id == profile.life_path_id)
            )
            .order_by(Dimension.position)
        )
    ).all()

    members = (
        await db.execute(
            select(DimensionMember).where(
                DimensionMember.dimension_id.in_([d.id for d in dimensions])
            )
        )
    ).scalars().all()

    # One pass over the learner model; bundles are patterns so this cannot be a join.
    rows = (
        await db.execute(
            select(
                LearnerCompetency.competency_id,
                LearnerCompetency.mastery,
                LearnerCompetency.evidence_count,
                Competency.observable,
            )
            .join(Competency, Competency.id == LearnerCompetency.competency_id)
            .where(LearnerCompetency.learner_id == learner_id)
        )
    ).all()

    by_dimension: dict[str, list[MemberEvidence]] = {d.id: [] for d in dimensions}
    for member in members:
        for competency_id, mastery, evidence_count, observable in rows:
            if matches(member.competency_pattern, competency_id):
                by_dimension[member.dimension_id].append(
                    MemberEvidence(
                        competency_id=competency_id,
                        mastery=mastery,
                        evidence_count=evidence_count,
                        observable=observable,
                        weight=member.weight,
                    )
                )

    return [compute_dimension(d, by_dimension[d.id]) for d in dimensions]
