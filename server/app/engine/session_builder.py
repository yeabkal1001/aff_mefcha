"""Choosing a template and a stimulus for one set of targets.

    score(T) = SUM over targets of priority(c) x elicits(T, c) x measures(T, skill(c))
             + 0.20 x life_path preference
             - 0.30 x used in the last few sessions
             - 0.40 x same template as last time for these targets
             - 0.15 x same stimulus type as the previous session
             - 0.25 x asset missing

The fourth term is the one that matters most. "Spaced retrieval in a new context" was
an intention with no mechanism until it became a penalty, and it is what makes the
same grammar come back as a roleplay instead of another picture description.

Asset availability is the last term and it is soft on purpose: filtering unavailable
assets out would let the stimulus pool silently outrank the curriculum, and then
"the engine chose this template" stops being a checkable claim. See ADR 0001.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.engine.constants import (
    GENERIC_THEME,
    MAX_RETRIES,
    RETRY_TRIGGER,
    TEMPLATE_SCORE_WEIGHTS,
)
from app.engine.patterns import best_match
from app.engine.selection import Candidate, LearnerView
from app.models import (
    Competency,
    StimulusPool,
    Template,
    TemplateElicits,
    TemplateMeasures,
    TemplateRequires,
)
from app.models.enums import cefr_rank


def target_set_key(competency_ids: list[str]) -> str:
    """The stimulus pool address for a set of targets. Order must not matter."""
    return "+".join(sorted(competency_ids))


@dataclass
class TemplateView:
    template: Template
    measures: dict[str, float]
    elicits: dict[str, float]
    requires: list[str]


@dataclass(frozen=True)
class TemplateChoice:
    template_id: str
    score: float
    breakdown: dict[str, float]
    # Why each other template lost, kept so a scheduling decision can be explained.
    rejected: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class StimulusChoice:
    stimulus_id: str | None
    asset_url: str | None
    spec: dict
    # exact | generic_theme | none — which rung of the fallback chain answered.
    resolution: str
    # True when the asset should be queued in the background so the same miss cannot
    # happen twice.
    queue_needed: bool


async def load_template_views(db: AsyncSession) -> dict[str, TemplateView]:
    templates = (await db.scalars(select(Template))).all()
    views = {
        t.id: TemplateView(template=t, measures={}, elicits={}, requires=[]) for t in templates
    }
    for row in (await db.scalars(select(TemplateMeasures))).all():
        if row.template_id in views:
            views[row.template_id].measures[row.skill] = row.reliability
    for row in (await db.scalars(select(TemplateElicits))).all():
        if row.template_id in views:
            views[row.template_id].elicits[row.competency_id] = row.strength
    for row in (await db.scalars(select(TemplateRequires))).all():
        if row.template_id in views:
            views[row.template_id].requires.append(row.competency_id)
    return views


def _unlocked(view: LearnerView, competency_id: str) -> bool:
    """Has the learner reached the band this competency starts at?

    This is what `requires_fluency` gates on. An A2 learner has not unlocked
    `F009 Expressing Opinions`, which starts at B1, so Debate is never offered however
    urgently a grammar competency is due.
    """
    competency: Competency | None = view.library.get(competency_id)
    if competency is None:
        return False
    return cefr_rank(competency.cefr_min) <= cefr_rank(view.profile.cefr)


async def choose_template(
    db: AsyncSession,
    view: LearnerView,
    *,
    targets: list[Candidate],
    theme: str,
    template_prefs: dict[str, float],
    recent_template_ids: list[str],
    previous_stimulus_type: str | None,
    minutes_remaining: int,
    template_views: dict[str, TemplateView] | None = None,
) -> TemplateChoice:
    views = template_views or await load_template_views(db)
    rejected: dict[str, str] = {}
    best: TemplateChoice | None = None

    target_ids = [t.competency_id for t in targets]
    pool_key = target_set_key(target_ids)

    for template_id, tv in views.items():
        template = tv.template

        if not (
            cefr_rank(template.cefr_min)
            <= cefr_rank(view.profile.cefr)
            <= cefr_rank(template.cefr_max)
        ):
            rejected[template_id] = f"band {template.cefr_min}-{template.cefr_max}"
            continue

        locked = [c for c in tv.requires if not _unlocked(view, c)]
        if locked:
            rejected[template_id] = f"requires {', '.join(locked)}, not unlocked"
            continue

        if template.duration_min > minutes_remaining:
            rejected[template_id] = (
                f"needs {template.duration_min} min, {minutes_remaining} left"
            )
            continue

        fit = 0.0
        for target in targets:
            strength = best_match(tv.elicits, target.competency_id)
            if strength is None:
                continue
            reliability = tv.measures.get(target.skill, 0.0)
            fit += target.priority * strength * reliability

        w = TEMPLATE_SCORE_WEIGHTS
        breakdown = {
            "target_fit": fit,
            "life_path_preference": w["life_path_preference"]
            * template_prefs.get(template_id, 1.0),
            "used_recently": (
                w["used_in_last_n_sessions"] if template_id in recent_template_ids else 0.0
            ),
            "same_template_for_targets": (
                w["same_template_as_last_time_for"]
                if any(
                    (state := view.competencies.get(t.competency_id)) is not None
                    and state.last_template == template_id
                    for t in targets
                )
                else 0.0
            ),
            "same_stimulus_type": (
                w["same_stimulus_type_as_previous"]
                if previous_stimulus_type == template.stimulus_type
                else 0.0
            ),
            "asset_missing": (
                0.0
                if await _pool_has(db, template_id, pool_key, theme)
                else w["asset_missing"]
            ),
        }
        score = sum(breakdown.values())

        if best is None or score > best.score:
            if best is not None:
                rejected[best.template_id] = f"scored {best.score:.3f}"
            best = TemplateChoice(template_id=template_id, score=score, breakdown=breakdown)
        else:
            rejected[template_id] = f"scored {score:.3f}"

    if best is None:
        raise LookupError(
            "no template survives the band, fluency and duration gates for "
            f"{view.profile.learner_id!r}"
        )
    return TemplateChoice(
        template_id=best.template_id,
        score=best.score,
        breakdown=best.breakdown,
        rejected=rejected,
    )


async def _pool_has(db: AsyncSession, template_id: str, pool_key: str, theme: str) -> bool:
    found = await db.scalar(
        select(StimulusPool.id).where(
            StimulusPool.template_id == template_id,
            StimulusPool.target_set_key == pool_key,
            StimulusPool.theme == theme,
        )
    )
    return found is not None


async def resolve_stimulus(
    db: AsyncSession,
    *,
    template: Template,
    target_ids: list[str],
    theme: str,
) -> StimulusChoice:
    """Walk down the key rather than showing a spinner.

    Exact address, then the same targets under a generic theme, then nothing — which
    is only acceptable for a template whose stimulus is text and needs no asset. The
    caller queues the miss in the background so it cannot happen twice.
    """
    pool_key = target_set_key(target_ids)

    for theme_attempt, resolution in ((theme, "exact"), (GENERIC_THEME, "generic_theme")):
        row = await db.scalar(
            select(StimulusPool).where(
                StimulusPool.template_id == template.id,
                StimulusPool.target_set_key == pool_key,
                StimulusPool.theme == theme_attempt,
            )
        )
        if row is not None:
            return StimulusChoice(
                stimulus_id=row.id,
                asset_url=row.asset_url,
                spec=row.spec_json or {},
                resolution=resolution,
                queue_needed=resolution != "exact",
            )

    return StimulusChoice(
        stimulus_id=None,
        asset_url=None,
        spec={},
        resolution="none",
        queue_needed=True,
    )


def build_evaluation_metrics(
    targets: list[Candidate],
    view: LearnerView,
    template_view: TemplateView,
) -> dict[str, dict]:
    """The target list joined to authored criteria, weighted by observation reliability.

    The evaluator prompt is generated from this, which is what makes scoring consistent
    across sessions by construction rather than by intention.
    """
    metrics: dict[str, dict] = {}
    for target in targets:
        competency = view.library[target.competency_id]
        metrics[target.competency_id] = {
            "criteria": competency.success_criteria,
            "error_tags": sorted({e.tag for e in competency.common_errors}),
            "weight": template_view.measures.get(competency.skill, 0.0),
        }
    return metrics


def retry_rules(template_view: TemplateView) -> dict:
    return {
        "trigger_below": RETRY_TRIGGER,
        "max_retries": MAX_RETRIES,
        "scaffold_ladder": template_view.template.scaffold_ladder_json,
    }
