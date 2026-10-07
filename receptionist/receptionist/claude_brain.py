"""Claude as the conversation brain (default mode).

A minimal Pipecat-compatible wrapper around the official `anthropic` SDK. Pipecat
1.12's own AnthropicLLMService can't send what this model needs: it disables
thinking with `{"type": "disabled"}` (rejected by claude-sonnet-5-5), and has no
way to send the server-side fallback beta or `between_tools` thinking.

Per caller turn:
- streams the reply, so speech starts on the first sentence;
- keeps its own append-only message history (thinking and tool blocks are passed
  back unchanged, as the model requires);
- tools: `record_intake` (strict schema, called as details arrive) and `end_call`;
- caches the long, stable system prompt + fact sheet (1 hour TTL) and the growing
  conversation (5 minutes), so later turns read most input from cache;
- raises ClaudeUnavailable on errors, refusals, or no first token within
  CLAUDE_FIRST_TOKEN_TIMEOUT seconds; the caller (bot.py) then switches the rest
  of the call to the local fallback.

The API key is read by the SDK from ANTHROPIC_API_KEY and is never logged.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime

import anthropic
from loguru import logger

from .prompts import GREETING, claude_system_prompt
from .settings import settings

# Claude Sonnet 5.5 list prices, USD per million tokens.
PRICE = {"input": 2.0, "output": 10.0, "cache_read": 0.20, "cache_write_5m": 2.50, "cache_write_1h": 4.00}

SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01"

INTAKE_PROPERTIES = {
    "caller_type": {"type": "string", "enum": ["family", "job_seeker", "other"],
                    "description": "family = asking about care for someone (or themselves); job_seeker = wants a job"},
    "caller_name": {"type": "string"},
    "callback_number": {"type": "string", "description": "Digits only, e.g. 9735550142"},
    "phone_confirmed": {"type": "boolean", "description": "True once the caller said yes to the read-back"},
    "care_recipient": {"type": "string", "description": "Who needs care, with name/age if given"},
    "relationship": {"type": "string", "description": "How that person is related to the caller, e.g. mother, son, self"},
    "service_needed": {"type": "string"},
    "town": {"type": "string"},
    "county": {"type": "string"},
    "payment_type": {"type": "string", "description": "private pay, long-term care insurance, NJ DDD budget, Medicare, or the caller's words"},
    "urgency": {"type": "string"},
    "best_callback_time": {"type": "string"},
    "job_role": {"type": "string", "description": "Job seekers: caregiver, DSP or nurse"},
    "notes": {"type": "string", "description": "Questions you couldn't answer, other useful details"},
    "emergency": {"type": "boolean", "description": "True if the caller described a possible medical emergency"},
}

TOOLS = [
    {
        "name": "record_intake",
        "description": (
            "Save the caller's details for the callback, with everything known so far (empty string for "
            "unknown text fields). Call it when you learn the caller's name, when the number is confirmed, "
            "and at the end before end_call. Silent: the caller does not hear it."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": INTAKE_PROPERTIES,
            "required": list(INTAKE_PROPERTIES),
            "additionalProperties": False,
        },
    },
    {
        "name": "end_call",
        "description": (
            "Hang up the phone. Call it only after you have said the closing summary and goodbye in this "
            "same turn, or when the caller has said goodbye."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"reason": {"type": "string", "description": "A few words, e.g. intake complete"}},
            "required": ["reason"],
            "additionalProperties": False,
        },
    },
]


class ClaudeUnavailable(Exception):
    """Claude could not answer this turn (error, timeout or refusal)."""


@dataclass
class Usage:
    requests: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read: int = 0
    cache_write_5m: int = 0
    cache_write_1h: int = 0

    def add(self, u) -> None:
        if u is None:
            return
        self.requests += 1
        self.input_tokens += u.input_tokens or 0
        self.output_tokens += u.output_tokens or 0
        self.cache_read += getattr(u, "cache_read_input_tokens", 0) or 0
        cc = getattr(u, "cache_creation", None)
        if cc is not None:
            self.cache_write_5m += getattr(cc, "ephemeral_5m_input_tokens", 0) or 0
            self.cache_write_1h += getattr(cc, "ephemeral_1h_input_tokens", 0) or 0
        else:
            self.cache_write_5m += getattr(u, "cache_creation_input_tokens", 0) or 0

    def cost(self) -> float:
        return (
            self.input_tokens * PRICE["input"]
            + self.output_tokens * PRICE["output"]
            + self.cache_read * PRICE["cache_read"]
            + self.cache_write_5m * PRICE["cache_write_5m"]
            + self.cache_write_1h * PRICE["cache_write_1h"]
        ) / 1_000_000

    def as_dict(self) -> dict:
        return {**self.__dict__, "cost_usd": round(self.cost(), 5)}


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(
        max_retries=1,
        timeout=anthropic.Timeout(settings.claude_turn_timeout, connect=3.0),
    )


def _system() -> list[dict]:
    return [{"type": "text", "text": claude_system_prompt(), "cache_control": {"type": "ephemeral", "ttl": "1h"}}]


_SPEECH_JUNK = re.compile(r"[*_#`>|~]")


def speakable(text: str) -> str:
    """Strip markdown symbols the voice would read out."""
    return _SPEECH_JUNK.sub("", text)


@dataclass
class TurnResult:
    text: str = ""
    end_call: bool = False
    ttft: float = 0.0


@dataclass
class ClaudeConversation:
    caller_id: str = ""
    messages: list = field(default_factory=list)
    intake: dict = field(default_factory=dict)
    usage: Usage = field(default_factory=Usage)
    ttfts: list = field(default_factory=list)
    pending_tool_results: list = field(default_factory=list)
    slow_turns: int = 0
    client: anthropic.AsyncAnthropic = field(default_factory=_client)

    def __post_init__(self):
        now = datetime.now().strftime("%A %B %d, %I:%M %p")
        self.messages = [
            {"role": "user", "content": f"(Phone call connected. Caller ID: {self.caller_id or 'unknown'}. "
                                        f"Local time in New Jersey: {now}.)"},
            {"role": "assistant", "content": GREETING},
        ]

    def _request_kwargs(self) -> dict:
        kw = dict(
            model=settings.claude_model,
            max_tokens=settings.claude_max_tokens,
            system=_system(),
            cache_control={"type": "ephemeral"},  # also cache the growing conversation
            tools=TOOLS,
            # Lowest thinking setting on this model (no extended thinking): fastest first words.
            thinking={"type": "between_tools"},
            output_config={"effort": settings.claude_effort},
            messages=self.messages,
        )
        if settings.claude_server_fallback:
            # On a policy decline the API retries on Anthropic's recommended fallback model.
            kw["betas"] = [SERVER_FALLBACK_BETA]
            kw["fallbacks"] = "default"
        return kw

    async def _stream_once(self, on_text: Callable[[str], Awaitable[None]], spoken: list[str], t0: float,
                           on_slow: Callable[[], Awaitable[None]] | None = None):
        first = asyncio.Event()
        ttft = [0.0]

        async def run():
            tools_started = False
            async with self.client.beta.messages.stream(**self._request_kwargs()) as stream:
                async for ev in stream:
                    if ev.type in ("content_block_start", "content_block_delta"):
                        first.set()
                    if ev.type == "content_block_start" and getattr(ev.content_block, "type", "") == "tool_use":
                        # Only words written before the tool calls are spoken; any later
                        # text is a note to itself, not something the caller should hear.
                        tools_started = True
                    if (ev.type == "content_block_delta" and not tools_started
                            and getattr(ev.delta, "type", "") == "text_delta"):
                        if not ttft[0]:
                            ttft[0] = time.perf_counter() - t0
                        piece = speakable(ev.delta.text)
                        spoken.append(piece)
                        await on_text(piece)
                return await stream.get_final_message()

        task = asyncio.create_task(run())
        waiter = asyncio.create_task(first.wait())
        done, _ = await asyncio.wait({task, waiter}, timeout=settings.claude_first_token_timeout,
                                     return_when=asyncio.FIRST_COMPLETED)
        if not done and on_slow is not None:
            # Slow, not down: say "One moment" and give it until the turn timeout.
            self.slow_turns += 1
            await on_slow()
            remaining = max(settings.claude_turn_timeout - settings.claude_first_token_timeout, 0.5)
            done, _ = await asyncio.wait({task, waiter}, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
        waiter.cancel()
        if not done:
            task.cancel()
            raise ClaudeUnavailable(f"no first words within {settings.claude_turn_timeout:.0f}s")
        try:
            final = await asyncio.wait_for(task, timeout=settings.claude_turn_timeout)
        except asyncio.TimeoutError as e:
            raise ClaudeUnavailable("turn timed out") from e
        except anthropic.APIError as e:
            raise ClaudeUnavailable(f"{type(e).__name__} (status {getattr(e, 'status_code', '-')})") from e
        return final, ttft[0]

    async def turn(self, caller_text: str, on_text: Callable[[str], Awaitable[None]],
                   on_slow: Callable[[], Awaitable[None]] | None = None) -> TurnResult:
        """One caller turn. Speaks via on_text as text streams in."""
        t0 = time.perf_counter()
        content = self.pending_tool_results + [{"type": "text", "text": caller_text}]
        self.pending_tool_results = []
        self.messages.append({"role": "user", "content": content})
        spoken: list[str] = []
        result = TurnResult()
        for _ in range(3):  # at most: reply, tool results, reply
            try:
                final, ttft = await self._stream_once(on_text, spoken, t0, on_slow if not spoken else None)
            except ClaudeUnavailable:
                raise
            except anthropic.APIError as e:
                raise ClaudeUnavailable(f"{type(e).__name__} (status {getattr(e, 'status_code', '-')})") from e
            except Exception as e:  # network errors surface in different shapes
                raise ClaudeUnavailable(type(e).__name__) from e
            self.usage.add(final.usage)
            if ttft and not result.ttft:
                result.ttft = ttft
                self.ttfts.append(round(ttft, 2))
            if final.stop_reason == "refusal":
                category = getattr(getattr(final, "stop_details", None), "category", None)
                raise ClaudeUnavailable(f"refusal ({category})")

            blocks = list(final.content)
            idx = [i for i, b in enumerate(blocks) if b.type == "fallback"]
            if idx:  # after a mid-output fallback, echo only what follows the switch point
                blocks = blocks[idx[-1] + 1:]
            self.messages.append({"role": "assistant", "content": blocks})

            tool_results = []
            for b in blocks:
                if b.type != "tool_use":
                    continue
                if b.name == "record_intake" and isinstance(b.input, dict):
                    self.intake.update({k: v for k, v in b.input.items() if k in INTAKE_PROPERTIES})
                    tool_results.append({"type": "tool_result", "tool_use_id": b.id, "content": "saved"})
                elif b.name == "end_call":
                    result.end_call = True
                    tool_results.append({"type": "tool_result", "tool_use_id": b.id, "content": "hanging up"})
                else:
                    tool_results.append({"type": "tool_result", "tool_use_id": b.id, "is_error": True,
                                         "content": "Unknown tool. Available: record_intake, end_call."})
            result.text = "".join(spoken).strip()
            if result.end_call or not tool_results:
                return result
            if result.text:
                # Already spoke this turn: send the tool results with the caller's next words.
                self.pending_tool_results = tool_results
                return result
            # Only tool calls so far: give the results back now and get the spoken reply.
            self.messages.append({"role": "user", "content": tool_results})
        return result

    async def close(self):
        try:
            await self.client.close()
        except Exception:
            pass


EXTRACT_INSTRUCTIONS = """Fill in the phone message form from this call between a CALLER and the \
Tinash Homecare Services virtual ASSISTANT. Use only what the caller said or confirmed; use "" for \
anything not mentioned. callback_number: digits only. relationship: how the person needing care is \
related to the caller (e.g. mother, son, self). service_needed: a short label such as \
"Daily Senior Care", "Companion Care", "Skilled Nursing", "Live-In & 24/7 Care", "Respite Care", \
"Individual Supports (DDD)", "Community-Based Supports (DDD)", "DDD Respite", "GUIDE Program", or the \
caller's words. questions_or_notes: one short sentence (questions the assistant couldn't answer, \
anything the team should know), or "".
"""


async def claude_extract(transcript: str, recorded: dict, schema: dict, usage: Usage) -> dict:
    """After-call structured extraction with Claude (output_config.format guarantees valid JSON)."""
    strict_schema = {**schema, "additionalProperties": False}
    client = _client()
    try:
        resp = await client.messages.create(
            model=settings.claude_model,
            max_tokens=1200,
            thinking={"type": "between_tools"},
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": strict_schema}},
            messages=[{
                "role": "user",
                "content": EXTRACT_INSTRUCTIONS
                + "\nDetails the assistant recorded during the call (may be incomplete):\n"
                + json.dumps(recorded, sort_keys=True)
                + "\n\nTranscript:\n" + transcript,
            }],
        )
    finally:
        await client.close()
    usage.add(resp.usage)
    if resp.stop_reason == "refusal":
        raise ClaudeUnavailable("extraction refused")
    text = next((b.text for b in resp.content if b.type == "text"), "")
    return json.loads(text)


async def warm_claude() -> float:
    """Write (or refresh) the prompt cache for the system prompt + tools.

    A cold first turn has to write ~2,500 tokens to the cache and can take 4-7 s;
    a warm one starts speaking in about 1-2 s. A cache read also renews the
    1-hour lifetime, so the server calls this every 50 minutes (about $0.0006 each).
    Returns seconds taken, or -1 on failure.
    """
    conv = ClaudeConversation()
    conv.messages = [{"role": "user", "content": "(Line check before calls. Reply with the single word OK.)"}]
    kw = conv._request_kwargs()
    kw["max_tokens"] = 16
    t0 = time.perf_counter()
    try:
        resp = await conv.client.beta.messages.create(**kw)
        conv.usage.add(resp.usage)
        logger.info(f"Claude warm-up {time.perf_counter() - t0:.1f}s, cache read {resp.usage.cache_read_input_tokens}, "
                    f"cost ${conv.usage.cost():.4f}")
        return time.perf_counter() - t0
    except Exception as e:
        logger.warning(f"Claude warm-up failed: {type(e).__name__}")
        return -1.0
    finally:
        await conv.close()
