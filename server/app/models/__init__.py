"""Every model is imported here so Alembic autogenerate sees the full metadata."""

from app.models.curriculum import (
    Competency,
    CompetencyError,
    CompetencyPrereq,
    Domain,
    DomainContext,
    DomainObjective,
    DomainRequires,
    Template,
    TemplateElicits,
    TemplateMeasures,
    TemplateRequires,
)
from app.models.learner import LearnerCompetency, LearnerError, LearnerProfile
from app.models.life_path import (
    Dimension,
    DimensionMember,
    LifePath,
    LifePathContext,
    LifePathDomain,
    LifePathTemplatePref,
)
from app.models.practice import (
    Attempt,
    DayPlan,
    Reflection,
    Session,
    SessionTarget,
    StimulusPool,
    Turn,
)

__all__ = [
    "Attempt",
    "Competency",
    "CompetencyError",
    "CompetencyPrereq",
    "DayPlan",
    "Dimension",
    "DimensionMember",
    "Domain",
    "DomainContext",
    "DomainObjective",
    "DomainRequires",
    "LearnerCompetency",
    "LearnerError",
    "LearnerProfile",
    "LifePath",
    "LifePathContext",
    "LifePathDomain",
    "LifePathTemplatePref",
    "Reflection",
    "Session",
    "SessionTarget",
    "StimulusPool",
    "Template",
    "TemplateElicits",
    "TemplateMeasures",
    "TemplateRequires",
    "Turn",
]
