"""Matching competency IDs against the patterns used in curriculum and config rows.

Three forms appear in authored data, and they mean different things:

    G006.01   exactly that sub-competency
    G006      every sub-competency of that parent
    F015.*    the same thing, written the way section 8 writes dimension members
    V*        every competency in a skill library — the vocabulary-agnostic wildcard

Only `elicits` rows, domain requirements and dimension members may carry a pattern.
Anything that targets, scores, schedules or stores addresses a sub-competency, so
this module never returns a parent as if it were addressable.
"""

SKILL_LETTERS = {"V": "vocabulary", "G": "grammar", "P": "pronunciation", "F": "fluency"}


def parent_of(competency_id: str) -> str:
    """`G006.01` -> `G006`. A bare parent is returned unchanged."""
    return competency_id.split(".", 1)[0]


def matches(pattern: str, competency_id: str) -> bool:
    """Does one authored pattern cover one sub-competency ID?"""
    pattern = pattern.strip()

    # `V*` — a whole skill library.
    if len(pattern) == 2 and pattern.endswith("*"):
        return competency_id.startswith(pattern[0])

    # `F015.*` — every sub-competency of a parent.
    if pattern.endswith(".*"):
        return parent_of(competency_id) == pattern[:-2]

    # `G002` — a bare parent, which means the same thing.
    if "." not in pattern:
        return parent_of(competency_id) == pattern

    return competency_id == pattern


def best_match(patterns: dict[str, float], competency_id: str) -> float | None:
    """The value of the most specific pattern covering this competency.

    Specificity matters because a template may list both `V*` at 0.9 and a precise
    sub-competency at 0.5; the precise row is the authored intent for that one
    competency and must win regardless of dictionary order.
    """
    best: tuple[int, float] | None = None
    for pattern, value in patterns.items():
        if not matches(pattern, competency_id):
            continue
        if len(pattern) == 2 and pattern.endswith("*"):
            specificity = 0
        elif pattern.endswith(".*") or "." not in pattern:
            specificity = 1
        else:
            specificity = 2
        if best is None or specificity > best[0]:
            best = (specificity, value)
    return None if best is None else best[1]
