"""Load the authored content into Postgres.

    python -m app.seed.run

Safe to re-run: content rows are upserted and their child rows are replaced, so this
is also the reset path for the static half of the database. Learner data is never
touched here.
"""

import asyncio

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import session_factory
from app.models import (
    Competency,
    CompetencyError,
    CompetencyPrereq,
    Dimension,
    DimensionMember,
    Domain,
    DomainContext,
    DomainObjective,
    DomainRequires,
    LifePath,
    LifePathContext,
    LifePathDomain,
    LifePathTemplatePref,
    Template,
    TemplateElicits,
    TemplateMeasures,
    TemplateRequires,
)
from app.seed.content_pack import COMPETENCIES, METADATA_PENDING, TEMPLATES
from app.seed.curriculum import DOMAINS
from app.seed.paths import DIMENSIONS, LIFE_PATHS


async def _upsert(db: AsyncSession, model, rows: list[dict], key: list[str]) -> None:
    if not rows:
        return
    stmt = pg_insert(model).values(rows)
    updatable = {c for c in rows[0] if c not in key}
    if updatable:
        stmt = stmt.on_conflict_do_update(
            index_elements=key, set_={c: stmt.excluded[c] for c in updatable}
        )
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=key)
    await db.execute(stmt)


async def seed_competencies(db: AsyncSession) -> int:
    rows = []
    for c in COMPETENCIES:
        rows.append(
            {
                "id": c["id"],
                "parent": c["parent"],
                "skill": c["skill"],
                "name": c["name"],
                "cefr_min": c["cefr_min"],
                "cefr_max": c["cefr_max"],
                "observable": c.get("observable", True),
                "success_criteria": c.get("success_criteria"),
                "elicitation_cues": c.get("elicitation_cues", []),
                "l1_risk_json": c.get("l1_risk", {}),
                "l1_confusions_json": c.get("l1_confusions"),
                "measurement": c.get("measurement"),
            }
        )
    for c in METADATA_PENDING:
        rows.append(
            {
                "id": c["id"],
                "parent": c["parent"],
                "skill": c["skill"],
                "name": c["name"],
                "cefr_min": c["cefr_min"],
                "cefr_max": c["cefr_max"],
                "observable": True,
                "success_criteria": None,
                "elicitation_cues": [],
                "l1_risk_json": {},
                "l1_confusions_json": None,
                "measurement": None,
            }
        )
    await _upsert(db, Competency, rows, ["id"])

    ids = [c["id"] for c in COMPETENCIES]
    await db.execute(delete(CompetencyPrereq).where(CompetencyPrereq.competency_id.in_(ids)))
    await db.execute(delete(CompetencyError).where(CompetencyError.competency_id.in_(ids)))

    known = {r["id"] for r in rows}
    prereqs, errors = [], []
    for c in COMPETENCIES:
        for requires in c.get("prerequisites", []):
            # A prerequisite outside the seeded slice would otherwise fail the foreign
            # key and take the whole load down with it.
            if requires in known:
                prereqs.append({"competency_id": c["id"], "requires_id": requires})
        for e in c.get("common_errors", []):
            errors.append(
                {
                    "competency_id": c["id"],
                    "wrong": e["wrong"],
                    "right": e["right"],
                    "tag": e["tag"],
                }
            )
    if prereqs:
        await db.execute(pg_insert(CompetencyPrereq).values(prereqs).on_conflict_do_nothing())
    if errors:
        await db.execute(pg_insert(CompetencyError).values(errors))
    return len(rows)


async def seed_domains(db: AsyncSession) -> int:
    await _upsert(
        db,
        Domain,
        [
            {
                "id": d["id"],
                "cefr": d["cefr"],
                "name": d["name"],
                "description": d.get("description"),
            }
            for d in DOMAINS
        ],
        ["id"],
    )

    ids = [d["id"] for d in DOMAINS]
    await db.execute(delete(DomainObjective).where(DomainObjective.domain_id.in_(ids)))
    await db.execute(delete(DomainContext).where(DomainContext.domain_id.in_(ids)))
    await db.execute(delete(DomainRequires).where(DomainRequires.domain_id.in_(ids)))

    objectives, contexts, requires = [], [], []
    for d in DOMAINS:
        for text in d.get("objectives", []):
            objectives.append({"domain_id": d["id"], "text": text})
        for position, text in enumerate(d.get("practice_contexts", [])):
            contexts.append({"domain_id": d["id"], "text": text, "position": position})
        for r in d.get("requires", []):
            requires.append(
                {
                    "domain_id": d["id"],
                    "competency_id": r["competency"],
                    "role": r["role"],
                    "explicit_subs_json": r.get("subs", []),
                }
            )
    for model, values in ((DomainObjective, objectives), (DomainContext, contexts),
                          (DomainRequires, requires)):
        if values:
            await db.execute(pg_insert(model).values(values))
    return len(DOMAINS)


async def seed_templates(db: AsyncSession) -> int:
    await _upsert(
        db,
        Template,
        [
            {
                "id": t["id"],
                "name": t["name"],
                "family": t["family"],
                "stimulus_type": t["stimulus_type"],
                "interaction_mode": t["interaction_mode"],
                "cefr_min": t["cefr_min"],
                "cefr_max": t["cefr_max"],
                "duration_min": t["duration_minutes"][0],
                "duration_max": t["duration_minutes"][1],
                "scaffold_ladder_json": t["scaffold_ladder"],
            }
            for t in TEMPLATES
        ],
        ["id"],
    )

    ids = [t["id"] for t in TEMPLATES]
    await db.execute(delete(TemplateMeasures).where(TemplateMeasures.template_id.in_(ids)))
    await db.execute(delete(TemplateElicits).where(TemplateElicits.template_id.in_(ids)))
    await db.execute(delete(TemplateRequires).where(TemplateRequires.template_id.in_(ids)))

    known = set((await db.scalars(select(Competency.id))).all())
    measures, elicits, requires = [], [], []
    for t in TEMPLATES:
        for skill, reliability in t["measures"].items():
            measures.append(
                {"template_id": t["id"], "skill": skill, "reliability": reliability}
            )
        for e in t["elicits"]:
            elicits.append(
                {
                    "template_id": t["id"],
                    "competency_id": e["competency"],
                    "strength": e["strength"],
                    "note": e.get("note"),
                }
            )
        for competency_id in t.get("requires_fluency", []):
            if competency_id not in known:
                # Leaving this silent would make the template permanently unselectable.
                raise RuntimeError(
                    f"{t['id']} requires {competency_id}, which is not seeded. "
                    "Add it to METADATA_PENDING or the template can never be chosen."
                )
            requires.append({"template_id": t["id"], "competency_id": competency_id})
    for model, values in ((TemplateMeasures, measures), (TemplateElicits, elicits),
                          (TemplateRequires, requires)):
        if values:
            await db.execute(pg_insert(model).values(values))
    return len(TEMPLATES)


async def seed_life_paths(db: AsyncSession) -> int:
    await _upsert(
        db,
        LifePath,
        [
            {
                "id": p["id"],
                "name": p["name"],
                "vocabulary_overlay_json": p.get("vocabulary_overlay", []),
            }
            for p in LIFE_PATHS
        ],
        ["id"],
    )

    ids = [p["id"] for p in LIFE_PATHS]
    await db.execute(delete(LifePathDomain).where(LifePathDomain.life_path_id.in_(ids)))
    await db.execute(delete(LifePathContext).where(LifePathContext.life_path_id.in_(ids)))
    await db.execute(
        delete(LifePathTemplatePref).where(LifePathTemplatePref.life_path_id.in_(ids))
    )

    known_domains = set((await db.scalars(select(Domain.id))).all())
    known_templates = set((await db.scalars(select(Template.id))).all())

    domains, contexts, prefs = [], [], []
    for p in LIFE_PATHS:
        for domain_id, priority in p.get("domain_priority", {}).items():
            if domain_id in known_domains:
                domains.append(
                    {"life_path_id": p["id"], "domain_id": domain_id, "priority": priority}
                )
        for src, dst in p.get("context_substitutions", {}).items():
            contexts.append({"life_path_id": p["id"], "from_context": src, "to_context": dst})
        for template_id, multiplier in p.get("template_preference", {}).items():
            # Preferences for templates outside the demo slice are skipped rather than
            # dropped from the data, so they start working when the descriptor lands.
            if template_id in known_templates:
                prefs.append(
                    {
                        "life_path_id": p["id"],
                        "template_id": template_id,
                        "multiplier": multiplier,
                    }
                )
    for model, values in ((LifePathDomain, domains), (LifePathContext, contexts),
                          (LifePathTemplatePref, prefs)):
        if values:
            await db.execute(pg_insert(model).values(values))
    return len(LIFE_PATHS)


async def seed_dimensions(db: AsyncSession) -> int:
    await _upsert(
        db,
        Dimension,
        [
            {
                "id": d["id"],
                "name": d["name"],
                "fixed": d.get("fixed", False),
                "life_path_id": d.get("life_path_id"),
                "position": d.get("position", 0),
            }
            for d in DIMENSIONS
        ],
        ["id"],
    )

    ids = [d["id"] for d in DIMENSIONS]
    await db.execute(delete(DimensionMember).where(DimensionMember.dimension_id.in_(ids)))

    members = [
        {
            "dimension_id": d["id"],
            "competency_pattern": m["pattern"],
            "weight": m.get("weight", 1.0),
        }
        for d in DIMENSIONS
        for m in d["members"]
    ]
    if members:
        await db.execute(pg_insert(DimensionMember).values(members))
    return len(DIMENSIONS)


async def main() -> None:
    async with session_factory()() as db:
        counts = {
            "competencies": await seed_competencies(db),
            "domains": await seed_domains(db),
            "templates": await seed_templates(db),
            "life_paths": await seed_life_paths(db),
            "dimensions": await seed_dimensions(db),
        }
        await db.commit()

    for name, count in counts.items():
        print(f"  {name:<14} {count}")

    # Eight slots per learner is a layout guarantee, so a miscount here is a bug that
    # would otherwise only show up on the last screen of the pitch.
    for path in LIFE_PATHS:
        slots = sum(1 for d in DIMENSIONS if d.get("fixed")) + sum(
            1 for d in DIMENSIONS if d.get("life_path_id") == path["id"]
        )
        status = "ok" if slots == 8 else "WRONG"
        print(f"  profile slots  {path['id']}: {slots} ({status})")


if __name__ == "__main__":
    asyncio.run(main())
