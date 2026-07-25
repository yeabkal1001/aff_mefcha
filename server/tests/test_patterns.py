"""Pattern matching for elicits rows, domain requirements and dimension members."""

from app.engine.patterns import best_match, matches, parent_of


def test_parent_of():
    assert parent_of("G006.01") == "G006"
    assert parent_of("G006") == "G006"


def test_exact_sub_competency():
    assert matches("G006.01", "G006.01")
    assert not matches("G006.01", "G006.05")


def test_bare_parent_covers_its_subs():
    assert matches("G002", "G002.03")
    assert not matches("G002", "G011.02")


def test_dotted_star_is_the_same_as_a_bare_parent():
    assert matches("F015.*", "F015.02")
    assert not matches("F015.*", "F013.02")


def test_skill_wildcard_covers_the_library():
    """`V*` means the template is vocabulary-agnostic: it exercises whatever the
    stimulus depicts, so any V competency can be routed through it."""
    assert matches("V*", "V001.05")
    assert not matches("V*", "G001.01")


def test_specific_pattern_beats_the_wildcard():
    """EX001 lists `V*` at 0.9; a precise row must win regardless of dict order."""
    patterns = {"V*": 0.9, "V001.05": 0.4}
    assert best_match(patterns, "V001.05") == 0.4
    assert best_match(patterns, "V003.01") == 0.9


def test_no_match_returns_none():
    assert best_match({"G002": 0.9}, "F002.01") is None
