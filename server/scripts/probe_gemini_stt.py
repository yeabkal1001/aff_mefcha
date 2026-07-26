"""Smoke-test the Gemini audio fallback with a short silent WAV."""

import asyncio
import io
import sys
import wave

from app.providers import gemini

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


async def main() -> int:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(b"\x00\x00" * 8000)
    try:
        result = await gemini.transcribe_audio(
            buf.getvalue(), filename="probe.wav", language="en"
        )
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL {type(exc).__name__}: {exc}")
        return 1
    print(f"ok text={result.text!r} words={len(result.words)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
