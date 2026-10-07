"""End-of-call intake extraction and hand-off to the website's /api/inquiry.

The small local model is asked once, after the call, to fill a fixed JSON
schema from the transcript (Ollama structured output). That is more reliable
with a 3B model than asking it to call a many-field tool mid-conversation.
"""

import asyncio
import json
import re
import time

import httpx
from loguru import logger

from .session import CallSession
from .settings import settings

INTAKE_SCHEMA = {
    "type": "object",
    "properties": {
        "caller_type": {"type": "string", "enum": ["family", "job_seeker", "other"]},
        "caller_name": {"type": "string"},
        "callback_number": {"type": "string"},
        "care_recipient": {"type": "string"},
        "relationship": {"type": "string"},
        "service_needed": {"type": "string"},
        "town": {"type": "string"},
        "county": {"type": "string"},
        "payment_type": {"type": "string"},
        "urgency": {"type": "string"},
        "best_callback_time": {"type": "string"},
        "job_role": {"type": "string"},
        "questions_or_notes": {"type": "string"},
    },
    "required": [
        "caller_type", "caller_name", "callback_number", "care_recipient", "relationship",
        "service_needed", "town", "county", "payment_type", "urgency",
        "best_callback_time", "job_role", "questions_or_notes",
    ],
}

EXTRACT_PROMPT = """You fill in a phone message form from a call transcript between a CALLER and \
the Tinash Homecare Services virtual ASSISTANT.

Strict rules:
- Use only facts the CALLER stated or clearly confirmed (saying "yes" to the assistant reading \
something back counts as confirming it).
- Never take a detail that only the ASSISTANT said and the caller did not confirm.
- If something was not said, use an empty string "". Never guess or fill in examples.

Fields:
- caller_type: "family" if they ask about care for someone (including themselves), \
"job_seeker" if they want a job, otherwise "other".
- caller_name: the caller's own name.
- callback_number: the callback phone number digits the caller gave (the corrected version if they corrected it).
- care_recipient: the person who needs care, with their name and age if the caller gave them. \
This is never the caller's own name unless the care is for the caller.
- relationship: how the person needing care is related to the caller, in one or two words, \
e.g. "mother", "father", "son", "wife", "self".
- service_needed: the help asked for, in a few words, e.g. "personal care", "companion care", \
"skilled nursing", "live-in / 24-7 care", "respite", "Individual Supports (DDD)", \
"Community-Based Supports (DDD)", "DDD respite", "GUIDE dementia program". Empty if not said.
- town: town or city (for job seekers, where they live).
- county: New Jersey county if the caller said it.
- payment_type: e.g. "private pay", "long-term care insurance", "NJ DDD budget", "Medicare".
- urgency: how soon, in the caller's words.
- best_callback_time: when to call back, in the caller's words.
- job_role: job seekers only: caregiver, DSP or nurse.
- questions_or_notes: one short sentence with anything else useful (questions the assistant \
could not answer, special needs). Empty if nothing.

Transcript:
"""

# Values the website's /api/inquiry accepts for `service` (src/lib/care-services.ts).
_SERVICE_RULES = [
    (r"guide|dementia|alzheimer|memory", "GUIDE Program"),
    (r"individual support", "Individual Supports (DDD)"),
    (r"community.?based", "Community-Based Supports (DDD)"),
    (r"ddd.*respite|respite.*ddd", "DDD Respite"),
    (r"\bddd\b|developmental|intellectual", "DDD Services"),
    (r"nurs|wound|medication admin", "Skilled Nursing"),
    (r"live.?in|24/7|24-7|round.the.clock|overnight|twenty.four", "Live-In & 24/7 Care"),
    (r"respite|break", "Respite Care"),
    (r"companion", "Companion Care"),
    (r"senior|personal care|daily|bath|dress|elder", "Daily Senior Care"),
]


def map_service(text: str) -> str:
    t = (text or "").lower()
    for pattern, value in _SERVICE_RULES:
        if re.search(pattern, t):
            return value
    return "Not sure yet"


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    return (raw or "").strip()


def _native_ollama_url() -> str:
    base = settings.ollama_base_url.rstrip("/")
    if base.endswith("/v1"):
        base = base[:-3]
    return base


async def extract_intake(session: CallSession) -> dict:
    transcript = session.transcript_text()
    cl = session.checklist
    if cl is not None and cl.values:
        transcript += "\n\nThe caller's answers, by topic (raw speech-to-text):\n" + "\n".join(
            f"- {k}: {v}" for k, v in cl.values.items() if k != "phone"
        )
    empty = {k: "" for k in INTAKE_SCHEMA["properties"]}
    empty["caller_type"] = "other"
    if not any(m["role"] == "user" for m in session.transcript):
        return empty
    body = {
        "model": settings.llm_model,
        "messages": [{"role": "user", "content": EXTRACT_PROMPT + transcript}],
        "format": INTAKE_SCHEMA,
        "stream": False,
        "options": {"temperature": 0},
    }
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(f"{_native_ollama_url()}/api/chat", json=body)
            r.raise_for_status()
            data = json.loads(r.json()["message"]["content"])
    except Exception as e:  # never lose the call: fall back to an empty form
        logger.error(f"Intake extraction failed: {e}")
        data = {}
    logger.info(f"Intake extraction took {time.perf_counter() - t0:.1f}s")
    return finalize_intake(session, data)


def finalize_intake(session: CallSession, data: dict) -> dict:
    """Clean up the model's form and fill gaps from what was captured during the call."""
    cl = session.checklist
    empty = {k: "" for k in INTAKE_SCHEMA["properties"]}
    empty["caller_type"] = "other"
    intake = {**empty, **{k: (v if isinstance(v, str) else str(v)) for k, v in data.items() if k in empty}}
    if intake["caller_type"] not in ("family", "job_seeker", "other"):
        intake["caller_type"] = "other"
    rec = getattr(session.claude, "intake", None) or {}
    if rec:
        # Claude's record_intake calls during the call fill any gaps.
        for k in ("caller_type", "caller_name", "callback_number", "care_recipient", "relationship",
                  "service_needed", "town", "county", "payment_type", "urgency", "best_callback_time", "job_role"):
            if not intake.get(k) or (k == "caller_type" and intake[k] == "other"):
                v = rec.get(k)
                if isinstance(v, str) and v.strip():
                    intake[k] = v.strip()
        if not intake.get("questions_or_notes") and isinstance(rec.get("notes"), str):
            intake["questions_or_notes"] = rec["notes"]
        intake["phone_confirmed_by_caller"] = bool(rec.get("phone_confirmed"))
        if rec.get("emergency"):
            session.emergency_flagged = True
    if cl is not None and cl.values:
        # Deterministic values from the call beat the model's reading of it.
        if cl.phone_digits:
            intake["callback_number"] = cl.phone_digits
        if cl.track == "job":
            intake["caller_type"] = "job_seeker"
        elif cl.track == "family" and intake["caller_type"] == "other":
            intake["caller_type"] = "family"
        fallback = {"caller_name": "name", "town": "town", "payment_type": "payment", "urgency": "urgency",
                    "best_callback_time": "callback_time", "job_role": "role", "service_needed": "service",
                    "care_recipient": "who"}
        for field_name, slot in fallback.items():
            if not intake.get(field_name) and cl.values.get(slot):
                intake[field_name] = cl.values[slot][:120]
        # Guard against the model copying the phone number into other fields.
        for field_name, slot in fallback.items():
            if field_name != "caller_name" and len(re.sub(r"\D", "", intake.get(field_name, ""))) >= 7:
                intake[field_name] = cl.values.get(slot, "")[:120]
        # The caller's own words are the safest record of when to call back.
        if cl.values.get("callback_time") and cl.values["callback_time"] != "(not captured)":
            intake["best_callback_time"] = cl.values["callback_time"][:120]
        intake["phone_confirmed_by_caller"] = cl.phone_state == "confirmed"
        intake["phone_from_caller_id"] = cl.phone_from_caller_id
    intake["callback_number"] = normalize_phone(intake["callback_number"])
    intake["caller_id"] = normalize_phone(session.caller_id)
    intake["service_category"] = map_service(intake["service_needed"]) if intake["caller_type"] == "family" else ""
    intake["emergency_flagged"] = session.emergency_flagged
    return intake


_LABELS = [
    ("caller_name", "Caller"),
    ("callback_number", "Callback number"),
    ("caller_id", "Caller ID"),
    ("care_recipient", "Who needs care"),
    ("relationship", "Relationship to caller"),
    ("service_needed", "Service needed"),
    ("job_role", "Role wanted"),
    ("town", "Town"),
    ("county", "County"),
    ("payment_type", "Payment"),
    ("urgency", "Urgency"),
    ("best_callback_time", "Best time to call back"),
    ("questions_or_notes", "Notes"),
]


def build_inquiry_payload(session: CallSession, intake: dict) -> dict:
    """Shape matches src/app/api/inquiry/route.ts (name, phone, email, kind, message, source_page)."""
    is_job = intake.get("caller_type") == "job_seeker"
    phone = intake.get("callback_number") or intake.get("caller_id") or ""
    name = intake.get("caller_name") or "Unknown caller (phone assistant)"

    when = time.strftime("%a %b %d %Y, %I:%M %p", time.localtime(session.started_at))
    lines = [
        f"Phone assistant call ({'job seeker' if is_job else 'care inquiry'}), {when}.",
    ]
    if session.emergency_flagged:
        lines.append("NOTE: caller mentioned a possible emergency and was told to call 911.")
    for key, label in _LABELS:
        val = str(intake.get(key) or "").strip()
        if val and not (is_job and key in ("care_recipient", "relationship", "service_needed", "payment_type", "urgency")):
            lines.append(f"{label}: {val}")
    lines.append("")
    lines.append("Transcript excerpt (full transcript kept on the receptionist device for 30 days):")
    excerpt = session.transcript_text(last=12)
    summary = "\n".join(lines)
    budget = 3900 - len(summary)  # the route keeps the first 4000 characters
    if len(excerpt) > budget:
        excerpt = "..." + excerpt[-max(budget - 3, 0):]
    message = summary + "\n" + excerpt

    payload = {
        "name": name[:200],
        "phone": phone[:50],
        "email": "",
        "kind": "careers" if is_job else "care",
        "message": message,
        "source_page": "phone-assistant",
    }
    if not is_job:
        payload["service"] = intake.get("service_category") or "Not sure yet"
    return payload


async def send_inquiry(payload: dict) -> str:
    if not payload.get("phone"):
        logger.warning("No phone number captured; inquiry kept locally only")
        return "skipped: no phone number"
    if settings.dry_run:
        print("\n===== DRY_RUN: would POST to", settings.inquiry_url, "=====")
        print(json.dumps(payload, indent=2))
        print("===== end DRY_RUN =====\n", flush=True)
        return "dry_run"
    last = ""
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(settings.inquiry_url, json=payload)
            if r.status_code == 200:
                logger.info("Inquiry posted to website")
                return "posted"
            last = f"http {r.status_code}: {r.text[:200]}"
            if r.status_code in (400,):
                break
        except Exception as e:
            last = f"error: {e}"
        logger.warning(f"Inquiry post attempt {attempt + 1} failed: {last}")
        await asyncio.sleep(2 * (attempt + 1))
    return f"failed: {last}"
