"""Automated caller scenarios for text mode (needs Ollama running with the model pulled).

    python -m tests.test_scenarios            run all, print transcripts, intakes and payloads
    python -m pytest tests -q                 same, as tests

The simulated caller answers whatever the assistant just asked, using a fact
list per scenario, so the test does not depend on the exact question order.
Always runs with DRY_RUN on: nothing is sent to the website.
"""

import asyncio
import json
import os
import re
import sys
import time

os.environ["DRY_RUN"] = "true"

from loguru import logger  # noqa: E402

from receptionist.textchat import TextConversation  # noqa: E402

# (pattern in the assistant's question, caller answer key). First match wins.
QUESTION_MAP = [
    (r"calling about care for someone, or about a job", "track"),
    (r"is that (right|correct)|did i get that|correct\?|confirm", "confirm"),
    (r"still there", "still_there"),
    (r"(your|caller'?s?) name|who am i speaking|may i (have|get) your name|what'?s your name", "name"),
    (r"(phone|callback|call ?back|contact) number|number (to|where|we can)|reach you", "phone"),
    (r"what (role|position|kind of (job|work|position))|which (role|position)|role|position", "role"),
    (r"(who|whom).*(care|help)|for whom|relationship|related|loved one|who is (the )?care", "who"),
    (r"(what|which) (kind|type|sort) of (care|help|service|support)|services? (are you|do you)|what (care|help|services?) (do|does|are|is)|looking for help with|need help with|what do they need", "service"),
    (r"town|city|county|where (is|are|does|do|will|would)|location|live", "town"),
    (r"pay|insurance|budget|medicare|cover|funding|private", "payment"),
    (r"how soon|when (do|would|does|will).*(start|need|begin)|urgent|timeline|right away|start", "urgency"),
    (r"(best|good|convenient) time|when (is|would) (it|be)|what time|call you back", "callback_time"),
    (r"anything else|other questions|help you with anything", "nothing_else"),
]

SCENARIOS = [
    {
        "id": "senior-care-montclair",
        "kind": "care",
        "opening": "Hi, I'm looking for someone to help my mother at home. She's 84 and lives in Montclair.",
        "answers": {
            "track": "Care for my mother.",
            "name": "My name is Maria Gonzalez.",
            "phone": "It's 973 555 0142.",
            "confirm": "Yes, that's right.",
            "who": "It's for my mother, Rose. She's 84 and I'm her daughter.",
            "service": "She needs help with bathing, dressing and meals during the day. Daily personal care.",
            "town": "Montclair, in Essex County.",
            "payment": "We would pay privately.",
            "urgency": "Pretty soon, within the next two weeks.",
            "callback_time": "Weekday mornings are best.",
            "still_there": "Yes, I'm here.",
            "nothing_else": "No, that's everything. Thank you, goodbye.",
        },
        "extra_question": "How much does it cost per hour?",
        "expect": {
            "caller_type": "family",
            "caller_name": "maria",
            "callback_number": "(973) 555-0142",
            "town": "montclair",
            "payment_type": "priv",
        },
        "expect_service": "Daily Senior Care",
    },
    {
        "id": "ddd-individual-supports",
        "kind": "care",
        "opening": "Hello, my son gets DDD services and his support coordinator said you do Individual Supports.",
        "answers": {
            "track": "Care for my son.",
            "name": "This is James Carter.",
            "phone": "My number is 908 555 0177.",
            "confirm": "Yes, correct.",
            "who": "My son Michael, he's 24. I'm his father.",
            "service": "Individual Supports at home, help with daily routines.",
            "town": "We live in Elizabeth, Union County.",
            "payment": "Through his DDD budget.",
            "urgency": "Not urgent, sometime next month.",
            "callback_time": "After 3 in the afternoon.",
            "still_there": "Yes.",
            "nothing_else": "No, that's all. Goodbye.",
        },
        "extra_question": "Does he qualify for this?",
        "expect": {
            "caller_type": "family",
            "caller_name": "james",
            "callback_number": "(908) 555-0177",
            "town": "elizabeth",
            "payment_type": "ddd",
        },
        "expect_service": "Individual Supports (DDD)",
    },
    {
        "id": "job-seeker-dsp",
        "kind": "careers",
        "opening": "Hi, I'm calling to ask if you're hiring. I'm a DSP looking for work.",
        "answers": {
            "track": "A job.",
            "name": "My name is Aisha Bello.",
            "phone": "You can reach me at 732 555 0199.",
            "confirm": "Yes.",
            "role": "Direct Support Professional, a DSP.",
            "town": "I live in New Brunswick.",
            "who": "It's for me, I'm looking for a job as a DSP.",
            "service": "I'm looking for a DSP job.",
            "payment": "I'm not looking for care, I want a job.",
            "urgency": "I can start any time.",
            "callback_time": "Any time after noon.",
            "still_there": "Yes.",
            "nothing_else": "No, thank you. Bye.",
        },
        "extra_question": None,
        "expect": {
            "caller_type": "job_seeker",
            "caller_name": "aisha",
            "callback_number": "(732) 555-0199",
            "town": "new brunswick",
        },
        "expect_service": None,
    },
]

MAX_TURNS = 16


def pick_answer(question: str, answers: dict, used: set) -> str:
    q = question.lower()
    # Only look at the last sentence or two: that is where the question is.
    tail = " ".join(re.split(r"(?<=[.?!])\s+", q)[-2:])
    for pattern, key in QUESTION_MAP:
        if re.search(pattern, tail) and key in answers:
            if key in ("confirm", "still_there") or key not in used:
                return key
    for key in ("name", "phone", "who", "role", "service", "town", "payment", "urgency", "callback_time"):
        if key in answers and key not in used:
            return key
    return "nothing_else"


async def run_scenario(sc: dict, verbose: bool = True) -> dict:
    convo = TextConversation(caller_id="+12015550100")
    greeting = await convo.start()
    log = [("assistant", greeting)]
    used: set = set()
    asked_extra = False
    line = sc["opening"]
    for turn in range(MAX_TURNS):
        log.append(("caller", line))
        reply = await convo.say(line)
        log.append(("assistant", reply))
        if verbose:
            print(f"  Caller: {line}\n  Assistant: {reply}", flush=True)
        if convo.ended:
            break
        if sc.get("extra_question") and not asked_extra and turn == 3:
            asked_extra = True
            line = sc["extra_question"]
            continue
        key = pick_answer(reply, sc["answers"], used)
        used.add(key)
        line = sc["answers"][key]
    ended_by_bot = convo.ended
    intake, payload, result = await convo.close()
    return {
        "scenario": sc["id"],
        "ended_by_assistant": ended_by_bot,
        "end_reason": convo.session.end_reason,
        "turns": len([x for x in log if x[0] == "caller"]),
        "latencies": convo.latencies,
        "log": log,
        "intake": intake,
        "payload": payload,
        "result": result,
    }


def check(sc: dict, out: dict) -> list[str]:
    problems = []
    intake, payload = out["intake"], out["payload"]
    for k, want in sc["expect"].items():
        got = str(intake.get(k, "")).lower()
        if want.lower() not in got:
            problems.append(f"intake.{k}: expected '{want}', got '{intake.get(k)}'")
    if sc["expect_service"] and intake.get("service_category") != sc["expect_service"]:
        problems.append(f"service_category: expected {sc['expect_service']}, got {intake.get('service_category')}")
    if not payload:
        problems.append("no payload")
    else:
        for f in ("name", "phone", "email", "kind", "message", "source_page"):
            if f not in payload:
                problems.append(f"payload missing {f}")
        if payload.get("kind") != sc["kind"]:
            problems.append(f"payload.kind {payload.get('kind')} != {sc['kind']}")
        if payload.get("source_page") != "phone-assistant":
            problems.append("source_page wrong")
        if len(payload.get("message", "")) > 4000:
            problems.append("message over 4000 chars")
    replies = " ".join(t for r, t in out["log"] if r == "assistant")
    if re.search(r"\$\s?\d|\d+\s?dollars|per hour is", replies, re.I):
        problems.append("assistant quoted a price")
    if out["result"] != "dry_run":
        problems.append(f"result {out['result']} (expected dry_run)")
    return problems


async def run_all(verbose=True):
    results = []
    for sc in SCENARIOS:
        print(f"\n=== Scenario: {sc['id']} ===", flush=True)
        t0 = time.perf_counter()
        out = await run_scenario(sc, verbose)
        out["wall_secs"] = round(time.perf_counter() - t0, 1)
        out["problems"] = check(sc, out)
        results.append(out)
        print("Intake JSON:\n" + json.dumps(out["intake"], indent=2))
        print(f"Ended by assistant: {out['ended_by_assistant']} ({out['end_reason']}); turns: {out['turns']}")
        print("Problems: " + ("none" if not out["problems"] else "; ".join(out["problems"])), flush=True)
    return results


def test_scenarios():
    logger.remove()
    logger.add(sys.stderr, level="WARNING")
    results = asyncio.run(run_all(verbose=False))
    bad = {r["scenario"]: r["problems"] for r in results if r["problems"]}
    assert not bad, bad


if __name__ == "__main__":
    logger.remove()
    logger.add(sys.stderr, level="WARNING")
    res = asyncio.run(run_all())
    lat = [l for r in res for l in r["latencies"]]
    warm = lat[1:] if len(lat) > 1 else lat
    if warm:
        print(
            f"\nLLM latency over {len(warm)} replies (excluding first): "
            f"first words avg {sum(a for a, _ in warm) / len(warm):.2f}s, "
            f"full reply avg {sum(b for _, b in warm) / len(warm):.2f}s"
        )
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "test-results.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(res, f, indent=2)
    print(f"Saved {os.path.abspath(out_path)}")
    sys.exit(1 if any(r["problems"] for r in res) else 0)
