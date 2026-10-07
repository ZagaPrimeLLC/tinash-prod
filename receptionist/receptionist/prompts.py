"""Builds the system prompt from the editable files in config/."""

from .settings import settings

GREETING = (
    "Thank you for calling Tinash Homecare Services. This is the Tinash virtual "
    "assistant. Calls may be noted so our team can follow up. How can I help?"
)

FAREWELL = "Thank you for calling Tinash Homecare Services. Goodbye."

EMERGENCY_NOTE = (
    "The caller may be describing a medical emergency. Reply with exactly this and nothing else: "
    '"If this is a medical emergency, please hang up and call 9 1 1 right now."'
)


def system_prompt() -> str:
    script = (settings.config_dir / "script.md").read_text(encoding="utf-8")
    facts = (settings.config_dir / "facts.md").read_text(encoding="utf-8")
    return (
        f"{script.strip()}\n\n"
        "You have already greeted the caller with: "
        f'"{GREETING}"\n\n'
        "# Fact sheet (the only facts you may state)\n\n"
        f"{facts.strip()}\n"
    )
