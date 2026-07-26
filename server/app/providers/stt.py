"""English speech to text, with word timestamps.

Order of preference:

1. **ElevenLabs Scribe** — synchronous, native word timestamps, the path the product
   was designed around.
2. **whisper-api.com** — kept as a secondary when ElevenLabs is unset or errors.
3. **Gemini audio** — last resort so a turn still grades when both STTs are down.
   Timings are estimates.

Every delivery metric is measured from word start/end times — see `engine/metrics.py`.
"""

import asyncio
import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.providers import elevenlabs, gemini
from app.providers.errors import ProviderError, ProviderNotConfigured

BASE_URL = "https://api.whisper-api.com"
logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 1.0
POLL_TIMEOUT_SECONDS = 120.0
_FREE_MODELS = ("tiny", "small", "medium")


@dataclass(frozen=True)
class Transcription:
    text: str
    words: list[dict]
    language: str | None = None
    source: str = "whisper-api"


def _whisper_key() -> str:
    key = get_settings().english_stt_api_key
    if not key:
        raise ProviderNotConfigured("whisper-api", "ENGLISH_STT_API_KEY")
    return key


def _whisper_headers() -> dict[str, str]:
    return {"X-API-Key": _whisper_key()}


async def verify_key() -> dict:
    """Health for whichever STT is preferred."""
    settings = get_settings()
    if settings.elevenlabs_api_key:
        # Scribe has no cheap /me; a configured key is the health signal.
        return {"provider": "elevenlabs", "configured": True}
    if settings.english_stt_api_key:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{BASE_URL}/me", headers=_whisper_headers()
            )
        if response.status_code != 200:
            raise ProviderError("whisper-api", f"{response.status_code}: {response.text}")
        body = response.json()
        body["provider"] = "whisper-api"
        return body
    raise ProviderNotConfigured("stt", "ELEVENLABS_API_KEY or ENGLISH_STT_API_KEY")


async def transcribe(
    *,
    audio: bytes | None = None,
    filename: str = "turn.webm",
    audio_url: str | None = None,
    language: str = "en",
) -> Transcription:
    """Transcribe one turn, verbatim, with per-word timing."""
    if audio is None and not audio_url:
        raise ProviderError("stt", "no audio: pass either bytes or a URL")

    settings = get_settings()
    errors: list[str] = []

    # 1. ElevenLabs — needs the bytes; URL-only uploads are not supported here.
    if settings.elevenlabs_api_key and audio is not None:
        try:
            result = await elevenlabs.transcribe(
                audio=audio, filename=filename, language=language
            )
            return Transcription(
                text=result.text,
                words=result.words,
                language=result.language,
                source=result.source,
            )
        except ProviderError as exc:
            errors.append(str(exc))
            logger.warning("elevenlabs STT failed: %s", exc)

    # 2. whisper-api (optional secondary)
    if settings.english_stt_api_key and (
        settings.english_stt_provider == "whisper-api"
        or not settings.elevenlabs_api_key
        or errors
    ):
        model = settings.english_stt_model_size
        if model not in _FREE_MODELS:
            model = "tiny"
        try:
            return await _whisper_once(
                audio=audio,
                filename=filename,
                audio_url=audio_url,
                language=language,
                model_size=model,
            )
        except ProviderError as exc:
            errors.append(str(exc))
            logger.warning("whisper-api STT failed: %s", exc)

    # 3. Gemini last resort
    if audio is not None:
        logger.warning("falling back to Gemini STT; prior errors: %s", errors)
        fallback = await gemini.transcribe_audio(
            audio, filename=filename, language=language
        )
        return Transcription(
            text=fallback.text,
            words=fallback.words,
            language=fallback.language,
            source=fallback.source,
        )

    raise ProviderError("stt", "; ".join(errors) or "no STT provider configured")


async def _whisper_once(
    *,
    audio: bytes | None,
    filename: str,
    audio_url: str | None,
    language: str,
    model_size: str,
) -> Transcription:
    data = {
        "format": "json",
        "word_timestamps": "true",
        "language": language,
        "model_size": model_size,
    }
    files = None
    if audio is not None:
        content_type = (
            "audio/webm" if filename.endswith(".webm") else "application/octet-stream"
        )
        files = {"file": (filename, audio, content_type)}
    else:
        data["url"] = audio_url  # type: ignore[assignment]

    async with httpx.AsyncClient(timeout=60.0) as client:
        submitted = await client.post(
            f"{BASE_URL}/transcribe",
            headers=_whisper_headers(),
            data=data,
            files=files,
        )
        if submitted.status_code not in (200, 201, 202):
            raise ProviderError(
                "whisper-api", f"{submitted.status_code}: {submitted.text}"
            )

        body = submitted.json()
        if body.get("result") or body.get("segments") or body.get("words"):
            return _parse(body)

        task_id = body.get("task_id") or body.get("id")
        if not task_id:
            raise ProviderError("whisper-api", f"no task_id in response: {body}")

        return await _await_result(client, task_id)


async def _await_result(client: httpx.AsyncClient, task_id: str) -> Transcription:
    waited = 0.0
    while waited < POLL_TIMEOUT_SECONDS:
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        waited += POLL_INTERVAL_SECONDS

        status = await client.get(
            f"{BASE_URL}/status/{task_id}", headers=_whisper_headers()
        )
        if status.status_code != 200:
            raise ProviderError("whisper-api", f"{status.status_code}: {status.text}")

        body = status.json()
        if body.get("status") in ("failed", "error"):
            raise ProviderError("whisper-api", f"transcription failed: {body}")
        if body.get("result") is not None:
            return _parse(body)

    raise ProviderError(
        "whisper-api", f"transcription still running after {POLL_TIMEOUT_SECONDS:.0f}s"
    )


def _parse(body: dict) -> Transcription:
    result = body.get("result")
    if isinstance(result, str):
        return Transcription(text=result, words=[])
    payload = result if isinstance(result, dict) else body

    words: list[dict] = []
    for entry in payload.get("words") or []:
        normalised = _word(entry)
        if normalised:
            words.append(normalised)

    if not words:
        for segment in payload.get("segments") or []:
            for entry in segment.get("words") or []:
                normalised = _word(entry)
                if normalised:
                    words.append(normalised)

    text = payload.get("text") or " ".join(w["text"] for w in words)
    return Transcription(
        text=text.strip(), words=words, language=payload.get("language")
    )


def _word(entry: dict) -> dict | None:
    text = entry.get("text") or entry.get("word")
    start, end = entry.get("start"), entry.get("end")
    if text is None or start is None or end is None:
        return None
    return {"text": str(text).strip(), "start": float(start), "end": float(end)}
