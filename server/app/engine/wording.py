"""Deterministic English for a session's objective and opening prompt.

Composed from authored fields rather than generated, so a session is well-formed
before any model is called. The conversation director may rephrase the prompt at
speaking time; it may not change the targets or the criteria.

This is not a prop — nothing here stands in for a measurement. It is the fallback
wording that makes the engine runnable without a network call.
"""

from app.models import Competency

_OPENING = {
    "observation_description": "Look at the picture. {theme_sentence} Tell me what you see.",
    "question_answer": "{theme_sentence} I am going to ask you a few questions.",
    "professional_communication": "{theme_sentence} Let's act it out together.",
}


def theme_sentence(theme: str) -> str:
    """"Introducing yourself to a university class" -> a sentence a coach would say."""
    cleaned = theme.strip().rstrip(".")
    if not cleaned:
        return "Let's practise together."
    return f"Imagine you are {cleaned[0].lower()}{cleaned[1:]}."


def learning_objective(primary: Competency, theme: str) -> str:
    """One sentence naming what this session is for.

    Uses the competency's authored success criteria when there is one, because that is
    the same text the evaluator scores against — objective and grading cannot drift.
    """
    if primary.success_criteria:
        criteria = primary.success_criteria.rstrip(".")
        return f"{criteria}, while {theme[0].lower()}{theme[1:]}."
    return f"Practise {primary.name.lower()} while {theme[0].lower()}{theme[1:]}."


def opening_prompt(family: str, theme: str) -> str:
    pattern = _OPENING.get(family, "{theme_sentence} Tell me about it.")
    return pattern.format(theme_sentence=theme_sentence(theme))


def reflection_prompt() -> str:
    """Stage six. The learner names the change rather than being told it — a
    self-report that matches the detected tag is what shows the correction landed."""
    return "What changed between your first answer and your second?"
