"""The conversation pipeline, shared by the phone server, local audio mode and text mode.

Voice pipeline (phone and local audio):

    transport in -> Whisper STT -> user context -> Planner -> Ollama LLM
        -> ResponseTap -> Piper TTS -> transport out -> assistant context

Text mode is the same chain without the transport, STT and TTS.

The Planner (see checklist.py) runs the intake script in code. It answers
plain answers instantly with the next question, and only sends the turn to the
LLM when the caller asks something. The LLM's answer is followed by the next
scripted question.
"""

import asyncio
import functools
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    EndWorkerFrame,
    Frame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSSpeakFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.ollama.llm import OLLamaLLMService
from pipecat.turns.user_turn_strategies import ExternalUserTurnStrategies

from .checklist import STILL_THERE, Checklist, Plan
from .prompts import FAREWELL, GREETING, system_prompt
from .session import EMERGENCY_RE, CallSession
from .settings import settings

USER_IDLE_SECS = 12.0


@dataclass
class CallControl:
    """Per-call state shared by the processors (also given to the worker as app_resources)."""

    session: CallSession
    text_mode: bool = False
    checklist: Checklist = field(default_factory=Checklist)
    ending: bool = False
    idle_prompts: int = 0
    then_say: str = ""          # scripted question to speak after the LLM's answer
    end_after_llm: bool = False
    deferred_assistant: str = ""  # scripted text to add to the LLM context next turn
    on_response: Callable[[str, float, float, bool], None] | None = None  # text-mode hook

    async def end(self, push: Callable, reason: str, farewell: str | None = None):
        """Say the closing words and end the call gracefully (queued audio finishes first)."""
        if self.ending:
            return
        self.ending = True
        self.session.end_reason = reason
        logger.info(f"Ending call: {reason}")
        if farewell:
            await push(TTSSpeakFrame(farewell, append_to_context=False))
        await push(EndWorkerFrame(reason=reason))


def _text_of(message: dict) -> str:
    c = message.get("content", "")
    if isinstance(c, list):
        return " ".join(p.get("text", "") for p in c if isinstance(p, dict))
    return str(c or "")


class Planner(FrameProcessor):
    """Sits between the user context aggregator and the LLM; decides each reply."""

    def __init__(self, ctl: CallControl):
        super().__init__()
        self._ctl = ctl

    async def speak(self, text: str, *, record: bool = True):
        ctl = self._ctl
        if record:
            ctl.session.add("assistant", text)
        await self.push_frame(TTSSpeakFrame(text, append_to_context=False))

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        ctl = self._ctl
        if not (
            isinstance(frame, LLMContextFrame)
            and direction == FrameDirection.DOWNSTREAM
            and not getattr(frame, "speculation", False)
        ):
            await self.push_frame(frame, direction)
            return
        if ctl.ending:
            return
        context = frame.context
        messages = context.get_messages()
        if not messages or messages[-1].get("role") != "user" or not _text_of(messages[-1]).strip():
            # A turn with no words (noise, or an interruption with nothing said):
            # repeat the current question instead of letting the model improvise.
            if ctl.checklist.user_turns:
                await self.speak(ctl.checklist.reask())
            return

        ctl.idle_prompts = 0
        text = _text_of(messages[-1])
        if ctl.deferred_assistant:
            # Keep the LLM's view of the conversation complete: add the scripted
            # question spoken after its last answer, just before the new user line.
            messages.insert(-1, {"role": "assistant", "content": ctl.deferred_assistant})
            ctl.deferred_assistant = ""
            context.set_messages(messages)
            messages = context.get_messages()

        emergency = bool(EMERGENCY_RE.search(text))
        if emergency:
            logger.warning("Possible emergency mentioned by caller")
            ctl.session.emergency_flagged = True
        plan: Plan = ctl.checklist.plan(text, emergency=emergency)

        if plan.llm_instruction:
            # Ask the model about this one sentence only. The request starts with
            # the same system prompt + greeting as the warm-up, so Ollama's prompt
            # cache already holds them and only the new sentence has to be read.
            # (The model's answer is still recorded in the main context.)
            earlier = ctl.checklist.previous_question
            question_ctx = LLMContext(
                messages=[
                    {"role": "assistant", "content": GREETING},
                    {
                        "role": "user",
                        "content": (f'(Earlier the assistant asked: "{earlier}")\n' if earlier else "")
                        + f'The caller said: "{text}"\n\n({plan.llm_instruction})',
                    },
                ]
            )
            ctl.then_say = plan.then_say
            ctl.end_after_llm = plan.end
            await self.push_frame(LLMContextFrame(context=question_ctx), direction)
            return

        # Scripted reply, no model call.
        context.add_message({"role": "assistant", "content": plan.say})
        if plan.end:
            ctl.session.add("assistant", plan.say)
            await ctl.end(self.push_frame, "intake complete", farewell=plan.say)
        else:
            await self.speak(plan.say)


class ResponseTap(FrameProcessor):
    """After the LLM: times replies, then speaks the scripted follow-up question."""

    def __init__(self, ctl: CallControl):
        super().__init__()
        self._ctl = ctl
        self._buf: list[str] = []
        self._t_first = 0.0
        self.turn_started_at = 0.0  # set by text mode when a caller line is sent
        self.in_response = False
        self.response_done = asyncio.Event()

    def _report(self, text: str, ttft: float, total: float, from_llm: bool):
        if self._ctl.on_response:
            self._ctl.on_response(text, ttft, total, from_llm)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        ctl = self._ctl
        if isinstance(frame, LLMFullResponseStartFrame):
            self.in_response = True
            self._buf = []
            self._t_first = 0.0
        elif isinstance(frame, LLMTextFrame):
            if not self._t_first:
                self._t_first = time.perf_counter()
            self._buf.append(frame.text)
        elif isinstance(frame, TTSSpeakFrame):
            base = self.turn_started_at or time.perf_counter()
            self._report(frame.text, 0.0, time.perf_counter() - base, False)
            await self.push_frame(frame, direction)
            if ctl.text_mode and not self.in_response:
                self.response_done.set()
            return
        elif isinstance(frame, LLMFullResponseEndFrame):
            text = "".join(self._buf).strip()
            self.in_response = False
            if text:
                ctl.session.add("assistant", text)
                base = self.turn_started_at or time.perf_counter()
                ttft = (self._t_first - base) if self._t_first else 0.0
                self._report(text, ttft, time.perf_counter() - base, True)
            await self.push_frame(frame, direction)
            follow, ctl.then_say = ctl.then_say, ""
            if follow:
                self._report(follow, 0.0, 0.0, False)
                ctl.deferred_assistant = follow
                ctl.session.add("assistant", follow)
                if ctl.end_after_llm:
                    ctl.end_after_llm = False
                    await ctl.end(self.push_frame, "intake complete", farewell=follow)
                else:
                    await self.push_frame(TTSSpeakFrame(follow, append_to_context=False))
            self.response_done.set()
            return
        await self.push_frame(frame, direction)


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


def make_llm() -> OLLamaLLMService:
    return OLLamaLLMService(
        base_url=settings.ollama_base_url,
        settings=OLLamaLLMService.Settings(
            model=settings.llm_model,
            system_instruction=system_prompt(),
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        ),
    )


@functools.lru_cache(maxsize=1)
def _whisper_model():
    from faster_whisper import WhisperModel

    logger.info(f"Loading Whisper model {settings.whisper_model} ({settings.whisper_compute_type})")
    return WhisperModel(settings.whisper_model, device="cpu", compute_type=settings.whisper_compute_type)


def _dump_segment(pcm: bytes, sample_rate: int, text: str):
    """Debug aid (STT_DEBUG_DIR): save each speech segment the recognizer got, with its text."""
    import wave

    d = settings.data_dir / settings.stt_debug_dir
    d.mkdir(parents=True, exist_ok=True)
    stem = d / f"{time.strftime('%H%M%S')}-{int(time.time() * 1000) % 1000:03d}"
    with wave.open(str(stem) + ".wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)
    (stem.with_suffix(".txt")).write_text(text)


def make_stt():
    """Pipecat's WhisperSTTService, sharing one loaded model across calls and with
    decoding options tuned for short phone sentences."""
    import numpy as np
    from pipecat.frames.frames import ErrorFrame, TranscriptionFrame
    from pipecat.services.whisper.stt import WhisperSTTService
    from pipecat.transcriptions.language import Language
    from pipecat.utils.time import time_now_iso8601

    class SharedWhisperSTTService(WhisperSTTService):
        def _load(self):
            self._model = _whisper_model()

        async def run_stt(self, audio: bytes):
            if not self._model:
                yield ErrorFrame("Whisper model not available")
                return
            await self.start_processing_metrics()
            audio_float = np.frombuffer(audio, dtype=np.int16).astype(np.float32) / 32768.0
            if self.sample_rate != 16000:
                # Phone calls run the pipeline at 8 kHz (the VAD works much better
                # on native phone audio); Whisper needs 16 kHz.
                import soxr

                audio_float = soxr.resample(audio_float, self.sample_rate, 16000)

            def _transcribe():
                segments, _ = self._model.transcribe(
                    audio_float,
                    language="en",
                    beam_size=settings.whisper_beam_size,
                    # No hotwords and no carry-over between segments: both caused
                    # hallucinations ("New York, New York...") on short phone audio.
                    condition_on_previous_text=False,
                    without_timestamps=True,
                )
                return " ".join(
                    seg.text.strip() for seg in segments if seg.no_speech_prob < 0.6
                ).strip()

            text = await asyncio.to_thread(_transcribe)
            if settings.stt_debug_dir:
                _dump_segment(audio, self.sample_rate, text)
            await self.stop_processing_metrics()
            if text:
                logger.debug(f"Transcription: [{text}]")
                yield TranscriptionFrame(text, self._user_id, time_now_iso8601(), Language.EN)

    return SharedWhisperSTTService(
        device="cpu",
        compute_type=settings.whisper_compute_type,
        settings=WhisperSTTService.Settings(model=settings.whisper_model, language=Language.EN),
    )


def make_tts():
    from pipecat.services.piper.tts import PiperTTSService

    return PiperTTSService(
        download_dir=settings.piper_dir,
        settings=PiperTTSService.Settings(voice=settings.piper_voice),
    )


def make_vad() -> SileroVADAnalyzer:
    # stop_secs: how long a pause counts as the end of a sentence (the smart-turn
    # model then decides whether the caller is really done talking).
    return SileroVADAnalyzer(params=VADParams(stop_secs=0.3))


# ---------------------------------------------------------------------------
# Context + processors shared by every mode
# ---------------------------------------------------------------------------


@dataclass
class ConversationParts:
    ctl: CallControl
    context: LLMContext
    user_aggregator: object
    assistant_aggregator: object
    planner: Planner
    llm: OLLamaLLMService
    tap: ResponseTap


def build_conversation(session: CallSession, *, text_mode: bool) -> ConversationParts:
    ctl = CallControl(session=session, text_mode=text_mode)
    from .checklist import digits_of

    ctl.checklist.caller_id = digits_of(session.caller_id or "")
    session.checklist = ctl.checklist
    context = LLMContext(messages=[{"role": "assistant", "content": GREETING}])
    if text_mode:
        user_params = LLMUserAggregatorParams(user_turn_strategies=ExternalUserTurnStrategies())
    else:
        user_params = LLMUserAggregatorParams(vad_analyzer=make_vad(), user_idle_timeout=USER_IDLE_SECS)
    pair = LLMContextAggregatorPair(context, user_params=user_params)
    user_agg, assistant_agg = pair.user(), pair.assistant()
    planner = Planner(ctl)

    @user_agg.event_handler("on_user_turn_stopped")
    async def _on_user(aggregator, strategy, message):
        session.add("user", message.content or "")

    @user_agg.event_handler("on_user_turn_idle")
    async def _on_idle(aggregator):
        if ctl.ending:
            return
        ctl.idle_prompts += 1
        if ctl.idle_prompts == 1:
            await planner.speak(STILL_THERE)
        else:
            farewell = ctl.checklist.closing_line() if ctl.checklist.phone_digits else FAREWELL
            session.add("assistant", farewell)
            await ctl.end(planner.push_frame, "caller silent", farewell=farewell)

    session.add("assistant", GREETING)
    return ConversationParts(
        ctl=ctl,
        context=context,
        user_aggregator=user_agg,
        assistant_aggregator=assistant_agg,
        planner=planner,
        llm=make_llm(),
        tap=ResponseTap(ctl),
    )


def voice_pipeline_processors(transport, parts: ConversationParts, stt, tts) -> list:
    return [
        transport.input(),
        stt,
        parts.user_aggregator,
        parts.planner,
        parts.llm,
        parts.tap,
        tts,
        transport.output(),
        parts.assistant_aggregator,
    ]


async def finish_call(session: CallSession, warm_after: bool = False) -> tuple[dict, dict | None, str]:
    """After a call: extract the intake, send it to the website (or print it in DRY_RUN), save the transcript locally."""
    from .intake import build_inquiry_payload, extract_intake, send_inquiry
    from .session import purge_old_transcripts, save_call

    session.ended_at = session.ended_at or time.time()
    intake = await extract_intake(session)
    payload = None
    result = "skipped: caller said nothing"
    if any(m["role"] == "user" for m in session.transcript):
        payload = build_inquiry_payload(session, intake)
        result = await send_inquiry(payload)
    save_call(session, intake, payload, result)
    purge_old_transcripts()
    if warm_after:
        await warm_up_llm()
    return intake, payload, result


async def warm_up_llm() -> float:
    """Load the model and pre-read the system prompt so the first caller question is fast.

    Sends the same opening messages Pipecat sends ([system prompt, greeting]),
    so Ollama's prompt cache holds them. Run at server start and after each
    call (the after-call intake extraction replaces the cache).
    """
    import httpx

    t0 = time.perf_counter()
    body = {
        "model": settings.llm_model,
        "messages": [
            {"role": "system", "content": system_prompt()},
            {"role": "assistant", "content": GREETING},
            {"role": "user", "content": "Hello."},
        ],
        "max_tokens": 1,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            r = await client.post(f"{settings.ollama_base_url.rstrip('/')}/chat/completions", json=body)
            r.raise_for_status()
    except Exception as e:
        logger.error(f"LLM warm-up failed (is Ollama running?): {e}")
        return -1.0
    secs = time.perf_counter() - t0
    logger.info(f"LLM warm-up took {secs:.1f}s")
    return secs
