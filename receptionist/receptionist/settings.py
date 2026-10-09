"""Configuration, read from environment variables and receptionist/.env."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# receptionist/ (the folder holding .env, config/, models/, data/)
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env", override=False)


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None or v.strip() == "":
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _path(name: str, default: Path) -> Path:
    v = os.getenv(name)
    p = Path(v) if v else default
    return p if p.is_absolute() else (ROOT / p)


@dataclass(frozen=True)
class Settings:
    # Conversation brain: "claude" (default; local Ollama is the offline fallback) or "ollama"
    llm_provider: str = os.getenv("LLM_PROVIDER", "claude").strip().lower()
    claude_model: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
    claude_effort: str = os.getenv("CLAUDE_EFFORT", "low")
    claude_max_tokens: int = int(os.getenv("CLAUDE_MAX_TOKENS", "600"))
    claude_first_token_timeout: float = float(os.getenv("CLAUDE_FIRST_TOKEN_TIMEOUT", "6"))
    claude_turn_timeout: float = float(os.getenv("CLAUDE_TURN_TIMEOUT", "15"))
    claude_server_fallback: bool = _bool("CLAUDE_SERVER_FALLBACK", True)

    # Local language model (Ollama, OpenAI-compatible API)
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:3b")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "120"))

    # Speech to text (faster-whisper). A folder path or a model name.
    whisper_model: str = str(_path("WHISPER_MODEL", ROOT / "models/whisper/small.en"))
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
    stt_debug_dir: str = os.getenv("STT_DEBUG_DIR", "")  # e.g. "stt-debug" to save every segment (testing only)

    # Text to speech. kokoro sounds far more natural; piper is much faster on a Pi.
    tts_engine: str = os.getenv("TTS_ENGINE", "kokoro").lower()
    kokoro_voice: str = os.getenv("KOKORO_VOICE", "af_sarah")
    kokoro_speed: float = float(os.getenv("KOKORO_SPEED", "1.0"))
    kokoro_dir: Path = _path("KOKORO_DIR", ROOT / "models/kokoro")
    piper_voice: str = os.getenv("PIPER_VOICE", "en_US-amy-medium")
    piper_dir: Path = _path("PIPER_DIR", ROOT / "models/piper")

    # Files
    config_dir: Path = _path("CONFIG_DIR", ROOT / "config")
    data_dir: Path = _path("DATA_DIR", ROOT / "data")
    transcript_retention_days: int = int(os.getenv("TRANSCRIPT_RETENTION_DAYS", "30"))

    # Website lead endpoint
    inquiry_url: str = os.getenv(
        "INQUIRY_URL", "https://tinashhomecareservices.com/api/inquiry"
    )
    dry_run: bool = _bool("DRY_RUN", True)

    # CRM dashboard (Phone Assistant in the Tinash CRM). All three set = on:
    # settings come from the CRM, calls are logged there, and the CRM's test
    # mode replaces DRY_RUN. Any of them empty = off (the behaviour above).
    supabase_url: str = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    supabase_anon_key: str = os.getenv("SUPABASE_ANON_KEY", "").strip()  # the public (publishable) key
    device_token: str = os.getenv("DEVICE_TOKEN", "").strip()
    supabase_schema: str = os.getenv("SUPABASE_SCHEMA", "proj_tinash").strip() or "proj_tinash"

    # Telephony (Telnyx)
    public_ws_url: str = os.getenv("PUBLIC_WS_URL", "wss://voice.tinashhomecareservices.com/ws")
    telnyx_api_key: str = os.getenv("TELNYX_API_KEY", "")
    # Twilio (alternative carrier). Optional: lets the bot hang up through the API.
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    call_token: str = os.getenv("CALL_TOKEN", "")
    max_concurrent_calls: int = int(os.getenv("MAX_CONCURRENT_CALLS", "1"))
    max_call_seconds: int = int(os.getenv("MAX_CALL_SECONDS", "900"))
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8765"))


settings = Settings()


def claude_enabled() -> bool:
    """Claude is used when selected and an API key is configured (the key is never logged)."""
    return settings.llm_provider == "claude" and bool(os.getenv("ANTHROPIC_API_KEY"))


def dashboard_enabled() -> bool:
    """The CRM dashboard integration is on when its URL, public key and device token are all set."""
    return bool(settings.supabase_url and settings.supabase_anon_key and settings.device_token)
