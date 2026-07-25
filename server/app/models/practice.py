"""What a learner actually did: day plans, sessions, turns, attempts, reflections.

The split between `turn` and `attempt` is load-bearing and is recorded in ADR 0003.
A turn is one uninterrupted stretch of speech and owns everything utterance-shaped
— the audio, both transcripts, the word-timestamp metrics. An attempt is one
competency judgement pointing at a turn.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
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


def _uid() -> str:
    return uuid.uuid4().hex


class StimulusPool(Base):
    """Assets built ahead of time, addressed by (template, target set, theme).

    Assets are pre-built; plans are not. Keying on the target set and theme rather
    than the session is what makes review work: a competency coming due in a new
    context asks for a variant of an existing spec rather than a fresh invention.
    See ADR 0001.
    """

    __tablename__ = "stimulus_pool"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    template_id: Mapped[str] = mapped_column(ForeignKey("template.id", ondelete="CASCADE"))
    target_set_key: Mapped[str] = mapped_column(String(200), index=True)
    theme: Mapped[str] = mapped_column(String(200), index=True)
    stimulus_type: Mapped[str] = mapped_column(String(32))
    asset_url: Mapped[str | None] = mapped_column(Text)
    spec_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("template_id", "target_set_key", "theme", name="stimulus_pool_key_uq"),
    )


class DayPlan(Base):
    """Four to six sessions under one theme. The learner sees "Today's Mission".

    This is the top of the stored hierarchy. Nothing above it exists as a row —
    which domain comes next and how far the learner is from B1 are computed on
    demand from life path, CEFR and completion state.
    """

    __tablename__ = "day_plan"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    learner_id: Mapped[str] = mapped_column(
        ForeignKey("learner_profile.learner_id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date)
    domain_id: Mapped[str] = mapped_column(ForeignKey("domain.id"))

    # The substituted Practice Context. Stored because it is what the learner was
    # actually shown, and the substitution table may be re-authored later.
    theme: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("learner_id", "date", name="day_plan_learner_date_uq"),)

    sessions: Mapped[list["Session"]] = relationship(
        back_populates="day_plan", cascade="all, delete-orphan", order_by="Session.position"
    )


class Session(Base):
    """One activity — one template, one stimulus, three to eight minutes.

    `spec_json` holds the emitted session document from session-engine.md section 9:
    learning objective, evaluation metrics, retry rules, reflection prompt. Those are
    generated from the targets joined to competency criteria, so they are recorded
    rather than re-derived when a turn is graded later.
    """

    __tablename__ = "session"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    day_plan_id: Mapped[str] = mapped_column(
        ForeignKey("day_plan.id", ondelete="CASCADE"), index=True
    )
    template_id: Mapped[str] = mapped_column(ForeignKey("template.id"))
    stimulus_id: Mapped[str | None] = mapped_column(ForeignKey("stimulus_pool.id"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    skill_focus: Mapped[str | None] = mapped_column(String(16))
    prompt: Mapped[str] = mapped_column(Text)
    spec_json: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    day_plan: Mapped[DayPlan] = relationship(back_populates="sessions")
    targets: Mapped[list["SessionTarget"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    turns: Mapped[list["Turn"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Turn.index"
    )


class SessionTarget(Base):
    """A competency this session explicitly targets, and why it was chosen.

    Only targets listed here can trigger a retry or produce evidence. `priority` is
    kept so a scheduling decision stays inspectable after the fact — the Day Three
    claim depends on being able to show why the engine picked what it picked.
    """

    __tablename__ = "session_target"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16))
    priority: Mapped[float | None] = mapped_column(Float)

    __table_args__ = (
        CheckConstraint("role in ('new','review','incidental')", name="session_target_role_check"),
    )

    session: Mapped[Session] = relationship(back_populates="targets")


class Turn(Base):
    """One uninterrupted stretch of learner speech, with both transcripts.

    Two transcribers, for opposite reasons. `transcript_clean` comes from Wispr Flow,
    which is built to tidy speech up and is therefore never the graded track.
    `transcript_verbatim` comes from fal Whisper with word timestamps and is what
    every measurement reads. The gap between them is the reflection screen.
    """

    __tablename__ = "turn"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), index=True
    )
    index: Mapped[int] = mapped_column(Integer)
    audio_url: Mapped[str | None] = mapped_column(Text)
    transcript_verbatim: Mapped[str | None] = mapped_column(Text)
    transcript_clean: Mapped[str | None] = mapped_column(Text)

    # Words per minute, pause count and length, filler rate, mean sentence length —
    # all derived from word timestamps. These describe an utterance, not a
    # competency, which is why they live here and not on a learner row.
    metrics_json: Mapped[dict] = mapped_column(JSONB, default=dict)

    # 0 for the first try, then one rung per retry.
    scaffold_level: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (UniqueConstraint("session_id", "index", name="turn_session_index_uq"),)

    session: Mapped[Session] = relationship(back_populates="turns")
    attempts: Mapped[list["Attempt"]] = relationship(
        back_populates="turn", cascade="all, delete-orphan"
    )


class Attempt(Base):
    """One competency judgement about one turn, stored as counts rather than a score.

    `observed` is `correct / opportunities`, computed on read. Asking a model for a
    number in [0,1] would reintroduce exactly the drift the authored error tags exist
    to remove, and zero opportunities has to mean "no evidence" rather than zero —
    a learner who avoids a structure has told you nothing. See ADR 0004.
    """

    __tablename__ = "attempt"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uid)
    turn_id: Mapped[str] = mapped_column(ForeignKey("turn.id", ondelete="CASCADE"), index=True)
    competency_id: Mapped[str] = mapped_column(
        ForeignKey("competency.id", ondelete="CASCADE"), index=True
    )
    opportunities: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    error_tags_json: Mapped[list[str]] = mapped_column(JSONB, default=list)
    scaffold_level: Mapped[int] = mapped_column(Integer, default=0)

    # Marks the one attempt that updates mastery. Every attempt is stored, because
    # "what changed between your first answer and your second?" needs both, but one
    # session-and-competency pair is one piece of evidence. Enforced by the mastery
    # service rather than a constraint, since an attempt reaches its session only
    # through its turn.
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("turn_id", "competency_id", name="attempt_turn_competency_uq"),
        CheckConstraint("opportunities >= 0", name="attempt_opportunities_check"),
        CheckConstraint(
            "correct >= 0 and correct <= opportunities", name="attempt_correct_range_check"
        ),
    )

    turn: Mapped[Turn] = relationship(back_populates="attempts")

    @property
    def observed(self) -> float | None:
        """None means no evidence, which is not the same as zero."""
        if self.opportunities == 0:
            return None
        return self.correct / self.opportunities


class Reflection(Base):
    """The learner naming their own error — stage six of the learning engine.

    If the self-report matches the detected tag it raises confidence in the estimate
    rather than mastery itself: metacognitive accuracy tells you the number is
    trustworthy, not that the skill is stronger.
    """

    __tablename__ = "reflection"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("session.id", ondelete="CASCADE"), primary_key=True
    )
    learner_text: Mapped[str] = mapped_column(Text)
    matched_error_tag: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
