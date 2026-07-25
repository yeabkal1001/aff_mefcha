"""The learner model. The only thing the Communication Profile is allowed to read.

`learner_*`, never `user_*` — there is no separate account concept, so this is the
only word for the person practising.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import cefr_enum


class LearnerProfile(Base):
    """Everything onboarding asks, plus the band the assessment measured.

    `cefr` is written by placement, never self-declared: most learners do not know
    their level and the ones who think they do guess high.
    """

    __tablename__ = "learner_profile"

    learner_id: Mapped[str] = mapped_column(String(48), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    cefr: Mapped[str] = mapped_column(cefr_enum("learner_cefr"))
    l1: Mapped[str] = mapped_column(String(8), default="am")
    life_path_id: Mapped[str] = mapped_column(ForeignKey("life_path.id"), index=True)
    study_field: Mapped[str | None] = mapped_column(String(120))
    daily_minutes: Mapped[int] = mapped_column(Integer, default=20)
    feedback_language: Mapped[str] = mapped_column(String(8), default="am")
    goal_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    competencies: Mapped[list["LearnerCompetency"]] = relationship(
        back_populates="learner", cascade="all, delete-orphan"
    )


class LearnerCompetency(Base):
    """One row per learner per sub-competency. The whole learner model lives here.

    Note what is absent: `retrievability` and `observed` are both computed, and no
    Profile Dimension is stored. A derived number in this table is a number that can
    disagree with its inputs.
    """

    __tablename__ = "learner_competency"

    learner_id: Mapped[str] = mapped_column(
        ForeignKey("learner_profile.learner_id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )

    mastery: Mapped[float] = mapped_column(Float, default=0.0)

    # How slowly retrievability decays for this learner. Rises with successful
    # retrieval, resets to 1.0 after a second failed retry.
    stability_days: Mapped[float] = mapped_column(Float, default=1.0)

    # Counts sessions, not attempts. Three retries in one session is one piece of
    # evidence, or a failed session would climb the promotion floor. See ADR 0003.
    evidence_count: Mapped[int] = mapped_column(Integer, default=0)

    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_template: Mapped[str | None] = mapped_column(String(8))
    last_theme: Mapped[str | None] = mapped_column(String(200))

    __table_args__ = (
        CheckConstraint("mastery >= 0 and mastery <= 1", name="learner_competency_mastery_check"),
        CheckConstraint("stability_days > 0", name="learner_competency_stability_check"),
    )

    learner: Mapped[LearnerProfile] = relationship(back_populates="competencies")


class LearnerError(Base):
    """A decayed tally of which authored error patterns this learner actually makes.

    Feeds the `errorRecency` term in priority, which is how a mistake made on Monday
    pulls its competency forward on Wednesday.
    """

    __tablename__ = "learner_error"

    learner_id: Mapped[str] = mapped_column(
        ForeignKey("learner_profile.learner_id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
