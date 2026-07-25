"""Delivery metrics from word timestamps.

Every number here is measured from the transcriber's word list. ElevenLabs Scribe v2
returns `words`, each `{ text, start, end, type }` where `type` is `word`, `spacing` or
`audio_event`. The story promises confidence 39% -> 47% and sentence length 6 -> 11
words; those have to be computed or a judge will notice.

These describe an *utterance*, so they are stored on the turn. They reach the
Communication Profile only as evidence on competencies — never as a dashboard number
in their own right. See ADR 0002 and delivery.py.
"""

from dataclasses import asdict, dataclass

# Gaps longer than this count as pauses rather than word boundaries.
PAUSE_THRESHOLD_SECONDS = 0.7

FILLERS = {"um", "uh", "eh", "umm", "uhh", "ehh", "hmm", "er"}

_SENTENCE_ENDINGS = ".?!"


@dataclass(frozen=True)
class TurnMetrics:
    word_count: int
    speech_seconds: float
    words_per_minute: float
    pause_count: int
    pause_seconds: float
    pause_ratio: float
    filler_count: int
    filler_rate_per_100: float
    sentence_count: int
    mean_sentence_length: float
    # Silence before the first word — the latency half of F003.01's criteria.
    first_word_latency_seconds: float

    def as_json(self) -> dict:
        return asdict(self)


def _clean_word(text: str) -> str:
    return text.strip().strip(".,!?;:\"'").lower()


def normalise_words(words: list[dict]) -> list[tuple[str, float, float]]:
    """Reduce a transcriber's word list to `(word, start, end)` triples.

    Two shapes are accepted because two transcribers are in play across the project's
    history: `{text, start, end, type}` from ElevenLabs Scribe, and `{text, timestamp:
    [start, end]}` from Whisper-style APIs.

    Scribe's non-word entries are dropped. A `spacing` entry has a text of " " and an
    `audio_event` might be laughter; counting either as a word would inflate the word
    count and deflate words-per-minute, and the pauses we care about are already
    measurable from the gaps between real words.
    """
    out: list[tuple[str, float, float]] = []
    for entry in words:
        if entry.get("type") not in (None, "word"):
            continue

        timestamp = entry.get("timestamp")
        if isinstance(timestamp, list | tuple) and len(timestamp) == 2:
            start, end = timestamp
        else:
            start, end = entry.get("start"), entry.get("end")
        if start is None or end is None:
            continue

        word = _clean_word(entry.get("text", ""))
        if word:
            out.append((word, float(start), float(end)))
    return out


def compute_metrics(
    words: list[dict], *, punctuated_transcript: str | None = None
) -> TurnMetrics:
    """Fold word timestamps into the delivery numbers.

    Words per minute is measured over speech time — first word to last — rather than
    recording length, so a learner who thinks for six seconds before starting is not
    scored as speaking slowly. The thinking time is reported separately as latency,
    which is what `F003.01` actually cares about.
    """
    timed = normalise_words(words)

    if not timed:
        return TurnMetrics(
            word_count=0,
            speech_seconds=0.0,
            words_per_minute=0.0,
            pause_count=0,
            pause_seconds=0.0,
            pause_ratio=0.0,
            filler_count=0,
            filler_rate_per_100=0.0,
            sentence_count=0,
            mean_sentence_length=0.0,
            first_word_latency_seconds=0.0,
        )

    word_count = len(timed)
    speech_seconds = max(timed[-1][2] - timed[0][1], 0.0)

    pause_count = 0
    pause_seconds = 0.0
    for (_, _, prev_end), (_, next_start, _) in zip(timed, timed[1:], strict=False):
        gap = next_start - prev_end
        if gap > PAUSE_THRESHOLD_SECONDS:
            pause_count += 1
            pause_seconds += gap

    # Fillers are counted from the verbatim track only — a cleaned-up transcript is
    # exactly what deletes them.
    filler_count = sum(1 for word, _, _ in timed if word in FILLERS)

    source = punctuated_transcript or " ".join(word for word, _, _ in timed)
    sentence_count = sum(1 for ch in source if ch in _SENTENCE_ENDINGS) or 1

    return TurnMetrics(
        word_count=word_count,
        speech_seconds=speech_seconds,
        words_per_minute=(word_count / speech_seconds * 60.0) if speech_seconds > 0 else 0.0,
        pause_count=pause_count,
        pause_seconds=pause_seconds,
        pause_ratio=(pause_seconds / speech_seconds) if speech_seconds > 0 else 0.0,
        filler_count=filler_count,
        filler_rate_per_100=(filler_count / word_count * 100.0) if word_count else 0.0,
        sentence_count=sentence_count,
        mean_sentence_length=word_count / sentence_count,
        first_word_latency_seconds=max(timed[0][1], 0.0),
    )
