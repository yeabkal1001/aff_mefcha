"""The microphone-in, speaker-out edge of the product.

Every provider key lives on the server, so the browser cannot call Whisper, Gemini or
Addis directly. These routes are the only way audio crosses that line: the client posts
a recording and gets back words with timings, or posts a line of text and gets back
something it can play.

Keeping transcription here rather than in the client also keeps one promise honest —
the delivery metrics are computed from the same word timestamps the client is shown,
because there is only one transcript and the server made it.
"""

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import DayPlan, LearnerProfile, Session
from app.config import get_settings
from app.providers import ProviderError, ProviderNotConfigured, addis, elevenlabs, gemini, stt
from app.schemas import (
    CoachLineRequest,
    CoachLineResponse,
    CorrectionAudioRequest,
    TranscriptionResponse,
)

router = APIRouter(tags=["audio"])
logger = logging.getLogger(__name__)


def _http_error(exc: ProviderError) -> HTTPException:
    """Turn a provider failure into a status the client can act on.

    A missing key is 503 rather than 500: nothing is broken, something is unconfigured,
    and the detail names the environment variable so the fix does not need a log dive.
    """
    status = 503 if isinstance(exc, ProviderNotConfigured) else 502
    return HTTPException(status_code=status, detail=str(exc))


@router.post("/audio/transcribe", response_model=TranscriptionResponse)
async def post_transcribe(
    audio: UploadFile = File(...), language: str = Form("en")
) -> TranscriptionResponse:
    """A recording in, a verbatim transcript with word timings out.

    The `words` list goes straight back into `POST /sessions/{id}/turns`, which is what
    lets the server measure pace, pauses and fillers rather than take the client's word
    for them.
    """
    payload = await audio.read()
    if not payload:
        raise HTTPException(status_code=400, detail="empty audio upload")

    try:
        result = await stt.transcribe(
            audio=payload,
            filename=audio.filename or "turn.webm",
            language=language,
        )
    except ProviderError as exc:
        raise _http_error(exc) from exc

    return TranscriptionResponse(
        text=result.text, words=result.words, language=result.language
    )


@router.post("/audio/speak")
async def post_speak(body: CoachLineRequest) -> Response:
    """The coach's voice.

    English goes to Gemini and Amharic to Addis, because Addis covers am/om only and
    Gemini's Amharic is not a voice you would put in front of this audience.
    """
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="nothing to speak")

    try:
        if body.language in (addis.AMHARIC, addis.AFAN_OROMO):
            clip = await addis.speak(body.text, language=body.language)
            return Response(content=clip.audio, media_type=clip.content_type)

        # Prefer ElevenLabs for English when configured; Gemini TTS is the fallback.
        if get_settings().elevenlabs_api_key:
            try:
                audio = await elevenlabs.speak(body.text)
                return Response(content=audio, media_type="audio/mpeg")
            except ProviderError:
                pass
        audio = await gemini.speak(body.text)
    except ProviderError as exc:
        raise _http_error(exc) from exc

    return Response(content=audio, media_type="audio/wav")


@router.post("/audio/correction", response_model=CoachLineResponse)
async def post_correction(body: CorrectionAudioRequest) -> CoachLineResponse:
    """The correction line, in Amharic.

    The beat the demo is built around: the learner hears why the sentence was wrong in
    the language they think in. The model English sentence is returned separately and
    unquoted so the client can have the *English* voice read it — English words inside
    an Amharic TTS request come out mispronounced.
    """
    if not body.right.strip():
        raise HTTPException(status_code=400, detail="no corrected sentence")

    english = (
        f"You said '{body.wrong}'. The correct way is '{body.right}'."
        if body.wrong
        else f"Try saying it this way: '{body.right}'."
    )

    try:
        amharic = await addis.translate(english, source="en", target=addis.AMHARIC)
    except ProviderError as exc:
        raise _http_error(exc) from exc

    return CoachLineResponse(english=english, amharic=amharic, model_sentence=body.right)


@router.post("/sessions/{session_id}/coach-line", response_model=CoachLineResponse)
async def post_coach_line(
    session_id: str, body: CoachLineRequest, db: AsyncSession = Depends(get_db)
) -> CoachLineResponse:
    """What the coach says next, given the activity and what the learner just said.

    The learner's name and field go into the prompt because a coach that says "tell me
    more about your database course" and one that says "tell me more" are different
    products, and only one of them sounds like it was listening.
    """
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"no session {session_id!r}")

    day_plan = await db.get(DayPlan, session.day_plan_id)
    learner = await db.get(LearnerProfile, day_plan.learner_id) if day_plan else None

    try:
        line = await gemini.direct(
            prompt=session.prompt,
            learner_said=body.text or None,
            learner_name=learner.display_name if learner else None,
            study_field=learner.study_field if learner else None,
        )
    except ProviderError as exc:
        raise _http_error(exc) from exc

    return CoachLineResponse(english=line)


@router.get("/audio/health")
async def get_audio_health() -> dict:
    """Are the keys live, and is there credit left?

    Worth hitting before a demo. Only the transcription provider exposes a balance,
    and it is the one with a hard credit limit, so it is the one worth watching.
    """
    try:
        return {"stt": await stt.verify_key()}
    except ProviderError as exc:
        raise _http_error(exc) from exc
