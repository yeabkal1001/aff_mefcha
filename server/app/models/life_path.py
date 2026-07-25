"""The Life Path skin and the Profile Dimension bundles.

A Life Path never duplicates curriculum — it is four overlays on the one library:
domain priorities, context substitutions, a vocabulary overlay and template
preferences. See session-engine.md sections 7 and 8.
"""

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class LifePath(Base):
    __tablename__ = "life_path"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    vocabulary_overlay_json: Mapped[list[str]] = mapped_column(JSONB, default=list)

    domains: Mapped[list["LifePathDomain"]] = relationship(
        back_populates="life_path", cascade="all, delete-orphan"
    )
    contexts: Mapped[list["LifePathContext"]] = relationship(
        back_populates="life_path", cascade="all, delete-orphan"
    )
    template_prefs: Mapped[list["LifePathTemplatePref"]] = relationship(
        back_populates="life_path", cascade="all, delete-orphan"
    )


class LifePathDomain(Base):
    """Which domains this path cares about, and how much."""

    __tablename__ = "life_path_domain"

    life_path_id: Mapped[str] = mapped_column(
        ForeignKey("life_path.id", ondelete="CASCADE"), primary_key=True
    )
    domain_id: Mapped[str] = mapped_column(
        ForeignKey("domain.id", ondelete="CASCADE"), primary_key=True
    )
    priority: Mapped[float] = mapped_column(Float)

    life_path: Mapped[LifePath] = relationship(back_populates="domains")


class LifePathContext(Base):
    """The rewrite that turns a Practice Context into this path's world.

    "Introducing yourself" becomes "Introducing yourself to a university class" —
    the substituted result is the Theme, and it is what makes a Day Plan feel like
    one story rather than four drills.
    """

    __tablename__ = "life_path_context"

    life_path_id: Mapped[str] = mapped_column(
        ForeignKey("life_path.id", ondelete="CASCADE"), primary_key=True
    )
    from_context: Mapped[str] = mapped_column(Text, primary_key=True)
    to_context: Mapped[str] = mapped_column(Text)

    life_path: Mapped[LifePath] = relationship(back_populates="contexts")


class LifePathTemplatePref(Base):
    """A multiplier on template selection — Hana's path favours roleplay."""

    __tablename__ = "life_path_template_pref"

    life_path_id: Mapped[str] = mapped_column(
        ForeignKey("life_path.id", ondelete="CASCADE"), primary_key=True
    )
    template_id: Mapped[str] = mapped_column(
        ForeignKey("template.id", ondelete="CASCADE"), primary_key=True
    )
    multiplier: Mapped[float] = mapped_column(Float, default=1.0)

    life_path: Mapped[LifePath] = relationship(back_populates="template_prefs")


class Dimension(Base):
    """A named weighted bundle of competency IDs shown on the Communication Profile.

    Five are fixed for every learner; exactly three come from the Life Path, because
    the dashboard is a fixed eight-slot layout. A dimension's *value* is never stored
    — it is computed from `learner_competency` at read time. See ADR 0002.
    """

    __tablename__ = "dimension"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    fixed: Mapped[bool] = mapped_column(Boolean, default=False)
    life_path_id: Mapped[str | None] = mapped_column(
        ForeignKey("life_path.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        # A dimension is either fixed for everyone or supplied by one path, never both.
        CheckConstraint(
            "(fixed and life_path_id is null) or (not fixed and life_path_id is not null)",
            name="dimension_fixed_xor_path_check",
        ),
    )

    members: Mapped[list["DimensionMember"]] = relationship(
        back_populates="dimension", cascade="all, delete-orphan"
    )


class DimensionMember(Base):
    """A pattern such as `G*`, `F015.*` or a bare `P015.03`, expanded at read time."""

    __tablename__ = "dimension_member"

    dimension_id: Mapped[str] = mapped_column(
        ForeignKey("dimension.id", ondelete="CASCADE"), primary_key=True
    )
    competency_pattern: Mapped[str] = mapped_column(String(16), primary_key=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    dimension: Mapped[Dimension] = relationship(back_populates="members")
