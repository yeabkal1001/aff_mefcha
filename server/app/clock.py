"""The one clock the engine reads.

Day Three is produced by advancing time and running the real scheduler, so every
retrievability calculation has to go through here rather than calling
`datetime.now()` directly. The offset comes from configuration so a judge can ask
for four days instead of three and still get a real answer.
"""

from datetime import UTC, datetime, timedelta

from app.config import get_settings


def now() -> datetime:
    offset = get_settings().demo_clock_offset_hours
    return datetime.now(UTC) + timedelta(hours=offset)
