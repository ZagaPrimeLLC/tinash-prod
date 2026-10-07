"""Text-only conversation: the real prompt, tools, guard, context and LLM, with typed caller lines.

Used by `python -m receptionist.local --text` and by the automated tests.
"""

import asyncio
import time

from pipecat.frames.frames import (
    TranscriptionFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.utils.time import time_now_iso8601
from pipecat.workers.runner import WorkerRunner

from .bot import build_conversation, finish_call
from .prompts import GREETING
from .session import CallSession


class TextConversation:
    def __init__(self, caller_id: str = ""):
        self.session = CallSession(mode="text", caller_id=caller_id)
        self.parts = build_conversation(self.session, text_mode=True)
        self.replies: list[str] = []
        self.latencies: list[tuple[float, float]] = []  # LLM replies: (first words, full reply) seconds
        self.scripted_latencies: list[float] = []  # scripted replies (no model call)
        self.parts.ctl.on_response = self._on_response
        p = self.parts
        self.pipeline = Pipeline(
            [p.user_aggregator, p.planner, p.llm, p.tap, p.assistant_aggregator]
        )
        self.worker = PipelineWorker(
            self.pipeline,
            params=PipelineParams(enable_metrics=True),
            app_resources=p.ctl,
            enable_rtvi=False,
            idle_timeout_secs=None,
        )
        self.runner = WorkerRunner(handle_sigint=False)
        self._run_task: asyncio.Task | None = None
        self._pending: list[str] = []
        self.last_was_llm = False

    def _on_response(self, text: str, ttft: float, total: float, from_llm: bool):
        self._pending.append(text)
        self.replies.append(text)
        if from_llm:
            self.last_was_llm = True
            self.latencies.append((ttft, total))
        elif len(self._pending) == 1:
            self.scripted_latencies.append(total)

    @property
    def ended(self) -> bool:
        return self.parts.ctl.ending or (self._run_task is not None and self._run_task.done())

    async def start(self) -> str:
        await self.runner.add_workers(self.worker)
        self._run_task = asyncio.create_task(self.runner.run())
        await asyncio.sleep(0.3)
        return GREETING

    async def say(self, line: str, timeout: float = 120) -> str:
        """Send one caller line and return the assistant's reply (all text produced for this turn)."""
        if self.ended:
            return ""
        self._pending = []
        self.last_was_llm = False
        tap = self.parts.tap
        tap.response_done.clear()
        tap.turn_started_at = time.perf_counter()
        await self.worker.queue_frames([UserStartedSpeakingFrame()])
        await self.worker.queue_frames(
            [TranscriptionFrame(text=line, user_id="caller", timestamp=time_now_iso8601())]
        )
        await asyncio.sleep(0.05)
        await self.worker.queue_frames([UserStoppedSpeakingFrame()])

        deadline = time.monotonic() + timeout
        # Wait for the first full reply, then let any tool-call follow-up settle.
        while time.monotonic() < deadline and not self._run_task.done():
            try:
                await asyncio.wait_for(tap.response_done.wait(), timeout=0.5)
            except asyncio.TimeoutError:
                continue
            if self._pending:
                await asyncio.sleep(0.3)
                if not tap.in_response:
                    break
            tap.response_done.clear()
        if self.parts.ctl.ending:
            # Let the farewell and end frame flush.
            try:
                await asyncio.wait_for(asyncio.shield(self._run_task), timeout=10)
            except asyncio.TimeoutError:
                pass
        return " ".join(self._pending).strip()

    async def close(self):
        """End the call (if still open) and run the after-call steps."""
        if self._run_task and not self._run_task.done():
            if not self.parts.ctl.ending:
                self.session.end_reason = self.session.end_reason or "caller hung up (text mode)"
            await self.runner.cancel()
            try:
                await asyncio.wait_for(self._run_task, timeout=10)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
        return await finish_call(self.session)
