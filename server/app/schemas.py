"""Request and response shapes for the API.

Vocabulary is binding here too: `learner_id` not `user_id`, `competency_id` always a
sub-competency, `profile_dimension` never called a ring.
"""

from datetime import date, datetime

from pydantic import BaseModel, Field


class OnboardingRequest(BaseModel):
    """The four questions onboarding asks. Note what is absent: a CEFR level."""

    learner_id: str
    display_name: str | None = None
    life_path_id: str
    l1: str = "am"
    study_field: str | None = None
    daily_minutes: int = 20
    feedback_language: str = "am"

    # When present, placement runs a real complexity read over these samples instead of
    # defaulting to the authored band.
    assessment_transcripts: list[str] | None = None
    assessment_error_count: int = 0


class PlacementRead(BaseModel):
    mean_sentence_length: float
    subordination_rate: float
    lexical_range: float
    error_density: float
    composite: float
    measured_band: str
    band: str
    capped_by_content: bool


class OnboardingResponse(BaseModel):
    learner_id: str
    cefr: str
    seeded_competencies: int
    placement: PlacementRead | None = None


class DimensionResponse(BaseModel):
    id: str
    name: str
    fixed: bool
    # None reads as "not yet assessed" in the UI, never as 0%.
    value: float | None
    wide_uncertainty: bool
    attempted_count: int


class ProfileResponse(BaseModel):
    learner_id: str
    cefr: str
    life_path_id: str
    dimensions: list[DimensionResponse]
    due_count: int


class SessionTargetResponse(BaseModel):
    competency_id: str
    name: str
    role: str
    priority: float | None


class SessionResponse(BaseModel):
    id: str
    position: int
    template_id: str
    template_name: str
    skill_focus: str | None
    prompt: str
    learning_objective: str | None
    expected_duration_minutes: int | None
    stimulus_type: str | None
    stimulus_url: str | None
    targets: list[SessionTargetResponse]
    completed_at: datetime | None


class DayPlanResponse(BaseModel):
    id: str
    learner_id: str
    date: date
    domain_id: str
    # Shown to the learner as "Today's Mission".
    theme: str
    sessions: list[SessionResponse]


class TurnRequest(BaseModel):
    """One recorded stretch of speech.

    Both transcripts arrive together and they are not interchangeable. The verbatim
    track is what gets graded; a cleaned-up version is only ever displayed, because a
    polished transcript silently repairs the very errors the evaluator looks for.
    """

    audio_url: str | None = None
    transcript_verbatim: str | None = None
    transcript_clean: str | None = None

    # ElevenLabs Scribe `words`: {text, start, end, type}. Whisper-style
    # {text, timestamp: [start, end]} is also accepted. Empty means no delivery
    # evidence from this turn — not zero delivery.
    words: list[dict] = Field(default_factory=list)
    scaffold_level: int = 0


class JudgementResponse(BaseModel):
    competency_id: str
    opportunities: int
    correct: int
    # None when there were no opportunities — no evidence, which is not a zero.
    observed: float | None
    error_tags: list[str]
    source: str


class TurnResponse(BaseModel):
    turn_id: str
    metrics: dict
    judgements: list[JudgementResponse]
    retry_needed: list[str]
    retries_exhausted: bool
    scaffold_prompt: str | None


class MasteryUpdateResponse(BaseModel):
    competency_id: str
    observed: float
    alpha: float
    weight: float
    scaffolded: bool
    mastery_before: float
    mastery_after: float
    stability_before: float
    stability_after: float
    evidence_count_after: int


class SessionOutcomeResponse(BaseModel):
    session_id: str
    updates: list[MasteryUpdateResponse]
    prerequisite_recheck: list[str]
    dimensions: list[DimensionResponse]


class ReflectionRequest(BaseModel):
    learner_text: str


class ReflectionResponse(BaseModel):
    session_id: str
    matched_error_tag: str | None
    confidence_raised_for: str | None
