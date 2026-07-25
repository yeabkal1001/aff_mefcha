from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://coach:coach@localhost:5432/english_coach"
    port: int = 4000
    client_origin: str = "http://localhost:3000"

    # Four model providers, one job each. All server-side: none of these may reach the
    # browser. Empty by default so the app boots without them — a provider call fails
    # loudly at the point of use rather than the server refusing to start.
    #
    # Amharic. Translation and Amharic TTS for the correction line.
    addis_api_key: str = ""
    # Speech to text and English text to speech. Scribe v2 with
    # timestamps_granularity="word" is what every delivery metric is measured from.
    elevenlabs_api_key: str = ""
    # The analysing model: conversation direction, and the opportunity counts the
    # authored error tags cannot reach on their own. Google AI Studio.
    gemini_api_key: str = ""

    # Stimulus sourcing only — not models. Used to find and fetch images and scenarios
    # for the Stimulus Pool.
    exa_api_key: str = ""
    firecrawl_api_key: str = ""

    demo_mode: bool = False
    demo_clock_offset_hours: float = 0.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
