"""Delivery metrics from word timestamps, checked against a hand count.

The voice-pipeline skill's definition of done: one recording produces metrics that match
a hand count of pauses and words. This is that check, on a fixture in the shape
ElevenLabs Scribe actually returns.
"""

import pytest

from app.engine.metrics import compute_metrics


def word(text: str, start: float, end: float) -> dict:
    return {"text": text, "start": start, "end": end, "type": "word"}


# Twelve words over ten seconds of speech, starting 2.5s in, with one 1.5s pause and
# one filler. Every expected value below is countable by hand from this list.
FIXTURE = [
    word("Hello", 2.5, 2.9),
    word("my", 3.0, 3.2),
    word("name", 3.2, 3.5),
    word("is", 3.5, 3.7),
    word("Hana", 3.7, 4.2),
    word("um", 4.3, 4.7),
    word("I", 6.2, 6.4),   # 1.5s gap before this word
    word("am", 6.4, 6.6),
    word("study", 6.6, 7.0),
    word("software", 7.0, 7.6),
    word("engineering", 7.6, 8.4),
    word("today", 8.4, 12.5),
]


def test_counts_words_and_speech_time():
    m = compute_metrics(FIXTURE)
    assert m.word_count == 12
    assert m.speech_seconds == pytest.approx(10.0)
    assert m.words_per_minute == pytest.approx(72.0)


def test_latency_is_reported_separately_from_pace():
    """A learner who thinks for two seconds before starting is not slow — she is
    hesitant, and F003.01 is the competency that cares."""
    m = compute_metrics(FIXTURE)
    assert m.first_word_latency_seconds == pytest.approx(2.5)


def test_counts_only_gaps_over_the_threshold():
    m = compute_metrics(FIXTURE)
    assert m.pause_count == 1
    assert m.pause_seconds == pytest.approx(1.5)
    assert m.pause_ratio == pytest.approx(0.15)


def test_fillers_survive_from_the_verbatim_track():
    """If this ever reads zero, the polished transcript is being graded by mistake."""
    m = compute_metrics(FIXTURE)
    assert m.filler_count == 1
    assert m.filler_rate_per_100 == pytest.approx(100 / 12)


def test_mean_sentence_length_uses_the_punctuated_transcript():
    m = compute_metrics(FIXTURE, punctuated_transcript="Hello, my name is Hana. I am study.")
    assert m.sentence_count == 2
    assert m.mean_sentence_length == pytest.approx(6.0)


def test_empty_turn_produces_zeros_not_errors():
    m = compute_metrics([])
    assert m.word_count == 0
    assert m.words_per_minute == 0.0


def test_scribe_spacing_and_audio_events_are_not_words():
    """Scribe interleaves spacing and non-speech entries with real words. Counting them
    would inflate the word count and deflate words-per-minute."""
    noisy = [
        FIXTURE[0],
        {"text": " ", "start": 2.9, "end": 3.0, "type": "spacing"},
        {"text": "(laughter)", "start": 3.0, "end": 3.1, "type": "audio_event"},
        FIXTURE[1],
    ]
    assert compute_metrics(noisy).word_count == 2


def test_whisper_style_timestamps_still_parse():
    """The older {timestamp: [start, end]} shape is accepted, so a recorded fixture from
    before the provider switch does not silently score as silence."""
    m = compute_metrics([{"text": "Hello", "timestamp": [0.0, 0.5]}])
    assert m.word_count == 1
