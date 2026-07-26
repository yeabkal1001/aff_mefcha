"""Amharic: translation, and the voice that explains the correction.

This provider is the emotional beat of the demo — the moment the coach stops being a
grammar checker and explains the mistake in the learner's own language.

Scope is narrow on purpose. Addis AI's STT and TTS both cover Amharic and Afan Oromo
exclusively, so nothing English goes through this key; the English side is Whisper for
input and Gemini for output. Two things from their docs shape the calls below: Ge'ez
punctuation (`፣` and `።`) drives pausing and intonation, so the Amharic has to be
punctuated properly, and English words inside an Amharic sentence pronounce badly, so
a correction line keeps the quoted English short and lets the English voice read the
model sentence instead.
"""

import base64
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.providers.errors import ProviderError, ProviderNotConfigured

BASE_URL = "https://api.addisassistant.com/api"

AMHARIC = "am"
AFAN_OROMO = "om"


def _api_key() -> str:
    key = get_settings().addis_api_key
    if not key:
        raise ProviderNotConfigured("addis", "ADDIS_API_KEY")
    return key


def _headers() -> dict[str, str]:
    return {"x-api-key": _api_key()}


@dataclass(frozen=True)
class AmharicClip:
    audio: bytes
    content_type: str


async def transcribe(
    audio: bytes, *, filename: str = "turn.wav", language: str = AMHARIC
) -> str:
    """Amharic or Afan Oromo speech to text.

    Present for completeness — the graded English loop does not call it. Note there
    are no word timestamps in the response, so nothing measured can be built on this.
    """
    if language not in (AMHARIC, AFAN_OROMO):
        raise ProviderError("addis", f"unsupported language {language!r}; am or om only")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/v2/stt",
            headers=_headers(),
            files={"audio": (filename, audio, "application/octet-stream")},
            data={"request_data": f'{{"language_code": "{language}"}}'},
        )
    if response.status_code != 200:
        raise ProviderError("addis", f"{response.status_code}: {response.text}")

    body = response.json()
    transcription = (body.get("data") or {}).get("transcription")
    if transcription is None:
        raise ProviderError("addis", f"no transcription in response: {body}")
    return transcription


async def speak(text: str, *, language: str = AMHARIC) -> AmharicClip:
    """The Amharic correction line, spoken.

    Uses the legacy `/audio` endpoint, which returns the clip inline. Addis Voices 2
    (`/v1/voice/generations`) returns a signed URL and requires a voice id from their
    catalogue plus an idempotency key; inline bytes are the simpler contract when the
    caller just wants something to play.
    """
    if language not in (AMHARIC, AFAN_OROMO):
        raise ProviderError("addis", f"unsupported language {language!r}; am or om only")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{BASE_URL}/v1/audio",
            headers=_headers(),
            json={"text": text, "language": language, "stream": False},
        )
    if response.status_code != 200:
        raise ProviderError("addis", f"{response.status_code}: {response.text}")

    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        body = response.json()
        encoded = (
            body.get("audio")
            or body.get("audio_base64")
            or (body.get("data") or {}).get("audio")
        )
        if not encoded:
            raise ProviderError("addis", f"no audio in response: {body}")
        return AmharicClip(audio=base64.b64decode(encoded), content_type="audio/wav")

    return AmharicClip(audio=response.content, content_type=content_type or "audio/wav")


async def translate(text: str, *, source: str = "en", target: str = AMHARIC) -> str:
    """English to Amharic, for the explanation half of a correction.

    The REST field names are `source_language` and `target_language`; the `from`/`to`
    pair in Addis's docs belongs to their JavaScript SDK and is rejected here.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/v1/translate",
            headers=_headers(),
            json={"text": text, "source_language": source, "target_language": target},
        )
    if response.status_code != 200:
        raise ProviderError("addis", f"{response.status_code}: {response.text}")

    body = response.json()
    translated = (
        body.get("translation")
        or body.get("translated_text")
        or (body.get("data") or {}).get("translation")
    )
    if translated is None:
        raise ProviderError("addis", f"no translation in response: {body}")
    return translated
