"""ElevenLabs Scribe — English speech to text with word timestamps.

Scribe's `words` list is exactly the shape `engine/metrics.py` already accepts
(`{text, start, end, type}`), including `spacing` and `audio_event` entries that
`normalise_words` drops. This is the load-bearing STT path when it is configured:
whisper-api.com has been failing mid-demo on GPU errors, and Gemini's fallback
timings are estimates.
"""

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.providers.errors import ProviderError, ProviderNotConfigured

BASE_URL = "https://api.elevenlabs.io/v1"
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Transcription:
    text: str
    words: list[dict]
    language: str | None = None
    source: str = "elevenlabs"


def _api_key() -> str:
    key = get_settings().elevenlabs_api_key
    if not key:
        raise ProviderNotConfigured("elevenlabs", "ELEVENLABS_API_KEY")
    return key


def _headers() -> dict[str, str]:
    return {"xi-api-key": _api_key()}


async def transcribe(
    *,
    audio: bytes,
    filename: str = "turn.webm",
    language: str = "en",
) -> Transcription:
    """One turn → verbatim text + per-word start/end times."""
    if not audio:
        raise ProviderError("elevenlabs", "empty audio")

    content_type = "audio/webm" if filename.endswith(".webm") else "application/octet-stream"
    data = {
        "model_id": get_settings().elevenlabs_stt_model,
        "language_code": language,
        "timestamps_granularity": "word",
        "tag_audio_events": "false",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/speech-to-text",
            headers=_headers(),
            data=data,
            files={"file": (filename, audio, content_type)},
        )

    if response.status_code != 200:
        raise ProviderError("elevenlabs", f"{response.status_code}: {response.text}")

    body = response.json()
    words: list[dict] = []
    for entry in body.get("words") or []:
        # Keep type so metrics can drop spacing / audio_event the same way it
        # does for Scribe fixtures in the unit tests.
        text = entry.get("text")
        start, end = entry.get("start"), entry.get("end")
        if text is None or start is None or end is None:
            continue
        word = {
            "text": str(text),
            "start": float(start),
            "end": float(end),
        }
        if entry.get("type"):
            word["type"] = entry["type"]
        words.append(word)

    text = (body.get("text") or "").strip()
    if not text and words:
        text = " ".join(
            w["text"] for w in words if w.get("type") in (None, "word")
        ).strip()
    if not text:
        raise ProviderError("elevenlabs", f"empty transcription: {body}")

    return Transcription(
        text=text,
        words=words,
        language=body.get("language_code") or language,
    )


async def speak(text: str, *, voice_id: str | None = None) -> bytes:
    """English coach voice via ElevenLabs TTS (mp3 bytes)."""
    if not text.strip():
        raise ProviderError("elevenlabs", "nothing to speak")

    settings = get_settings()
    voice = voice_id or settings.elevenlabs_tts_voice_id
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/text-to-speech/{voice}/stream",
            headers={**_headers(), "Accept": "audio/mpeg"},
            json={
                "text": text,
                "model_id": settings.elevenlabs_tts_model,
            },
        )
    if response.status_code != 200:
        raise ProviderError("elevenlabs", f"{response.status_code}: {response.text}")
    return response.content
