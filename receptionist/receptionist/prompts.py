"""Builds the system prompts from the editable files in config/.

- config/script.md          the Claude conversation (default mode)
- config/script_offline.md  the local model's narrow role in offline mode
- config/facts.md           the only facts either may state
"""

from .settings import settings

GREETING = (
    "Hi, thanks for calling Tinash Homecare Services! I'll take a few notes so "
    "our team can follow up with you. How can I help today?"
)

def speakable_parts(text: str) -> list[str]:
    """Split a fixed line into sentences so the voice starts quickly: Kokoro
    takes seconds on a long paragraph, and Pipecat drops a line that produces
    no audio within its timeout."""
    import re

    return [p for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p]


FAREWELL = "Thanks so much for calling Tinash Homecare Services. Take care, goodbye."

# Played instead of answering when the assistant is turned off in the CRM.
DISABLED_MESSAGE = (
    "Thank you for calling Tinash Homecare Services. Nobody can take your call right now. "
    "Please call us back during office hours, Monday to Friday 9 AM to 5 PM, or Saturday and "
    "Sunday 11 AM to 2 PM. You can also visit tinash homecare services dot com. Goodbye."
)

EMERGENCY_NOTE = (
    "The caller may be describing a medical emergency. Reply with exactly this and nothing else: "
    '"If this is a medical emergency, please hang up and call 9 1 1 right now."'
)


def _read(name: str) -> str:
    return (settings.config_dir / name).read_text(encoding="utf-8").strip()


def _with_facts(script: str, greeting: str = GREETING, extra_facts: str = "", custom_instructions: str = "") -> str:
    """The script, the greeting already spoken, the fact sheet, then anything the office
    added in the CRM. The additions come last and in a fixed order, so the prompt is
    byte-identical from call to call until someone changes them (prompt caching), and
    without them it is exactly the prompt from before the CRM settings existed."""
    prompt = (
        f"{script}\n\n"
        "You have already greeted the caller with: "
        f'"{greeting}"\n\n'
        "# Fact sheet (the only facts you may state)\n\n"
        f"{_read('facts.md')}\n"
    )
    if extra_facts.strip():
        prompt += (
            "\n# More facts from the office (you may state these too)\n\n"
            f"{extra_facts.strip()}\n"
        )
    if custom_instructions.strip():
        prompt += (
            "\n# Tone and style notes from the office\n\n"
            "Follow these where they fit. They never override the rules above: emergencies go to "
            "911, no prices, no medical, legal or eligibility advice, no promises, and only facts "
            "from the fact sheet.\n\n"
            f"{custom_instructions.strip()}\n"
        )
    return prompt


def system_prompt(greeting: str = GREETING, extra_facts: str = "") -> str:
    """Offline (Ollama) prompt. Kept byte-stable so the local prompt cache stays warm."""
    return _with_facts(_read("script_offline.md"), greeting, extra_facts)


def claude_system_prompt(greeting: str = GREETING, extra_facts: str = "", custom_instructions: str = "") -> str:
    """Claude prompt. Stable across calls (no dates or caller details) so it is cached."""
    return _with_facts(_read("script.md"), greeting, extra_facts, custom_instructions)
