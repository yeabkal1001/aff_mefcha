"""Ask every provider whether it is actually reachable with the configured keys.

Run before a demo. A key that has expired, run out of credit, or was pasted with a
missing character fails here in a few seconds rather than mid-session on stage.

    .venv/Scripts/python.exe -m scripts.check_providers
"""

import asyncio
import sys

from app.providers import ProviderError, addis, gemini, stt
from app.providers.gemini import CompetencyBrief

# A Windows console defaults to cp1252, which cannot encode Ge'ez. Printing the
# Amharic result would then raise instead of reporting the success it just had.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# The error the whole demo turns on, so the judging check exercises a real rubric row
# rather than a toy one.
_SAMPLE = "Yes um I am study software engineering at Addis Ababa University."
_BRIEF = CompetencyBrief(
    competency_id="G006.01",
    name="Present continuous for current activities",
    description="Using 'am/is/are + verb-ing' for something happening now or ongoing.",
    common_errors={"missing_ing": "I am study instead of I am studying"},
)


async def check(name: str, coro) -> bool:
    print(f"  {name:.<44}", end="", flush=True)
    try:
        detail = await coro
    except ProviderError as exc:
        print(f" FAIL\n      {exc}")
        return False
    except Exception as exc:  # noqa: BLE001 - a check script reports, it does not raise
        print(f" ERROR\n      {type(exc).__name__}: {exc}")
        return False
    print(f" ok    {detail}")
    return True


async def whisper_key() -> str:
    body = await stt.verify_key()
    return f"credits={body.get('credits')} used_today={body.get('daily_usage')}"


async def gemini_judge() -> str:
    judgements = await gemini.judge(_SAMPLE, [_BRIEF])
    judgement = judgements.get("G006.01")
    if judgement is None:
        return "no judgement returned"
    return (
        f"G006.01 {judgement.correct}/{judgement.opportunities} "
        f"tags={judgement.error_tags}"
    )


async def gemini_direct() -> str:
    line = await gemini.direct(
        prompt="Look at this photo and tell me everything you can see.",
        learner_said=_SAMPLE,
        learner_name="Hana",
        study_field="software engineering",
    )
    return f'"{line[:60]}..."' if len(line) > 60 else f'"{line}"'


async def gemini_voice() -> str:
    audio = await gemini.speak("Nice. Tell me more about your classes.")
    return f"{len(audio):,} bytes of WAV"


async def addis_voice() -> str:
    clip = await addis.speak("'I am studying' ማለት ይገባል።")
    return f"{len(clip.audio):,} bytes of {clip.content_type}"


async def addis_translate() -> str:
    text = await addis.translate("You should say 'I am studying', not 'I am study'.")
    return text[:60]


async def main() -> int:
    print("\nwhisper-api.com — English speech to text")
    results = [await check("api key and credits", whisper_key())]

    print("\nGemini — the analysing model and the English voice")
    results.append(await check("judge a transcript", gemini_judge()))
    results.append(await check("direct the conversation", gemini_direct()))
    results.append(await check("speak English", gemini_voice()))

    print("\nAddis AI — Amharic")
    results.append(await check("speak Amharic", addis_voice()))
    results.append(await check("translate to Amharic", addis_translate()))

    passed = sum(results)
    print(f"\n{passed}/{len(results)} checks passed\n")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
