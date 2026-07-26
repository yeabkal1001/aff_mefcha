"""Which Gemini text models this key can actually call.

Google retires models for new keys without removing them from `models.list`, so the
catalogue is not the answer — only a real request is. Run this when a 404 says a model
"is no longer available to new users".

    .venv/Scripts/python.exe -m scripts.probe_models
"""

import asyncio
import sys

import httpx

from app.config import get_settings

CANDIDATES = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]


async def probe(client: httpx.AsyncClient, model: str, key: str) -> str:
    try:
        response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": key},
            json={
                "contents": [{"role": "user", "parts": [{"text": "Reply with: OK"}]}],
                "generationConfig": {"temperature": 0, "maxOutputTokens": 2048},
            },
        )
    except httpx.HTTPError as exc:
        return f"unreachable ({type(exc).__name__})"

    if response.status_code == 200:
        return "ok"
    try:
        return f"{response.status_code} {response.json()['error']['message'][:90]}"
    except Exception:  # noqa: BLE001
        return f"{response.status_code} {response.text[:90]}"


async def main() -> int:
    key = get_settings().gemini_api_key
    if not key:
        print("GEMINI_API_KEY is not set")
        return 1

    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in CANDIDATES:
            print(f"  {model:.<34} {await probe(client, model, key)}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
