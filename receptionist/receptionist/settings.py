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
    # Language model (Ollama, OpenAI-compatible API)
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:3b")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.3"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "120"))

    # Speech to text (faster-whisper). A folder path or a model name.
    whisper_model: str = str(_path("WHISPER_MODEL", ROOT / "models/whisper/small.en"))
    whisper_compute_type: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    whisper_beam_size: int = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
    stt_debug_dir: str = os.getenv("STT_DEBUG_DIR", "")  # e.g. "stt-debug" to save every segment (testing only)

    # Text to speech (Piper)
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

    # Telephony (Telnyx)
    public_ws_url: str = os.getenv("PUBLIC_WS_URL", "wss://voice.tinashhomecareservices.com/ws")
    telnyx_api_key: str = os.getenv("TELNYX_API_KEY", "")
    call_token: str = os.getenv("CALL_TOKEN", "")
    max_concurrent_calls: int = int(os.getenv("MAX_CONCURRENT_CALLS", "1"))
    max_call_seconds: int = int(os.getenv("MAX_CALL_SECONDS", "900"))
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8765"))


settings = Settings()
