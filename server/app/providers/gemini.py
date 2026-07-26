"""The analysing model, and the English coach voice.

Two jobs, one key, from Google AI Studio.

**Judging.** The model is the second layer of the evaluator, and it is deliberately
kept on a short leash: it returns `{opportunities, correct, error_tags}` per competency
and never a score. Asking a model for a number in [0,1] would reintroduce exactly the
session-to-session drift the authored error tags exist to remove, and `observed` stays
`correct / opportunities` no matter who counted. See ADR 0004 and `engine/evaluator.py`.

**Speaking.** Addis AI covers Amharic and Afan Oromo only, so the English coach lines
come from here. Gemini's TTS returns raw PCM, which this module wraps into a WAV
container before handing it back — a browser will not play a bare PCM stream.
"""

import base64
import json
import struct
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.engine.evaluator import Judgement
from app.providers.errors import ProviderError, ProviderNotConfigured

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# Gemini's TTS output format, fixed by the API rather than chosen by us.
TTS_SAMPLE_RATE = 24_000
TTS_CHANNELS = 1
TTS_BITS_PER_SAMPLE = 16


def _api_key() -> str:
    key = get_settings().gemini_api_key
    if not key:
        raise ProviderNotConfigured("gemini", "GEMINI_API_KEY")
    return key


async def _generate(model: str, body: dict, *, timeout: float = 60.0) -> dict:
    url = f"{BASE_URL}/models/{model}:generateContent"
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url, headers={"x-goog-api-key": _api_key()}, json=body
        )
    if response.status_code != 200:
        raise ProviderError("gemini", f"{response.status_code}: {response.text}")
    return response.json()


def _first_text(payload: dict) -> str:
    try:
        return payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise ProviderError("gemini", f"no text in response: {payload}") from exc


# --------------------------------------------------------------------------- #
# Judging                                                                      #
# --------------------------------------------------------------------------- #

_JUDGE_SYSTEM = """\
You are the second layer of a language assessment engine for Ethiopian learners of \
English at CEFR A2. You do not score. You count.

For each competency you are given, read the learner's VERBATIM transcript and report:

  opportunities  how many times the learner reached a point where this competency \
had to be used, correctly or not. A learner who avoided the structure entirely has \
zero opportunities.
  correct        of those, how many they got right.
  error_tags     the ids of the listed common errors you actually observed.

Rules that matter more than being helpful:
- Zero opportunities is the correct answer when the structure never came up. It means \
"no evidence", which is not the same as failure, and guessing here punishes exactly \
the hesitant beginners this product exists for.
- Never report correct > opportunities.
- Only use error tags from the provided list. Do not invent tags.
- The transcript is verbatim and will contain fillers and false starts. Those are \
speech, not errors, unless the competency is about them.
"""


@dataclass(frozen=True)
class CompetencyBrief:
    """What the model is told about one competency before it counts."""

    competency_id: str
    name: str
    description: str | None = None
    # tag -> the wrong form it names, so the model matches meaning rather than string.
    common_errors: dict[str, str] | None = None


_JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "judgements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "competency_id": {"type": "string"},
                    "opportunities": {"type": "integer"},
                    "correct": {"type": "integer"},
                    "error_tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["competency_id", "opportunities", "correct", "error_tags"],
            },
        }
    },
    "required": ["judgements"],
}


async def judge(
    transcript_verbatim: str, competencies: list[CompetencyBrief]
) -> dict[str, Judgement]:
    """Count opportunities the authored patterns could not reach.

    Returns the same shape as the deterministic layer so `evaluator.merge` can combine
    them, and merge is what stops this from ever lowering an authored match.
    """
    if not transcript_verbatim.strip() or not competencies:
        return {}

    rubric = [
        {
            "competency_id": c.competency_id,
            "name": c.name,
            "description": c.description or "",
            "common_errors": c.common_errors or {},
        }
        for c in competencies
    ]
    prompt = (
        f"{_JUDGE_SYSTEM}\n\nCOMPETENCIES:\n{json.dumps(rubric, ensure_ascii=False, indent=2)}"
        f"\n\nVERBATIM TRANSCRIPT:\n{transcript_verbatim}"
    )

    settings = get_settings()
    payload = await _generate(
        settings.gemini_model,
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseSchema": _JUDGE_SCHEMA,
            },
        },
    )

    try:
        parsed = json.loads(_first_text(payload))
    except json.JSONDecodeError as exc:
        raise ProviderError("gemini", f"judge returned non-JSON: {exc}") from exc

    allowed = {c.competency_id for c in competencies}
    out: dict[str, Judgement] = {}
    for row in parsed.get("judgements", []):
        competency_id = row.get("competency_id")
        if competency_id not in allowed:
            continue
        opportunities = max(int(row.get("opportunities", 0)), 0)
        # The prompt forbids it, but a model is not a validator.
        correct = min(max(int(row.get("correct", 0)), 0), opportunities)
        out[competency_id] = Judgement(
            competency_id=competency_id,
            opportunities=opportunities,
            correct=correct,
            error_tags=[str(t) for t in row.get("error_tags", [])],
            source="model",
        )
    return out


# --------------------------------------------------------------------------- #
# Conversation                                                                 #
# --------------------------------------------------------------------------- #

_DIRECTOR_SYSTEM = """\
You are Nero, an English speaking coach for an Ethiopian learner at CEFR A2.

Say one thing, out loud, in two sentences at most. You are being spoken aloud, so no \
markdown, no lists, no stage directions.

Keep the learner talking. Ask about the thing they are looking at or the thing they \
just said. Never correct grammar here — corrections are shown separately, and \
interrupting a beginner mid-thought to fix a verb is how you teach them to stop \
talking.
"""


async def direct(
    *,
    prompt: str,
    learner_said: str | None = None,
    learner_name: str | None = None,
    study_field: str | None = None,
) -> str:
    """The coach's next line."""
    context = [f"THE ACTIVITY: {prompt}"]
    if learner_name:
        context.append(f"THE LEARNER'S NAME: {learner_name}")
    if study_field:
        context.append(f"WHAT THEY STUDY OR DO: {study_field}")
    context.append(
        f"WHAT THEY JUST SAID: {learner_said}"
        if learner_said
        else "THEY HAVE NOT SPOKEN YET. Open the activity."
    )

    prompt_text = f"{_DIRECTOR_SYSTEM}\n\n" + "\n".join(context)
    payload = await _generate(
        get_settings().gemini_model,
        {
            "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096},
        },
    )
    return _first_text(payload).strip()


# --------------------------------------------------------------------------- #
# Speaking                                                                     #
# --------------------------------------------------------------------------- #


_TRANSCRIBE_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "words": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "start": {"type": "number"},
                    "end": {"type": "number"},
                },
                "required": ["text", "start", "end"],
            },
        },
    },
    "required": ["text", "words"],
}


@dataclass(frozen=True)
class AudioTranscript:
    """Shape shared with `stt.Transcription`, without importing that module."""

    text: str
    words: list[dict]
    language: str | None = None
    source: str = "gemini"


async def transcribe_audio(
    audio: bytes,
    *,
    filename: str = "turn.webm",
    language: str = "en",
) -> AudioTranscript:
    """Fallback English STT when whisper-api's GPUs are down.

    Timings are the model's best estimate from the audio — good enough to keep
    Confidence/Fluency moving when the dedicated STT is unavailable, not a
    substitute for Whisper on a healthy day.
    """
    mime = "audio/webm" if filename.endswith(".webm") else "audio/wav"
    prompt = (
        "Transcribe this English speech VERBATIM. Keep fillers like um/uh and "
        "grammar mistakes — do not clean the speech up. Return JSON with the full "
        f"text and a word list with start/end times in seconds. Language hint: {language}."
    )
    payload = await _generate(
        get_settings().gemini_model,
        {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime,
                                "data": base64.b64encode(audio).decode("ascii"),
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseSchema": _TRANSCRIBE_SCHEMA,
            },
        },
        timeout=90.0,
    )

    try:
        parsed = json.loads(_first_text(payload))
    except json.JSONDecodeError as exc:
        raise ProviderError("gemini", f"transcribe returned non-JSON: {exc}") from exc

    words: list[dict] = []
    for entry in parsed.get("words") or []:
        text = str(entry.get("text", "")).strip()
        start, end = entry.get("start"), entry.get("end")
        if text and start is not None and end is not None:
            words.append({"text": text, "start": float(start), "end": float(end)})

    text = (parsed.get("text") or " ".join(w["text"] for w in words)).strip()
    if not text:
        raise ProviderError("gemini", "transcribe returned empty text")

    # Even spacing when the model omitted timings — better than zero evidence.
    if text and not words:
        tokens = text.split()
        clock = 0.4
        for token in tokens:
            words.append({"text": token, "start": clock, "end": clock + 0.28})
            clock += 0.36

    return AudioTranscript(text=text, words=words, language=language, source="gemini")


async def speak(text: str, *, voice: str | None = None) -> bytes:
    """The English coach voice, as playable WAV bytes."""
    settings = get_settings()
    payload = await _generate(
        settings.gemini_tts_model,
        {
            "contents": [{"role": "user", "parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice or settings.gemini_tts_voice
                        }
                    }
                },
            },
        },
    )

    try:
        part = payload["candidates"][0]["content"]["parts"][0]
        encoded = part["inlineData"]["data"]
    except (KeyError, IndexError) as exc:
        raise ProviderError("gemini", f"no audio in response: {payload}") from exc

    return _wav(base64.b64decode(encoded))


def _wav(pcm: bytes) -> bytes:
    """Wrap raw PCM in a WAV header.

    Gemini returns headerless little-endian PCM. An `<audio>` element handed those
    bytes plays nothing and reports no error, which is a genuinely confusing way to
    lose an afternoon.
    """
    byte_rate = TTS_SAMPLE_RATE * TTS_CHANNELS * TTS_BITS_PER_SAMPLE // 8
    block_align = TTS_CHANNELS * TTS_BITS_PER_SAMPLE // 8
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + len(pcm),
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM
        TTS_CHANNELS,
        TTS_SAMPLE_RATE,
        byte_rate,
        block_align,
        TTS_BITS_PER_SAMPLE,
        b"data",
        len(pcm),
    )
    return header + pcm
