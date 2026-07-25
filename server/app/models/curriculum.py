"""The static library: competencies, domains, templates.

Shared by every learner and never written at runtime. Specified in
docs/architecture/session-engine.md sections 3, 4, 5 and 11.
"""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import cefr_enum, skill_enum


class Competency(Base):
    """One addressable unit of learning, always `X###.##`.

    Everything that targets, scores, schedules or stores addresses this level. The
    parent (`G006`) is a grouping that appears in domain requirements and template
    `elicits` rows only.
    """

    __tablename__ = "competency"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    parent: Mapped[str] = mapped_column(String(8), index=True)
    skill: Mapped[str] = mapped_column(skill_enum("skill"))
    name: Mapped[str] = mapped_column(String(120))
    cefr_min: Mapped[str] = mapped_column(cefr_enum("cefr_min"))
    cefr_max: Mapped[str] = mapped_column(cefr_enum("cefr_max"))

    # False for P001-P003: no API in the stack scores phonemes, so the engine must
    # never target them and the Pronunciation dimension excludes them rather than
    # counting them as zero.
    observable: Mapped[bool] = mapped_column(Boolean, default=True)

    success_criteria: Mapped[str | None] = mapped_column(Text)
    elicitation_cues: Mapped[list[str]] = mapped_column(JSONB, default=list)
    l1_risk_json: Mapped[dict[str, float]] = mapped_column(JSONB, default=dict)

    # P001.08 carries an authored Amharic confusion set; most competencies do not.
    l1_confusions_json: Mapped[dict | None] = mapped_column(JSONB)
    measurement: Mapped[str | None] = mapped_column(Text)

    prerequisites: Mapped[list["CompetencyPrereq"]] = relationship(
        back_populates="competency",
        foreign_keys="CompetencyPrereq.competency_id",
        cascade="all, delete-orphan",
    )
    common_errors: Mapped[list["CompetencyError"]] = relationship(
        back_populates="competency", cascade="all, delete-orphan"
    )


class CompetencyPrereq(Base):
    """`competency_id` cannot be practised until `requires_id` is met.

    Sub-competency level, which is what makes the prerequisite graphs in the
    curriculum documents executable rather than illustrative.
    """

    __tablename__ = "competency_prereq"

    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )
    requires_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )

    competency: Mapped[Competency] = relationship(
        back_populates="prerequisites", foreign_keys=[competency_id]
    )


class CompetencyError(Base):
    """A pre-authored mistake pattern, matched against the verbatim transcript.

    The closed set the evaluator checks before falling back to open-ended judgement,
    which is what keeps scoring identical across sessions.
    """

    __tablename__ = "competency_error"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), index=True
    )
    wrong: Mapped[str] = mapped_column(Text)
    right: Mapped[str] = mapped_column(Text)
    tag: Mapped[str] = mapped_column(String(64), index=True)

    competency: Mapped[Competency] = relationship(back_populates="common_errors")


class Domain(Base):
    """A Layer 1 curriculum unit such as `A2-D01` — a unit of what is practised."""

    __tablename__ = "domain"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    cefr: Mapped[str] = mapped_column(cefr_enum("domain_cefr"))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)

    objectives: Mapped[list["DomainObjective"]] = relationship(
        back_populates="domain", cascade="all, delete-orphan"
    )
    contexts: Mapped[list["DomainContext"]] = relationship(
        back_populates="domain", cascade="all, delete-orphan", order_by="DomainContext.position"
    )
    requires: Mapped[list["DomainRequires"]] = relationship(
        back_populates="domain", cascade="all, delete-orphan"
    )


class DomainObjective(Base):
    __tablename__ = "domain_objective"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain_id: Mapped[str] = mapped_column(ForeignKey("domain.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)

    domain: Mapped[Domain] = relationship(back_populates="objectives")


class DomainContext(Base):
    """An authored Practice Context such as "Introducing yourself".

    The Life Path rewrites this into a Theme; `position` is the rotation order the
    Day Plan walks so a learner does not get the same scene twice running.
    """

    __tablename__ = "domain_context"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain_id: Mapped[str] = mapped_column(ForeignKey("domain.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)

    domain: Mapped[Domain] = relationship(back_populates="contexts")


class DomainRequires(Base):
    """A weighted requirement row.

    `core` gates domain completion and lists its sub-competencies explicitly;
    `supporting` and `incidental` expand from the parent, filtered by CEFR.
    """

    __tablename__ = "domain_requires"

    domain_id: Mapped[str] = mapped_column(
        ForeignKey("domain.id", ondelete="CASCADE"), primary_key=True
    )
    # A parent competency (`G005`) belongs here by design, so this is not an FK.
    competency_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    explicit_subs_json: Mapped[list[str]] = mapped_column(JSONB, default=list)

    __table_args__ = (
        CheckConstraint(
            "role in ('core','supporting','incidental')", name="domain_requires_role_check"
        ),
    )

    domain: Mapped[Domain] = relationship(back_populates="requires")


class Template(Base):
    """A Layer 2 exercise form, `EX001`-`EX018`. A form, not an instance of one."""

    __tablename__ = "template"

    id: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    family: Mapped[str] = mapped_column(String(64))
    stimulus_type: Mapped[str] = mapped_column(String(32))
    interaction_mode: Mapped[str] = mapped_column(String(16))
    cefr_min: Mapped[str] = mapped_column(cefr_enum("template_cefr_min"))
    cefr_max: Mapped[str] = mapped_column(cefr_enum("template_cefr_max"))
    duration_min: Mapped[int] = mapped_column(Integer)
    duration_max: Mapped[int] = mapped_column(Integer)
    scaffold_ladder_json: Mapped[list[str]] = mapped_column(JSONB, default=list)

    measures: Mapped[list["TemplateMeasures"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )
    elicits: Mapped[list["TemplateElicits"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )
    requires: Mapped[list["TemplateRequires"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class TemplateMeasures(Base):
    """Observation reliability: how much this template's output tells you about a skill.

    Distinct from `TemplateElicits.strength`, and the reason a shadowing exercise and
    a picture description do not move a pronunciation estimate by the same amount.
    """

    __tablename__ = "template_measures"

    template_id: Mapped[str] = mapped_column(
        ForeignKey("template.id", ondelete="CASCADE"), primary_key=True
    )
    skill: Mapped[str] = mapped_column(skill_enum("measures_skill"), primary_key=True)
    reliability: Mapped[float] = mapped_column(Float)

    __table_args__ = (
        CheckConstraint(
            "reliability >= 0 and reliability <= 1", name="template_measures_range_check"
        ),
    )

    template: Mapped[Template] = relationship(back_populates="measures")


class TemplateElicits(Base):
    """Production probability: how reliably this template makes the learner produce it.

    `competency_id` holds a pattern, not a foreign key — `V*` means the template is
    vocabulary-agnostic and `G002` means the whole parent, both of which are
    deliberate per section 5.
    """

    __tablename__ = "template_elicits"

    template_id: Mapped[str] = mapped_column(
        ForeignKey("template.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    strength: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("strength >= 0 and strength <= 1", name="template_elicits_range_check"),
    )

    template: Mapped[Template] = relationship(back_populates="elicits")


class TemplateRequires(Base):
    """The `requires_fluency` gate: never hand Debate to a learner who cannot yet
    express an opinion, however urgently a grammar competency is due."""

    __tablename__ = "template_requires"

    template_id: Mapped[str] = mapped_column(
        ForeignKey("template.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )

    __table_args__ = (UniqueConstraint("template_id", "competency_id", name="template_requires_uq"),)

    template: Mapped[Template] = relationship(back_populates="requires")
