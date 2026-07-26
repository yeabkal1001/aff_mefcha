"""Outbound calls to model providers.

One module per provider, split by the job it does rather than by vendor:

    stt.py      English speech to text, with the word timestamps every metric needs
    gemini.py   the analysing model, and the English coach voice
    addis.py    Amharic translation, and the Amharic audio for the correction line

Every module in here follows the same two rules. A missing key raises
`ProviderNotConfigured` at the point of use rather than at import, so the server still
boots without a full set of keys and the failure names the thing that is missing. And
nothing here touches the database — a provider returns data, and the caller decides
what it means.
"""

from app.providers import addis, elevenlabs, gemini, stt
from app.providers.errors import ProviderError, ProviderNotConfigured

__all__ = [
    "ProviderError",
    "ProviderNotConfigured",
    "addis",
    "elevenlabs",
    "gemini",
    "stt",
]
