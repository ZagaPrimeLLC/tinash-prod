"""The link to the Tinash CRM (Phone Assistant section): settings, heartbeats and the call log.

On only when SUPABASE_URL, SUPABASE_ANON_KEY and DEVICE_TOKEN are all set
(settings.dashboard_enabled). It calls three database functions through
Supabase's REST API with the public key; the device token proves which device
is calling (the database keeps only its SHA-256):

    proj_tinash.phone_device_settings(p_token)            the CRM's settings, cached here for 30 s
    proj_tinash.phone_device_heartbeat(p_token, p_status)  every 60 s from the server
    proj_tinash.phone_device_log_call(p_token, p_call)     after each phone call; returns the call id

With the dashboard on, the CRM's test mode replaces DRY_RUN: the database
decides whether a call also becomes an inbox lead, so the receptionist does
not POST /api/inquiry as well. Any failure falls back to the .env behaviour
(and, for a call, to the /api/inquiry path), so a CRM outage never stops the
phone being answered or loses a lead. The token is never logged.
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from loguru import logger

from .intake import build_inquiry_payload, call_summary, normalize_phone, send_inquiry
from .prompts import FAREWELL, GREETING
from .session import CallSession
from .settings import dashboard_enabled, settings

# Keep in sync with the phone_settings_voice check in
# supabase/migrations/20261009000000_phone_assistant.sql.
KOKORO_VOICES = ("af_sarah", "af_heart", "af_bella", "af_nicole", "am_michael")
PIPER_VOICES = ("en_US-amy-medium", "en_US-lessac-high", "en_US-hfc_female-medium")

SETTINGS_MAX_AGE = 30.0
RETRY_AFTER_FAILURE = 10.0

# A call shorter than this with no number taken counts as abandoned.
MIN_USEFUL_SECS = 15.0

OUTCOMES = ("completed", "partial", "abandoned", "failed", "emergency")


def _env_voice() -> tuple[str, str]:
    engine = "kokoro" if settings.tts_engine == "kokoro" else "piper"
    return engine, settings.kokoro_voice if engine == "kokoro" else settings.piper_voice


@dataclass(frozen=True)
class CallConfig:
    """What one call uses. The defaults are the .env behaviour (dashboard off or unreachable)."""

    enabled: bool = True
    test_mode: bool | None = None  # None: not known from the CRM; DRY_RUN decides
    voice_engine: str = field(default_factory=lambda: _env_voice()[0])
    voice: str = field(default_factory=lambda: _env_voice()[1])
    voice_speed: float = field(default_factory=lambda: settings.kokoro_speed)
    greeting: str = GREETING
    farewell: str = FAREWELL
    custom_instructions: str = ""
    extra_facts: str = ""
    retention_days: int = field(default_factory=lambda: settings.transcript_retention_days)
    source: str = "env"  # "env" or "crm"


def _voice_installed(engine: str, voice: str) -> bool:
    if engine == "kokoro":
        return (settings.kokoro_dir / "kokoro-v1.0.onnx").exists() and (settings.kokoro_dir / "voices-v1.0.bin").exists()
    return (settings.piper_dir / f"{voice}.onnx").exists()


def config_from_crm(data: dict) -> CallConfig:
    """The CRM's settings row -> CallConfig. Anything missing or invalid keeps the .env value."""
    base = CallConfig()

    def text(key: str, default: str, limit: int) -> str:
        v = data.get(key)
        return v.strip()[:limit] if isinstance(v, str) and v.strip() else default

    engine, voice = data.get("voice_engine"), data.get("voice")
    if not ((engine == "kokoro" and voice in KOKORO_VOICES) or (engine == "piper" and voice in PIPER_VOICES)):
        engine, voice = base.voice_engine, base.voice
    elif not _voice_installed(engine, voice):
        # Never download a voice in the middle of a call: keep the installed one.
        logger.warning(f"Voice {engine}/{voice} chosen in the CRM is not installed on this device; "
                       f"using {base.voice_engine}/{base.voice}")
        engine, voice = base.voice_engine, base.voice
    try:
        speed = min(max(float(data.get("voice_speed")), 0.8), 1.2)
    except (TypeError, ValueError):
        speed = base.voice_speed
    try:
        retention = min(max(int(data.get("transcript_retention_days")), 1), 365)
    except (TypeError, ValueError):
        retention = base.retention_days
    return CallConfig(
        enabled=data.get("enabled") is not False,
        # Unknown means test mode: real leads only when the CRM clearly says so.
        test_mode=data.get("test_mode") is not False,
        voice_engine=engine,
        voice=voice,
        voice_speed=speed,
        greeting=text("greeting", base.greeting, 400),
        farewell=text("farewell", base.farewell, 300),
        custom_instructions=text("custom_instructions", "", 4000),
        extra_facts=text("extra_facts", "", 6000),
        retention_days=retention,
        source="crm",
    )


# ---------------------------------------------------------------------------
# REST calls
# ---------------------------------------------------------------------------


class DashboardError(Exception):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


async def rpc(fn: str, args: dict, timeout: float = 5.0):
    """POST {SUPABASE_URL}/rest/v1/rpc/<fn> in the proj_tinash schema."""
    key = settings.supabase_anon_key
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        # The schema is not public, so PostgREST must be told which one.
        "Content-Profile": settings.supabase_schema,
        "Accept-Profile": settings.supabase_schema,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(f"{settings.supabase_url}/rest/v1/rpc/{fn}", json=args, headers=headers)
    if r.status_code >= 300:
        raise DashboardError(f"{fn}: http {r.status_code}: {r.text[:200]}", r.status_code)
    return r.json() if r.content else None


_cache: dict = {"config": None, "fetched": 0.0, "failed": 0.0}


def cached_config() -> CallConfig:
    """The last settings fetched from the CRM, or the .env defaults. Never waits."""
    if not dashboard_enabled():
        return CallConfig()
    return _cache["config"] or CallConfig()


async def get_config(max_age: float = SETTINGS_MAX_AGE, timeout: float = 2.5) -> CallConfig:
    """The CRM's settings, at most `max_age` seconds old. On any failure: the last known
    settings, or the .env defaults if the CRM has never answered."""
    if not dashboard_enabled():
        return CallConfig()
    now = time.monotonic()
    if _cache["config"] is not None and now - _cache["fetched"] < max_age:
        return _cache["config"]
    if now - _cache["failed"] < RETRY_AFTER_FAILURE:
        return cached_config()
    try:
        data = await rpc("phone_device_settings", {"p_token": settings.device_token}, timeout=timeout)
        if not isinstance(data, dict):
            raise DashboardError("settings were not a JSON object")
        cfg = config_from_crm(data)
        if _cache["config"] != cfg:
            logger.info(f"CRM settings: {'on' if cfg.enabled else 'OFF'}, test mode {'on' if cfg.test_mode else 'OFF'}, "
                        f"voice {cfg.voice_engine}/{cfg.voice} x{cfg.voice_speed}")
        _cache.update(config=cfg, fetched=now)
        return cfg
    except Exception as e:
        _cache["failed"] = now
        logger.warning(f"Could not read the CRM settings ({e}); using "
                       f"{'the last known settings' if _cache['config'] else 'the .env settings'}")
        return cached_config()


async def heartbeat(status: dict) -> None:
    await rpc("phone_device_heartbeat", {"p_token": settings.device_token, "p_status": status}, timeout=5)


# ---------------------------------------------------------------------------
# The call record
# ---------------------------------------------------------------------------


def _digits(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())


def _iso(ts: float | None) -> str | None:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None


def classify_outcome(session: CallSession, intake: dict, failed: bool = False) -> str:
    """emergency  the caller was told to call 911 (always wins)
    failed     the call or the after-call work hit an error
    abandoned  the caller said nothing useful, or hung up within 15 s without leaving a number
    completed  name, callback number and what they need (service, or role for job seekers)
    partial    anything in between"""
    if session.emergency_flagged or intake.get("emergency_flagged") is True:
        return "emergency"
    if failed or (session.end_reason or "").startswith("error"):
        return "failed"
    ended = session.ended_at or time.time()
    secs = ended - session.started_at
    spoke = any(m.get("role") == "user" for m in session.transcript)

    def has(key: str) -> bool:
        return bool(str(intake.get(key) or "").strip())

    name = has("caller_name")
    number = len(_digits(str(intake.get("callback_number") or ""))) >= 7
    is_job = intake.get("caller_type") == "job_seeker"
    need = has("job_role") if is_job else has("service_needed")
    useful = name or number or need or any(
        has(k) for k in ("care_recipient", "town", "county", "job_role", "service_needed", "best_callback_time"))
    if not spoke or not useful or (secs < MIN_USEFUL_SECS and not number):
        return "abandoned"
    if name and number and need:
        return "completed"
    return "partial"


def _clean(v, limit: int = 1000):
    """JSON-safe, size-limited copy of an intake value."""
    if isinstance(v, (bool, int, float)) or v is None:
        return v
    return str(v)[:limit]


def _brain(session: CallSession) -> str:
    if session.claude is None:
        return f"local ({settings.llm_model})"
    if session.llm_fallback_reason:
        return f"{settings.claude_model}, then local fallback ({session.llm_fallback_reason})"[:80]
    return settings.claude_model


def build_call_payload(session: CallSession, intake: dict, failed: bool = False) -> dict:
    """p_call for phone_device_log_call. Field names match proj_tinash.phone_calls."""
    ended = session.ended_at or time.time()
    caller_type = intake.get("caller_type") if intake.get("caller_type") in ("family", "job_seeker", "other") else "other"
    is_job = caller_type == "job_seeker"
    # Family: one of the inbox's service values (it becomes service_interested). Job seeker: the role.
    service = (intake.get("job_role") if is_job else intake.get("service_category")) or ""
    usage = session.llm_usage or {}
    first = [float(x) for x in usage.get("first_word_secs") or [] if isinstance(x, (int, float))]
    summary = call_summary(session, intake) if intake else ""
    if session.end_reason:
        summary += f"\nHow it ended: {session.end_reason}."

    def s(key: str, limit: int) -> str | None:
        v = str(intake.get(key) or "").strip()
        return v[:limit] or None

    return {
        "carrier": session.carrier or None,
        "carrier_call_id": session.carrier_call_id or None,
        "started_at": _iso(session.started_at),
        "ended_at": _iso(ended),
        "duration_secs": round(max(ended - session.started_at, 0), 1),
        "caller_number": normalize_phone(session.caller_id)[:40] or None,
        "outcome": classify_outcome(session, intake, failed),
        "end_reason": (session.end_reason or "")[:200] or None,
        "caller_type": caller_type,
        "caller_name": s("caller_name", 200),
        "callback_number": s("callback_number", 40),
        "service": str(service).strip()[:120] or None,
        "town": s("town", 120),
        "county": s("county", 80),
        "urgency": s("urgency", 200),
        "best_callback_time": s("best_callback_time", 200),
        "emergency_flagged": bool(session.emergency_flagged or intake.get("emergency_flagged") is True),
        "summary": summary.strip()[:4000] or None,
        "intake": {k: _clean(v) for k, v in intake.items()} if intake else None,
        "transcript": [
            {"role": m.get("role"), "text": str(m.get("text", ""))[:2000], "t": m.get("t")}
            for m in session.transcript[-2000:]
        ],
        "brain": _brain(session),
        "cost_usd": usage.get("cost_usd"),
        "latency": {
            "first_word_secs": first,
            "avg_first_word_secs": round(sum(first) / len(first), 2) if first else None,
            "slow_turns": usage.get("slow_turns", 0),
            "llm_requests": usage.get("requests", 0),
        },
    }


async def log_call(call: dict) -> str:
    """Upload one call; returns its id in the CRM. One retry on a network or server error."""
    last: Exception | None = None
    for attempt in range(2):
        try:
            call_id = await rpc("phone_device_log_call", {"p_token": settings.device_token, "p_call": call}, timeout=15)
            return str(call_id)
        except DashboardError as e:
            last = e
            if 400 <= e.status < 500 and e.status != 429:
                break  # refused (bad token, bad payload): retrying will not help
        except Exception as e:  # network errors
            last = e
        if attempt == 0:
            await asyncio.sleep(2)
    raise DashboardError(str(last))


async def report_call(session: CallSession, intake: dict, config: CallConfig, failed: bool = False) -> tuple[dict, str]:
    """After a phone call with the dashboard on: log it in the CRM (which creates the inbox
    lead when test mode is off). If that fails, fall back to the website's /api/inquiry so
    no lead is lost: printed only when DRY_RUN is on or the CRM was last seen in test mode.
    Returns (what was sent, result)."""
    call = build_call_payload(session, intake, failed)
    try:
        call_id = await log_call(call)
        mode = "test mode, not sent to the inbox" if config.test_mode else "live"
        logger.info(f"Call logged in the CRM ({call['outcome']}, {mode})")
        return call, f"crm: {call_id}"
    except Exception as e:
        logger.error(f"Could not log the call in the CRM ({e}); falling back to the website form")
    if not any(m.get("role") == "user" for m in session.transcript):
        return call, "crm failed; caller said nothing, nothing to send"
    payload = build_inquiry_payload(session, intake)
    if config.test_mode:
        logger.info("CRM is in test mode: the fallback lead is printed, not sent")
        print("\n===== CRM test mode: would POST to", settings.inquiry_url, "=====")
        print(json.dumps(payload, indent=2))
        print("===== end =====\n", flush=True)
        return payload, "crm failed; fallback: test mode"
    return payload, f"crm failed; fallback: {await send_inquiry(payload)}"


async def log_declined_call(carrier: str, carrier_call_id: str, caller: str) -> None:
    """A call that arrived while the assistant was turned off in the CRM (it heard the closed message)."""
    session = CallSession(mode="phone", caller_id=caller or "")
    session.carrier, session.carrier_call_id = carrier, carrier_call_id or ""
    session.ended_at = session.started_at
    session.end_reason = "assistant turned off in the CRM; caller heard the closed message"
    call = build_call_payload(session, {})
    call["transcript"] = None
    try:
        await log_call(call)
    except Exception as e:
        logger.warning(f"Could not log the declined call in the CRM ({e})")
