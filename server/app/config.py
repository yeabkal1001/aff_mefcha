from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://coach:coach@localhost:5432/english_coach"
    port: int = 4000
    client_origin: str = "http://localhost:3000"

    # Model providers, split by language rather than by vendor. All server-side: none
    # of these may reach the browser. Empty by default so the app boots without them —
    # a provider call fails loudly at the point of use rather than the server refusing
    # to start.
    #
    # Amharic only. Translation, and the Amharic audio for the correction line. Addis
    # STT and TTS both cover am/om exclusively, so no English passes through this key.
    addis_api_key: str = ""
    # The analysing model and the English coach voice, both from Google AI Studio:
    # conversation direction, the grammar and vocabulary judgements the authored error
    # tags cannot reach alone, and English TTS.
    gemini_api_key: str = ""
    # Flash rather than Pro on purpose. The model counts opportunities against an
    # authored rubric; it is not being asked to be clever, and a turn is graded while
    # the learner waits.
    #
    # Pinned rather than `gemini-flash-latest`, because judging has to be reproducible
    # and a floating alias changes the grader underneath the learner model. Google
    # retires versions for new keys without removing them from models.list, so verify
    # a replacement with scripts/probe_models.py before changing this.
    gemini_model: str = "gemini-3.5-flash"
    gemini_tts_model: str = "gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Kore"
    # English speech to text, with word timestamps.
    #
    # This one is load-bearing in a way the others are not. Every delivery metric —
    # words per minute, pause count and length, filler rate, mean sentence length — is
    # measured from word start and end times, so a transcriber that returns only a
    # string cannot feed Confidence or Fluency. See engine/metrics.py.
    #
    # Prefer ElevenLabs Scribe (`elevenlabs`) when ELEVENLABS_API_KEY is set —
    # synchronous, word-level timestamps, reliable. whisper-api.com is kept as a
    # secondary path; Gemini is the last-resort fallback when both fail.
    elevenlabs_api_key: str = ""
    elevenlabs_stt_model: str = "scribe_v2"
    # Rachel — a clear English coach voice from ElevenLabs' default catalogue.
    elevenlabs_tts_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_tts_model: str = "eleven_multilingual_v2"

    english_stt_api_key: str = ""
    english_stt_provider: str = "elevenlabs"
    # Free-tier whisper-api.com models are tiny/small/medium. Only used when
    # ENGLISH_STT_PROVIDER=whisper-api.
    english_stt_model_size: str = "tiny"

    # Stimulus sourcing only — not models. Used to find and fetch images and scenarios
    # for the Stimulus Pool.
    exa_api_key: str = ""
    firecrawl_api_key: str = ""

    demo_mode: bool = False
    demo_clock_offset_hours: float = 0.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
