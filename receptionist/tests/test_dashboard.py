"""Unit tests for the CRM dashboard link (receptionist/dashboard.py). No network, no models.

    python -m pytest tests/test_dashboard.py -q
"""

import asyncio
import os
import time

os.environ["DRY_RUN"] = "true"

import pytest  # noqa: E402

from receptionist import dashboard  # noqa: E402
from receptionist.dashboard import (  # noqa: E402
    CallConfig, build_call_payload, classify_outcome, config_from_crm, report_call,
)
from receptionist.prompts import FAREWELL, GREETING, claude_system_prompt, system_prompt  # noqa: E402
from receptionist.session import CallSession  # noqa: E402

FAMILY = {
    "caller_type": "family", "caller_name": "Maria Gonzalez", "callback_number": "(973) 555-0142",
    "care_recipient": "her mother Rose, 84", "relationship": "mother", "service_needed": "help with bathing",
    "town": "Montclair", "county": "Essex", "payment_type": "private pay", "urgency": "within two weeks",
    "best_callback_time": "weekday mornings", "job_role": "", "questions_or_notes": "",
    "caller_id": "(973) 555-0142", "service_category": "Daily Senior Care", "emergency_flagged": False,
    "phone_confirmed_by_caller": True,
}


def make_session(secs: float = 90, caller_spoke: bool = True, **kw) -> CallSession:
    s = CallSession(mode="phone", caller_id="+19735550142", **kw)
    s.started_at = time.time() - secs
    s.ended_at = time.time()
    s.carrier, s.carrier_call_id = "telnyx", "v3:abc123"
    s.add("assistant", GREETING)
    if caller_spoke:
        s.add("user", "Hi, I need help for my mother.")
    return s


# --- outcome -----------------------------------------------------------------


def test_completed_family():
    assert classify_outcome(make_session(), FAMILY) == "completed"


def test_completed_job_seeker_needs_role_not_service():
    intake = {"caller_type": "job_seeker", "caller_name": "Dana", "callback_number": "9085550177",
              "job_role": "caregiver", "service_needed": ""}
    assert classify_outcome(make_session(), intake) == "completed"
    assert classify_outcome(make_session(), {**intake, "job_role": ""}) == "partial"


def test_partial_when_something_is_missing():
    assert classify_outcome(make_session(), {**FAMILY, "callback_number": ""}) == "partial"
    assert classify_outcome(make_session(), {**FAMILY, "service_needed": ""}) == "partial"
    assert classify_outcome(make_session(), {"caller_type": "family", "town": "Newark"}) == "partial"


def test_abandoned():
    # Hung up without a word.
    assert classify_outcome(make_session(caller_spoke=False), {}) == "abandoned"
    # Spoke, but nothing useful was taken.
    assert classify_outcome(make_session(), {"caller_type": "other"}) == "abandoned"
    # Under 15 seconds and no number.
    assert classify_outcome(make_session(secs=8), {"caller_type": "family", "caller_name": "Al"}) == "abandoned"


def test_short_call_with_a_number_is_not_abandoned():
    assert classify_outcome(make_session(secs=10), {"caller_name": "Al", "callback_number": "9735550100"}) == "partial"


def test_emergency_wins():
    s = make_session()
    s.emergency_flagged = True
    assert classify_outcome(s, FAMILY) == "emergency"
    assert classify_outcome(make_session(), {**FAMILY, "emergency_flagged": True}) == "emergency"
    assert classify_outcome(s, FAMILY, failed=True) == "emergency"


def test_failed():
    s = make_session()
    s.end_reason = "error: websocket closed"
    assert classify_outcome(s, FAMILY) == "failed"
    assert classify_outcome(make_session(), FAMILY, failed=True) == "failed"


# --- payload -----------------------------------------------------------------


def test_payload_fields_match_the_table():
    s = make_session()
    s.end_reason = "end_call tool"
    s.llm_usage = {"cost_usd": 0.0123, "first_word_secs": [1.2, 1.6], "slow_turns": 1, "requests": 5}
    p = build_call_payload(s, FAMILY)
    assert p["outcome"] == "completed"
    assert p["carrier"] == "telnyx" and p["carrier_call_id"] == "v3:abc123"
    assert p["caller_number"] == "(973) 555-0142"
    assert p["caller_type"] == "family" and p["caller_name"] == "Maria Gonzalez"
    assert p["service"] == "Daily Senior Care"  # one of the inbox's service values
    assert p["town"] == "Montclair" and p["county"] == "Essex"
    assert p["cost_usd"] == 0.0123
    assert p["latency"]["avg_first_word_secs"] == 1.4 and p["latency"]["slow_turns"] == 1
    assert 85 <= p["duration_secs"] <= 95
    assert p["started_at"].endswith("+00:00") and p["ended_at"] > p["started_at"]
    assert [m["role"] for m in p["transcript"]] == ["assistant", "user"]
    assert "Caller: Maria Gonzalez" in p["summary"] and "How it ended: end_call tool." in p["summary"]
    assert p["intake"]["phone_confirmed_by_caller"] is True
    assert p["emergency_flagged"] is False
    # Only columns proj_tinash.phone_calls has (the RPC reads these keys).
    assert set(p) == {
        "carrier", "carrier_call_id", "started_at", "ended_at", "duration_secs", "caller_number", "outcome",
        "end_reason", "caller_type", "caller_name", "callback_number", "service", "town", "county", "urgency",
        "best_callback_time", "emergency_flagged", "summary", "intake", "transcript", "brain", "cost_usd",
        "latency",
    }


def test_payload_job_seeker_service_is_the_role():
    p = build_call_payload(make_session(), {"caller_type": "job_seeker", "caller_name": "Dana",
                                             "callback_number": "9085550177", "job_role": "DSP"})
    assert p["service"] == "DSP" and p["caller_type"] == "job_seeker"


def test_payload_limits_sizes():
    s = make_session()
    for i in range(2500):
        s.add("user" if i % 2 else "assistant", f"line {i} " + "x" * 3000)
    p = build_call_payload(s, {**FAMILY, "questions_or_notes": "y" * 5000, "caller_name": "z" * 500})
    assert len(p["transcript"]) == 2000
    assert all(len(m["text"]) <= 2000 for m in p["transcript"])
    assert len(p["caller_name"]) == 200
    assert len(p["intake"]["questions_or_notes"]) == 1000
    assert len(p["summary"]) <= 4000


def test_payload_with_nothing_captured():
    p = build_call_payload(make_session(caller_spoke=False), {})
    assert p["outcome"] == "abandoned" and p["caller_type"] == "other"
    assert p["caller_name"] is None and p["service"] is None and p["intake"] is None


# --- settings from the CRM -----------------------------------------------------


def test_config_from_crm_validates(monkeypatch):
    monkeypatch.setattr(dashboard, "_voice_installed", lambda engine, voice: True)
    cfg = config_from_crm({
        "enabled": True, "test_mode": False, "voice_engine": "kokoro", "voice": "af_heart",
        "voice_speed": 1.5, "greeting": "  Hello there.  ", "farewell": "", "custom_instructions": "Be brief.",
        "extra_facts": None, "transcript_retention_days": 900,
    })
    assert cfg.test_mode is False and cfg.enabled is True
    assert (cfg.voice_engine, cfg.voice) == ("kokoro", "af_heart")
    assert cfg.voice_speed == 1.2 and cfg.retention_days == 365
    assert cfg.greeting == "Hello there." and cfg.farewell == FAREWELL
    assert cfg.custom_instructions == "Be brief." and cfg.extra_facts == ""
    assert cfg.source == "crm"


def test_config_from_crm_rejects_unknown_or_missing_voice(monkeypatch):
    base = CallConfig()
    monkeypatch.setattr(dashboard, "_voice_installed", lambda engine, voice: True)
    cfg = config_from_crm({"voice_engine": "kokoro", "voice": "en_US-amy-medium"})
    assert (cfg.voice_engine, cfg.voice) == (base.voice_engine, base.voice)
    monkeypatch.setattr(dashboard, "_voice_installed", lambda engine, voice: False)
    cfg = config_from_crm({"voice_engine": "piper", "voice": "en_US-lessac-high"})
    assert (cfg.voice_engine, cfg.voice) == (base.voice_engine, base.voice)


def test_unclear_test_mode_means_test_mode():
    assert config_from_crm({}).test_mode is True
    assert config_from_crm({"test_mode": None}).test_mode is True


def test_prompt_unchanged_without_crm_additions():
    """No CRM extras: exactly the prompt from before the dashboard (keeps the prompt cache warm)."""
    cfg = CallConfig()
    assert claude_system_prompt(cfg.greeting, cfg.extra_facts, cfg.custom_instructions) == claude_system_prompt()
    assert system_prompt(cfg.greeting, cfg.extra_facts) == system_prompt()


def test_prompt_additions_come_last_in_a_fixed_order():
    p = claude_system_prompt("Hello from Tinash.", "We are closed on Thanksgiving.", "Speak slowly.")
    base = claude_system_prompt("Hello from Tinash.")
    assert p.startswith(base)
    assert p.index("closed on Thanksgiving") < p.index("Speak slowly.")
    assert '"Hello from Tinash."' in p
    assert p == claude_system_prompt("Hello from Tinash.", "We are closed on Thanksgiving.", "Speak slowly.")


def test_dashboard_off_uses_env(monkeypatch):
    monkeypatch.setattr(dashboard, "dashboard_enabled", lambda: False)
    cfg = asyncio.run(dashboard.get_config())
    assert cfg == CallConfig() and cfg.source == "env" and cfg.test_mode is None


# --- reporting a call ------------------------------------------------------------


def test_report_call_logs_in_the_crm(monkeypatch):
    sent = {}

    async def fake_rpc(fn, args, timeout=5.0):
        sent[fn] = args
        return "11111111-2222-3333-4444-555555555555"

    async def no_website(payload):
        raise AssertionError("must not POST /api/inquiry when the CRM took the call")

    monkeypatch.setattr(dashboard, "rpc", fake_rpc)
    monkeypatch.setattr(dashboard, "send_inquiry", no_website)
    call, result = asyncio.run(report_call(make_session(), FAMILY, CallConfig(test_mode=False)))
    assert result == "crm: 11111111-2222-3333-4444-555555555555"
    assert sent["phone_device_log_call"]["p_call"]["outcome"] == "completed"
    assert "p_token" in sent["phone_device_log_call"]


def test_report_call_falls_back_to_the_website(monkeypatch):
    posted = []

    async def down(fn, args, timeout=5.0):
        raise dashboard.DashboardError("phone_device_log_call: http 503: unavailable", 503)

    async def website(payload):
        posted.append(payload)
        return "dry_run"

    async def no_sleep(_):
        return None

    monkeypatch.setattr(dashboard, "rpc", down)
    monkeypatch.setattr(dashboard, "send_inquiry", website)
    monkeypatch.setattr(dashboard.asyncio, "sleep", no_sleep)
    payload, result = asyncio.run(report_call(make_session(), FAMILY, CallConfig(test_mode=False)))
    assert result == "crm failed; fallback: dry_run"
    assert posted and posted[0]["source_page"] == "phone-assistant" and posted[0]["phone"] == "(973) 555-0142"


def test_report_call_fallback_respects_crm_test_mode(monkeypatch):
    async def refused(fn, args, timeout=5.0):
        raise dashboard.DashboardError("phone_device_log_call: http 401: invalid device token", 401)

    async def website(payload):
        raise AssertionError("test mode must not send a real lead")

    monkeypatch.setattr(dashboard, "rpc", refused)
    monkeypatch.setattr(dashboard, "send_inquiry", website)
    _, result = asyncio.run(report_call(make_session(), FAMILY, CallConfig(test_mode=True)))
    assert result == "crm failed; fallback: test mode"


@pytest.mark.parametrize("status,calls", [(401, 1), (503, 2)])
def test_log_call_retries_only_server_errors(monkeypatch, status, calls):
    n = []

    async def failing(fn, args, timeout=5.0):
        n.append(1)
        raise dashboard.DashboardError(f"http {status}", status)

    async def no_sleep(_):
        return None

    monkeypatch.setattr(dashboard, "rpc", failing)
    monkeypatch.setattr(dashboard.asyncio, "sleep", no_sleep)
    with pytest.raises(dashboard.DashboardError):
        asyncio.run(dashboard.log_call({}))
    assert len(n) == calls
