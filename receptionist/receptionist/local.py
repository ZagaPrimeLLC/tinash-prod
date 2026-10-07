"""Try the receptionist on this computer, without any phone account.

    python -m receptionist.local          talk with the microphone and speakers
    python -m receptionist.local --text   type as the caller (fast, no audio)

After the conversation the intake is extracted and, with DRY_RUN=true (the
default), the website payload is printed instead of sent.
"""

import argparse
import asyncio
import sys

from loguru import logger

from .settings import settings


async def run_text():
    from .textchat import TextConversation

    from .bot import warm_up_llm

    print("Loading the language model (the first time can take a minute)...", flush=True)
    await warm_up_llm()
    print("\nText mode. Type what the caller says. Type /quit (or press Ctrl-D) to hang up.\n")
    convo = TextConversation(caller_id="+19735550100")
    print(f"Assistant: {await convo.start()}")
    loop = asyncio.get_running_loop()
    while not convo.ended:
        try:
            line = await loop.run_in_executor(None, lambda: input("Caller: "))
        except (EOFError, KeyboardInterrupt):
            break
        if line.strip().lower() in ("/quit", "/exit", "/hangup"):
            break
        if not line.strip():
            continue
        reply = await convo.say(line)
        print(f"Assistant: {reply}")
        if convo.last_was_llm and convo.latencies:
            ttft, total = convo.latencies[-1]
            print(f"   [answered by the LLM: first words after {ttft:.1f}s, full reply after {total:.1f}s]")
    print("\nCall ended. Working out the intake...")
    intake, payload, result = await convo.close()
    import json

    print("Intake:", json.dumps(intake, indent=2))
    print("Website result:", result)


async def run_audio():
    from pipecat.frames.frames import TTSSpeakFrame
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.worker import PipelineParams, PipelineWorker
    from pipecat.transports.local.audio import LocalAudioTransport, LocalAudioTransportParams
    from pipecat.workers.runner import WorkerRunner

    from .bot import build_conversation, finish_call, make_stt, make_tts, voice_pipeline_processors
    from .prompts import GREETING
    from .session import CallSession

    from .bot import warm_up_llm

    print("Loading the language model (the first time can take a minute)...", flush=True)
    await warm_up_llm()
    session = CallSession(mode="local-audio", caller_id="local-mic")
    parts = build_conversation(session, text_mode=False)
    transport = LocalAudioTransport(
        LocalAudioTransportParams(audio_in_enabled=True, audio_out_enabled=True)
    )
    stt, tts = make_stt(), make_tts()
    pipeline = Pipeline(voice_pipeline_processors(transport, parts, stt, tts))
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000, audio_out_sample_rate=22050, enable_metrics=True
        ),
        app_resources=parts.ctl,
        enable_rtvi=False,
        idle_timeout_secs=settings.max_call_seconds,
    )
    runner = WorkerRunner(handle_sigint=True)
    await runner.add_workers(worker)
    await worker.queue_frames([TTSSpeakFrame(GREETING, append_to_context=False)])
    print("\nSpeak into the microphone. Press Ctrl-C to hang up. (Use headphones to avoid echo.)\n")
    await runner.run()
    print("\nCall ended. Working out the intake...")
    intake, payload, result = await finish_call(session)
    import json

    print("Intake:", json.dumps(intake, indent=2))
    print("Website result:", result)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", action="store_true", help="type as the caller instead of speaking")
    ap.add_argument("--verbose", action="store_true", help="show Pipecat debug logs")
    args = ap.parse_args()
    logger.remove()
    logger.add(sys.stderr, level="DEBUG" if args.verbose else "WARNING")
    print(f"DRY_RUN is {'ON (nothing is sent to the website)' if settings.dry_run else 'OFF (leads WILL be sent)'}")
    asyncio.run(run_text() if args.text else run_audio())


if __name__ == "__main__":
    main()
