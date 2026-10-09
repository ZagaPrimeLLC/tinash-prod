"""Phone server: Telnyx webhook (TeXML), the call-audio WebSocket and a health check.

    python -m receptionist.server

Endpoints (behind Cloudflare Tunnel at e.g. https://voice.tinashhomecareservices.com):

    POST /texml/{token}   Telnyx asks what to do with a call; we answer with TeXML
                          that streams the call audio to /ws/{token}.
    POST /twiml/{token}   The same for Twilio (TwiML).
    WS   /ws/{token}      Telnyx or Twilio media stream; one Pipecat pipeline per call.
    GET  /health          Status for monitoring.

{token} is CALL_TOKEN from .env, a long random string, so strangers who find
the hostname cannot start calls or create fake leads.

With the CRM dashboard configured (SUPABASE_URL, SUPABASE_ANON_KEY,
DEVICE_TOKEN), each call uses the settings from the CRM's Phone Assistant
page, a heartbeat goes to the CRM every 60 seconds, and every call is logged
there (see dashboard.py).
"""

import asyncio
import contextlib
import hmac
import time
from xml.sax.saxutils import escape

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response, WebSocket
from loguru import logger
from pipecat.frames.frames import TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.telnyx import TelnyxFrameSerializer
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport
from pipecat.workers.runner import WorkerRunner

from .bot import (
    _whisper_model,
    preload_tts,
    init_mode,
    ollama_available,
    build_conversation,
    finish_call,
    make_stt,
    make_tts,
    voice_pipeline_processors,
    warm_up_llm,
)
from . import __version__
from .dashboard import CallConfig, cached_config, get_config, heartbeat, log_declined_call, report_call
from .prompts import DISABLED_MESSAGE, speakable_parts
from .session import CallSession, purge_old_transcripts
from .settings import claude_enabled, dashboard_enabled, settings

BUSY_MESSAGE = (
    "Thank you for calling Tinash Homecare Services. All of our lines are busy right now. "
    "Please call again in a few minutes, or visit tinash homecare services dot com. Goodbye."
)

state = {"active_calls": 0, "calls_total": 0, "started_at": time.time(), "llm_warm": False}


def _token_ok(token: str) -> bool:
    expected = settings.call_token
    return bool(expected) and hmac.compare_digest(token.encode(), expected.encode())


async def _daily_cleanup():
    while True:
        purge_old_transcripts(cached_config().retention_days)
        await asyncio.sleep(6 * 3600)


async def _status(cfg: CallConfig) -> dict:
    """What the CRM shows about this device (no caller details)."""
    ollama_ok = await ollama_available()
    claude_on = claude_enabled()
    return {
        "version": __version__,
        "brain": settings.claude_model if claude_on else f"ollama {settings.llm_model}",
        "voice": f"{cfg.voice_engine}/{cfg.voice}",
        "active_calls": state["active_calls"],
        "calls_since_start": state["calls_total"],
        "uptime_secs": int(time.time() - state["started_at"]),
        "health": "ok" if (claude_on or ollama_ok) else "degraded",
        "ollama": ollama_ok,
        "settings_from": cfg.source,
    }


async def _dashboard_loop():
    """Every 60 s: tell the CRM this device is alive and pick up changed settings,
    loading a newly chosen Kokoro voice between calls so the next call starts quickly."""
    while True:
        cfg = await get_config()
        if cfg.voice_engine == "kokoro" and state["active_calls"] == 0:
            try:
                await asyncio.to_thread(preload_tts, "kokoro")
            except Exception as e:
                logger.error(f"Could not load the Kokoro voice model: {e}")
        try:
            await heartbeat(await _status(cfg))
        except Exception as e:
            logger.warning(f"CRM heartbeat failed ({e})")
        await asyncio.sleep(60)


async def _keep_claude_warm():
    """Renew Claude's 1-hour prompt cache so the first words of a call come quickly."""
    from .claude_brain import warm_claude

    while claude_enabled():
        await asyncio.sleep(50 * 60)
        if state["active_calls"] == 0:
            await warm_claude(cached_config())


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.call_token:
        logger.warning("CALL_TOKEN is not set: the webhook and WebSocket will refuse all calls.")
    if dashboard_enabled():
        logger.info("CRM dashboard on: settings, test mode and the call log come from the CRM "
                    f"(DRY_RUN={'on' if settings.dry_run else 'off'} applies only if the CRM cannot be reached)")
        cfg = await get_config(timeout=5)
    else:
        logger.info(f"DRY_RUN={'on' if settings.dry_run else 'off'}; inquiries go to {settings.inquiry_url}")
        cfg = CallConfig()
    cleanup = asyncio.create_task(_daily_cleanup())
    # Load the speech and voice models and warm the LLM so the first call is quick.
    await asyncio.to_thread(_whisper_model)
    await asyncio.to_thread(preload_tts, cfg.voice_engine)

    async def _warm():
        state["llm_warm"] = await warm_up_llm() >= 0

    warm = asyncio.create_task(_warm())
    keep_warm = asyncio.create_task(_keep_claude_warm())
    beat = asyncio.create_task(_dashboard_loop()) if dashboard_enabled() else None
    yield
    cleanup.cancel()
    warm.cancel()
    keep_warm.cancel()
    if beat:
        beat.cancel()


app = FastAPI(title="Tinash phone receptionist", lifespan=lifespan, docs_url=None, redoc_url=None)


def texml(body: str) -> Response:
    xml = f'<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n{body}\n</Response>\n'
    return Response(content=xml, media_type="application/xml")


async def _form(request: Request) -> dict:
    try:
        return dict(await request.form())
    except Exception:
        return {}


async def _declined(carrier: str, form: dict) -> Response | None:
    """Turned off in the CRM: play the closed message, log the call, and hang up."""
    cfg = await get_config()
    if cfg.enabled:
        return None
    logger.info("Assistant is turned off in the CRM; playing the closed message")
    asyncio.create_task(log_declined_call(carrier, str(form.get("CallSid", "")), str(form.get("From", ""))))
    return texml(f"  <Say>{escape(DISABLED_MESSAGE)}</Say>\n  <Hangup/>")


@app.post("/texml/{token}")
async def texml_webhook(token: str, request: Request):
    if not _token_ok(token):
        return Response(status_code=404)
    # Also fetches the CRM settings, so they are fresh when the audio stream starts.
    declined = await _declined("telnyx", await _form(request)) if dashboard_enabled() else None
    if declined:
        return declined
    if state["active_calls"] >= settings.max_concurrent_calls:
        logger.warning("Call arrived while busy; playing the busy message")
        return texml(f"  <Say>{escape(BUSY_MESSAGE)}</Say>\n  <Hangup/>")
    stream_url = f"{settings.public_ws_url.rstrip('/')}/{token}"
    # After the stream ends (our bot hangs up or closes the socket), hang up.
    return texml(
        "  <Connect>\n"
        f'    <Stream url="{escape(stream_url)}" bidirectionalMode="rtp"></Stream>\n'
        "  </Connect>\n"
        "  <Hangup/>"
    )


@app.post("/twiml")
@app.post("/twiml/{token}")
async def twiml_webhook(request: Request, token: str = ""):
    """Twilio's version of the webhook. Twilio sends the caller in the form body
    and passes it on to the media stream as a custom parameter.

    Without the token in the URL, the request must come from our Twilio account
    (AccountSid). The media stream URL we hand back still carries the token."""
    form = await request.form()
    if token:
        if not _token_ok(token):
            return Response(status_code=404)
    elif not (settings.twilio_account_sid and form.get("AccountSid") == settings.twilio_account_sid):
        return Response(status_code=404)
    token = settings.call_token
    declined = await _declined("twilio", dict(form)) if dashboard_enabled() else None
    if declined:
        return declined
    if state["active_calls"] >= settings.max_concurrent_calls:
        logger.warning("Call arrived while busy; playing the busy message")
        return texml(f"  <Say>{escape(BUSY_MESSAGE)}</Say>\n  <Hangup/>")
    caller = str(form.get("From", ""))
    stream_url = f"{settings.public_ws_url.rstrip('/')}/{token}"
    return texml(
        "  <Connect>\n"
        f'    <Stream url="{escape(stream_url)}">\n'
        f'      <Parameter name="from_number" value="{escape(caller, {chr(34): "&quot;"})}"/>\n'
        "    </Stream>\n"
        "  </Connect>\n"
        "  <Hangup/>"
    )


@app.get("/health")
async def health():
    ollama_ok = await ollama_available(max_age=0)
    claude_on = claude_enabled()
    # With Claude as the brain, Ollama is only the offline fallback.
    ok = claude_on or ollama_ok
    return {
        "status": "ok" if ok else "degraded",
        "brain": settings.claude_model if claude_on else f"ollama {settings.llm_model}",
        "ollama": "ok" if ollama_ok else f"not available (model {settings.llm_model})"
        + (" - offline fallback limited to name and number" if claude_on else ""),
        "llm_warm": state["llm_warm"],
        "active_calls": state["active_calls"],
        "calls_since_start": state["calls_total"],
        "uptime_secs": int(time.time() - state["started_at"]),
        "dry_run": settings.dry_run,
        "crm_dashboard": "on" if dashboard_enabled() else "off",
        **({"crm_enabled": cached_config().enabled, "crm_test_mode": cached_config().test_mode}
           if dashboard_enabled() else {}),
        "version": __version__,
    }


@app.websocket("/ws/{token}")
async def media_stream(websocket: WebSocket, token: str):
    if not _token_ok(token):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        transport_type, call_data = await parse_telephony_websocket(websocket)
    except Exception as e:
        logger.error(f"Bad media stream handshake: {e}")
        await websocket.close()
        return
    if transport_type not in ("telnyx", "twilio"):
        logger.error(f"Unexpected stream type {transport_type}; only Telnyx and Twilio are supported")
        await websocket.close()
        return

    state["active_calls"] += 1
    state["calls_total"] += 1
    session = CallSession(mode="phone", caller_id=call_data.from_number or "")
    session.carrier, session.carrier_call_id = transport_type, call_data.call_id or ""
    # The CRM's settings for this call (cached; the webhook just refreshed them).
    cfg = await get_config()
    logger.info(f"Call {session.call_id} started ({transport_type.title()} call {call_data.call_id})")
    try:
        await run_call(websocket, call_data, session, transport_type, cfg)
    except Exception as e:
        logger.exception(f"Call {session.call_id} crashed: {e}")
        session.end_reason = session.end_reason or f"error: {e}"
    finally:
        state["active_calls"] -= 1
        # Intake + CRM log or website post + transcript save, then re-warm the LLM.
        asyncio.create_task(_after_call(session, cfg))


async def _after_call(session: CallSession, cfg: CallConfig):
    try:
        await finish_call(session, warm_after=True, config=cfg)
    except Exception as e:
        logger.exception(f"After-call processing failed for {session.call_id}: {e}")
        if dashboard_enabled():
            # Still put the call in the CRM, marked failed, with whatever was recorded.
            from .bot import _recorded_to_form
            from .intake import finalize_intake

            try:
                intake = finalize_intake(session, _recorded_to_form(getattr(session.claude, "intake", None) or {}))
            except Exception:
                intake = {}
            await report_call(session, intake, cfg, failed=True)


def make_serializer(call_data, transport_type: str):
    if transport_type == "twilio":
        creds = bool(settings.twilio_account_sid and settings.twilio_auth_token and call_data.call_id)
        # With credentials the bot hangs up through the Twilio API; without them
        # it closes the stream and the TwiML <Hangup/> ends the call.
        return TwilioFrameSerializer(
            stream_sid=call_data.stream_id,
            call_sid=call_data.call_id,
            account_sid=settings.twilio_account_sid or None,
            auth_token=settings.twilio_auth_token or None,
            params=TwilioFrameSerializer.InputParams(auto_hang_up=creds),
        )
    api_key = settings.telnyx_api_key or None
    return TelnyxFrameSerializer(
        stream_id=call_data.stream_id,
        outbound_encoding=call_data.outbound_encoding or "PCMU",
        inbound_encoding="PCMU",
        call_control_id=call_data.call_id,
        api_key=api_key,
        # With an API key the bot hangs up through the Telnyx API; without one
        # it closes the stream and the TeXML <Hangup/> ends the call.
        params=TelnyxFrameSerializer.InputParams(auto_hang_up=bool(api_key and call_data.call_id)),
    )


async def run_call(websocket: WebSocket, call_data, session: CallSession, transport_type: str = "telnyx",
                   cfg: CallConfig | None = None):
    cfg = cfg or CallConfig()
    serializer = make_serializer(call_data, transport_type)
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            serializer=serializer,
            session_timeout=settings.max_call_seconds,
            allowed_origins=[],
        ),
    )
    parts = build_conversation(session, text_mode=False, config=cfg)
    await init_mode(parts)
    stt, tts = make_stt(), make_tts(cfg)
    pipeline = Pipeline(voice_pipeline_processors(transport, parts, stt, tts))
    worker = PipelineWorker(
        pipeline,
        # Native 8 kHz phone audio: Silero VAD is far more reliable on it than on
        # upsampled audio (measured). The Whisper service resamples to 16 kHz itself.
        params=PipelineParams(audio_in_sample_rate=8000, audio_out_sample_rate=8000, enable_metrics=True),
        app_resources=parts.ctl,
        enable_rtvi=False,
        idle_timeout_secs=60,
    )
    runner = WorkerRunner(handle_sigint=False)

    @transport.event_handler("on_client_connected")
    async def on_connected(transport, client):
        await worker.queue_frames(
            [TTSSpeakFrame(part, append_to_context=False) for part in speakable_parts(cfg.greeting)]
        )

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(transport, client):
        if not parts.ctl.ending:
            session.end_reason = "caller hung up"
        await runner.cancel()

    @transport.event_handler("on_session_timeout")
    async def on_timeout(transport, client):
        await parts.ctl.end(parts.planner.push_frame, "call time limit", farewell=parts.ctl.checklist.closing_line())

    await runner.add_workers(worker)
    await runner.run()
    logger.info(f"Call {session.call_id} ended: {session.end_reason}")


def main():
    import os
    import sys

    # INFO by default: DEBUG logs include what callers say, and the system log
    # (journald) is not covered by the 30-day transcript cleanup.
    logger.remove()
    logger.add(sys.stderr, level=os.getenv("LOG_LEVEL", "INFO"))
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="info", proxy_headers=True)


if __name__ == "__main__":
    main()
