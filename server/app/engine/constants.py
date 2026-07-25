"""Every tunable number the engine uses, in one place.

Each value is either quoted from docs/architecture/session-engine.md or marked as a
choice we made where the document left it open. Keeping them together is what lets us
answer "where does that number come from?" with a file rather than a search.
"""

# --- Retrievability and review (section 6) ---

# R(c, t) = exp(-(t - last_seen) / stability_days); due when R < this.
#
# Worth knowing what this implies: R < 0.85 is reached at 0.1625 x stability_days, so
# a competency with two days of stability falls due in about eight hours. Section 10
# reads "comes due in roughly two days" from a stability of 1.7, which does not follow
# from this formula — reaching a two-day interval needs about twelve days of stability.
# The mechanism is what the document specifies and it is implemented as written; the
# interval length is a tuning question we have flagged rather than quietly changed.
REVIEW_THRESHOLD = 0.85

# --- Mastery update (section 6) ---

# alpha = max(MIN_ALPHA, 1 / (1 + evidence_count)). The floor keeps a well-evidenced
# estimate moving instead of freezing.
MIN_ALPHA = 0.15

# A scaffolded success is weaker evidence than an unscaffolded one.
SCAFFOLD_WEIGHT = 0.6

# stability_days <- stability_days * (1 + STABILITY_GAIN * (observed - 0.5))
STABILITY_GAIN = 0.9

# A second failed retry resets stability and re-checks prerequisites.
STABILITY_RESET = 1.0

# --- Retry ladder (section 6) ---

RETRY_TRIGGER = 0.6
MAX_RETRIES = 2

# --- Target selection (sections 4 and 9) ---

ROLE_WEIGHT: dict[str, float] = {"core": 1.0, "supporting": 0.6, "incidental": 0.2}

# A competency is a candidate for "new" only below this mastery.
NEW_CONCEPT_MASTERY_CEILING = 0.5

# Our choice: `prerequisitesMet(c, profile)` is specified without a bar. Half is the
# same line "needs work" is drawn at. A prerequisite the learner has never attempted
# does not block, because a fresh learner would otherwise deadlock — the onboarding
# assessment seeds the band, not every competency in it.
PREREQ_MASTERY = 0.5

# The theme used when the pool has the right targets but not the right scene. Step two
# of the degrade-the-key chain in section 12.
GENERIC_THEME = "generic"

PRIORITY_WEIGHTS: dict[str, float] = {
    "review_urgency": 0.35,
    "domain_weight": 0.25,
    "path_weight": 0.15,
    "error_recency": 0.15,
    "l1_risk": 0.10,
}

# Our choice: the document says "decayed count of recent error_tags" without a rate.
# Seven days means a mistake made on Monday still pulls its competency forward on
# Wednesday, which is the behaviour the demo needs, and fades within a fortnight.
ERROR_RECENCY_HALF_LIFE_DAYS = 7.0

# Errors counted above this are already at full urgency.
ERROR_RECENCY_SATURATION = 3.0

# --- Template selection (section 9) ---

TEMPLATE_SCORE_WEIGHTS: dict[str, float] = {
    "life_path_preference": 0.20,
    "used_in_last_n_sessions": -0.30,
    # Enforces "spaced retrieval in a new context". This is the term that produces
    # Day Three: it pushes a due competency onto a template it was not last practised
    # on, which is why the same grammar returns as roleplay instead of description.
    "same_template_as_last_time_for": -0.40,
    "same_stimulus_type_as_previous": -0.15,
    # Soft on purpose. Filtering unavailable assets would let the pool outrank the
    # curriculum; scoring them down means a strongly indicated template still wins,
    # queues its asset, and falls back for this session only. See ADR 0001.
    "asset_missing": -0.25,
}

# How far back "used recently" looks for the variety penalty.
RECENT_SESSION_WINDOW = 3

# --- CEFR promotion (section 9) ---

PROMOTION_MASTERY = 0.75
PROMOTION_EVIDENCE_FLOOR = 3

# --- Learning load (section 9) ---


class LoadBudget:
    __slots__ = ("sessions", "new_concepts", "reviews", "minutes")

    def __init__(self, sessions: int, new_concepts: int, reviews: int, minutes: int) -> None:
        self.sessions = sessions
        self.new_concepts = new_concepts
        self.reviews = reviews
        self.minutes = minutes


# Only the A2 row is authored — persona.md gives it as four sessions, two to three new
# concepts and two reviews in twenty minutes. The higher bands are provisional and
# unreachable while A2 is the only band with content, since placement cannot return
# above the band that has authored material.
LOAD_TABLE: dict[str, LoadBudget] = {
    "A2": LoadBudget(sessions=4, new_concepts=3, reviews=2, minutes=20),
    "B1": LoadBudget(sessions=5, new_concepts=3, reviews=3, minutes=30),
    "B2": LoadBudget(sessions=5, new_concepts=4, reviews=3, minutes=35),
    "C1": LoadBudget(sessions=6, new_concepts=4, reviews=4, minutes=40),
    "C2": LoadBudget(sessions=6, new_concepts=4, reviews=4, minutes=45),
}
