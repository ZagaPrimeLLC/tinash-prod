"""Builds the system prompts from the editable files in config/.

- config/script.md          the Claude conversation (default mode)
- config/script_offline.md  the local model's narrow role in offline mode
- config/facts.md           the only facts either may state
"""

from .settings import settings

GREETING = (
    "Hi, thanks for calling Tinash Homecare Services! I'm the Tinash virtual "
    "assistant, and I'll take a few notes so our team can follow up with you. "
    "How can I help today?"
)

def speakable_parts(text: str) -> list[str]:
    """Split a fixed line into sentences so the voice starts quickly: Kokoro
    takes seconds on a long paragraph, and Pipecat drops a line that produces
    no audio within its timeout."""
    import re

    return [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]


FAREWELL = "Thanks so much for calling Tinash Homecare Services. Take care, goodbye."

EMERGENCY_NOTE = (
    "The caller may be describing a medical emergency. Reply with exactly this and nothing else: "
    '"If this is a medical emergency, please hang up and call 9 1 1 right now."'
)


def _read(name: str) -> str:
    return (settings.config_dir / name).read_text(encoding="utf-8").strip()


def _with_facts(script: str) -> str:
    return (
        f"{script}\n\n"
        "You have already greeted the caller with: "
        f'"{GREETING}"\n\n'
        "# Fact sheet (the only facts you may state)\n\n"
        f"{_read('facts.md')}\n"
    )


def system_prompt() -> str:
    """Offline (Ollama) prompt. Kept byte-stable so the local prompt cache stays warm."""
    return _with_facts(_read("script_offline.md"))


def claude_system_prompt() -> str:
    """Claude prompt. Stable across calls (no dates or caller details) so it is cached."""
    return _with_facts(_read("script.md"))
