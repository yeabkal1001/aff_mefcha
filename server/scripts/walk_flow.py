"""Walk a learner through the whole product, over HTTP, and print what happened.

Onboard, read the profile, build a day plan, speak a turn, get judged, retry, finalise,
reflect. Every call goes through the real API against the real database with the real
providers, so a green run here means the demo path works — not that the units pass.

The server must already be running.

    .venv/Scripts/python.exe -m scripts.walk_flow
"""

import asyncio
import sys
import uuid

import httpx

BASE_URL = "http://127.0.0.1:4000"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Hana's turn from the demo script. The verbatim track keeps "I am study", which is
# the error the whole story turns on; a cleaned transcript would delete it.
VERBATIM = (
    "Um... yes. I am study software engineering at Addis Ababa University. "
    "I am in third year. Uh... my favourite subject is database."
)
CLEAN = (
    "Yes. I am studying software engineering at Addis Ababa University. "
    "I am in third year. My favourite subject is databases."
)

def _timed_words(text: str) -> list[dict]:
    """Timings shaped like a hesitant A2 speaker.

    A long think before the first word, then a real pause partway through. Those two
    gaps are the whole point: `first_word_latency_seconds` and `pause_count` have
    nothing to read without them, and Confidence is measured from both.
    """
    words: list[dict] = []
    clock = 1.8  # the silence before Hana starts
    for index, word in enumerate(text.replace("...", "").split()):
        if index == 8:
            clock += 1.4  # mid-sentence hesitation
        words.append({"text": word, "start": round(clock, 2), "end": round(clock + 0.34, 2)})
        clock += 0.42
    return words


WORDS = _timed_words(VERBATIM)


def head(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m")


def line(label: str, value: object) -> None:
    print(f"  {label:.<32} {value}")


async def main() -> int:  # noqa: C901 - a walkthrough is a sequence, not a branch tree
    learner_id = f"walk-{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=180.0) as api:
        head("Health")
        health = (await api.get("/health")).json()
        line("engine time", health["engine_time"])
        line("demo mode", health["demo_mode"])

        head("Onboarding")
        response = await api.post(
            "/learners",
            json={
                "learner_id": learner_id,
                "display_name": "Hana",
                "life_path_id": "university_success",
                "l1": "am",
                "study_field": "software engineering",
                "daily_minutes": 15,
                "feedback_language": "am",
                "assessment_transcripts": [VERBATIM],
                "assessment_error_count": 3,
            },
        )
        if response.status_code != 200:
            print(f"  FAILED {response.status_code}: {response.text}")
            return 1
        onboarded = response.json()
        line("learner", onboarded["learner_id"])
        line("CEFR (measured)", onboarded["cefr"])
        line("competencies seeded", onboarded["seeded_competencies"])
        if onboarded.get("placement"):
            p = onboarded["placement"]
            line("placement composite", f"{p['composite']:.2f} -> {p['band']}")

        head("Communication Profile")
        profile = (await api.get(f"/learners/{learner_id}/profile")).json()
        for dimension in profile["dimensions"]:
            value = dimension["value"]
            shown = "not yet assessed" if value is None else f"{value * 100:.0f}%"
            band = " (wide)" if dimension["wide_uncertainty"] else ""
            line(dimension["name"], f"{shown}{band}")

        head("Today's Mission")
        plan = (await api.get(f"/learners/{learner_id}/day-plan")).json()
        line("theme", plan["theme"])
        line("domain", plan["domain_id"])
        for session in plan["sessions"]:
            targets = ", ".join(t["competency_id"] for t in session["targets"])
            print(f"    {session['position']}. {session['template_name']}  [{targets}]")

        session = plan["sessions"][0]
        head(f"Session 1 — {session['template_name']}")
        line("prompt", session["prompt"][:70])
        line("stimulus", session["stimulus_type"] or "none")

        head("Turn — graded by the authored patterns and the model")
        turn = (
            await api.post(
                f"/sessions/{session['id']}/turns",
                json={
                    "transcript_verbatim": VERBATIM,
                    "transcript_clean": CLEAN,
                    "words": WORDS,
                    "scaffold_level": 0,
                },
            )
        ).json()
        metrics = turn["metrics"]
        line("words per minute", f"{metrics.get('words_per_minute', 0):.0f}")
        line("pauses", f"{metrics.get('pause_count')} over {metrics.get('pause_seconds', 0):.1f}s")
        line("fillers per 100 words", f"{metrics.get('filler_rate_per_100', 0):.1f}")
        line("mean sentence length", f"{metrics.get('mean_sentence_length', 0):.1f}")
        line("first-word latency", f"{metrics.get('first_word_latency_seconds', 0):.1f}s")
        for judgement in turn["judgements"]:
            observed = judgement["observed"]
            shown = "no evidence" if observed is None else f"{observed:.2f}"
            tags = f" tags={judgement['error_tags']}" if judgement["error_tags"] else ""
            line(
                f"{judgement['competency_id']} ({judgement['source']})",
                f"{judgement['correct']}/{judgement['opportunities']} = {shown}{tags}",
            )
        line("retry needed for", turn["retry_needed"] or "nothing")
        if turn["scaffold_prompt"]:
            line("scaffold", turn["scaffold_prompt"][:60])

        head("The Amharic correction")
        correction = (
            await api.post(
                "/audio/correction",
                json={"wrong": "I am study", "right": "I am studying"},
            )
        ).json()
        line("English", correction["english"])
        line("Amharic", correction["amharic"])

        head("The coach's next line")
        coach = (
            await api.post(
                f"/sessions/{session['id']}/coach-line", json={"text": CLEAN}
            )
        ).json()
        line("says", coach["english"][:70])

        head("Finalise — the learner model moves")
        outcome = (await api.post(f"/sessions/{session['id']}/finalise", json={})).json()
        for update in outcome["updates"]:
            line(
                update["competency_id"],
                f"{update['mastery_before']:.2f} -> {update['mastery_after']:.2f}"
                f"  (evidence {update['evidence_count_after']})",
            )
        head("Profile after")
        for dimension in outcome["dimensions"]:
            value = dimension["value"]
            shown = "not yet assessed" if value is None else f"{value * 100:.0f}%"
            line(dimension["name"], shown)

        head("Reflection")
        reflection = (
            await api.post(
                f"/sessions/{session['id']}/reflection",
                json={"learner_text": "I forgot the -ing on studying."},
            )
        ).json()
        line("matched error tag", reflection["matched_error_tag"] or "none")
        line("confidence raised for", reflection["confidence_raised_for"] or "nothing")

    print("\n\033[1mWalkthrough complete.\033[0m\n")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
