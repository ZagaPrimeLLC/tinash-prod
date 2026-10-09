"""Per-call state and local transcript storage (kept 30 days, then deleted)."""

import json
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger

from .settings import settings

# Phrases that may indicate a medical emergency. A hit adds a note to the
# conversation telling the model to send the caller to 911 (see bot.py).
EMERGENCY_RE = re.compile(
    r"\b(9\s?1\s?1|emergency|can'?t breathe|cannot breathe|not breathing|trouble breathing|"
    r"chest pain|heart attack|stroke|unresponsive|unconscious|passed out|"
    r"bleeding (a lot|badly|heavily)|overdose|choking|fell and can'?t get up|"
    r"suicid|kill (my|him|her)self)",
    re.IGNORECASE,
)

GOODBYE_RE = re.compile(r"\bgood\s?-?bye\b", re.IGNORECASE)


@dataclass
class CallSession:
    mode: str  # "phone", "local-audio", "text"
    caller_id: str = ""
    call_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    carrier: str = ""  # "telnyx" or "twilio" for phone calls
    carrier_call_id: str = ""  # the carrier's id for the call (shown in the CRM)
    started_at: float = field(default_factory=time.time)
    ended_at: float | None = None
    transcript: list[dict] = field(default_factory=list)
    end_reason: str = ""
    emergency_flagged: bool = False
    checklist: object = None  # receptionist.checklist.Checklist, set by bot.py
    claude: object = None  # receptionist.claude_brain.ClaudeConversation in Claude mode
    llm_fallback_reason: str = ""
    llm_usage: dict = field(default_factory=dict)

    def add(self, role: str, text: str):
        text = (text or "").strip()
        if not text:
            return
        if self.transcript and self.transcript[-1]["role"] == role and self.transcript[-1]["text"] == text:
            return
        self.transcript.append({"role": role, "text": text, "t": round(time.time() - self.started_at, 1)})

    def transcript_text(self, last: int | None = None) -> str:
        lines = self.transcript[-last:] if last else self.transcript
        return "\n".join(
            f"{'Caller' if m['role'] == 'user' else 'Assistant'}: {m['text']}" for m in lines
        )


def transcripts_dir() -> Path:
    d = settings.data_dir / "transcripts"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_call(session: CallSession, intake: dict, payload: dict | None, post_result: str) -> Path:
    started = datetime.fromtimestamp(session.started_at, tz=timezone.utc).astimezone()
    path = transcripts_dir() / f"{started:%Y%m%d-%H%M%S}-{session.call_id}.json"
    record = {
        "call_id": session.call_id,
        "mode": session.mode,
        "carrier": session.carrier,
        "caller_id": session.caller_id,
        "started_at": started.isoformat(),
        "duration_secs": round((session.ended_at or time.time()) - session.started_at, 1),
        "end_reason": session.end_reason,
        "emergency_flagged": session.emergency_flagged,
        "checklist": session.checklist.summary() if session.checklist else None,
        "brain": "claude" if session.claude is not None else "local",
        "claude_fallback_reason": session.llm_fallback_reason,
        "claude_recorded_intake": getattr(session.claude, "intake", None),
        "llm_usage": session.llm_usage,
        "intake": intake,
        "inquiry_payload": payload,
        "inquiry_result": post_result,
        "transcript": session.transcript,
    }
    path.write_text(json.dumps(record, indent=2), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    logger.info(f"Saved call record {path}")
    return path


def purge_old_transcripts(days: int | None = None) -> int:
    """Delete local call records older than the retention period."""
    days = settings.transcript_retention_days if days is None else days
    cutoff = time.time() - days * 86400
    removed = 0
    for p in transcripts_dir().glob("*.json"):
        try:
            if p.stat().st_mtime < cutoff:
                p.unlink()
                removed += 1
        except OSError:
            pass
    if removed:
        logger.info(f"Deleted {removed} call record(s) older than {days} days")
    return removed
