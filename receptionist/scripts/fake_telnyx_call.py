"""End-to-end phone test without a phone: pretends to be Telnyx.

Connects to the running server's media WebSocket exactly like Telnyx does
(connected/start events, then 8 kHz mu-law audio), speaks caller lines made
with Piper, waits for the bot to answer, and measures how long the caller
waits after finishing a sentence until the bot starts talking.

    CALL_TOKEN=... python -m receptionist.server        (in one terminal, DRY_RUN=true)
    CALL_TOKEN=... python scripts/fake_telnyx_call.py   (in another)
"""

import asyncio
import audioop  # present in Python 3.12; only used by this test tool
import base64
import json
import os
import sys
import time
import wave
from pathlib import Path

import numpy as np
import soxr
import websockets

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from receptionist.settings import settings  # noqa: E402

URL = os.getenv("FAKE_CALL_URL", f"ws://127.0.0.1:{settings.port}/ws/{os.getenv('CALL_TOKEN', '')}")
CALLER_VOICE = os.getenv("CALLER_VOICE", settings.piper_voice)

LINES = [
    "Hi, I need help at home for my mother. She lives in Montclair.",
    "My name is Maria Gonzalez.",
    "It's nine seven three, five five five, zero one four two.",
    "Yes, that's right.",
    "How much does it cost?",
    "She needs help with bathing and meals. Personal care.",
    "We would pay privately.",
    "Within two weeks.",
    "Weekday mornings.",
]

FRAME = 160  # 20 ms of 8 kHz mu-law


def synth_ulaw(voice, text: str) -> bytes:
    pcm = b"".join(c.audio_int16_bytes for c in voice.synthesize(text))
    a = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    a8 = soxr.resample(a, voice.config.sample_rate, 8000)
    return audioop.lin2ulaw((np.clip(a8, -1, 1) * 32767).astype(np.int16).tobytes(), 2)


async def main():
    from piper import PiperVoice

    voice = PiperVoice.load(str(settings.piper_dir / f"{CALLER_VOICE}.onnx"))
    caller_audio = [synth_ulaw(voice, line) for line in LINES]
    silence = b"\xff" * FRAME

    bot_audio = bytearray()
    last_bot_media = 0.0
    playback_end = 0.0  # when a real phone would finish playing what the bot sent
    first_bot_media_after: list[float] = []
    waiting_since = None
    closed = asyncio.Event()

    async with websockets.connect(URL, max_size=None) as ws:
        await ws.send(json.dumps({"event": "connected", "version": "1.0.0"}))
        await ws.send(json.dumps({
            "event": "start",
            "sequence_number": "1",
            "stream_id": "fake-stream-1",
            "start": {
                "call_control_id": "v3:fake-call",
                "from": "+19735550100",
                "to": "+19736368328",
                "media_format": {"encoding": "PCMU", "sample_rate": 8000, "channels": 1},
            },
        }))

        async def reader():
            nonlocal last_bot_media, waiting_since, playback_end
            try:
                async for msg in ws:
                    data = json.loads(msg)
                    if data.get("event") == "media":
                        now = time.perf_counter()
                        if waiting_since is not None:
                            first_bot_media_after.append(now - waiting_since)
                            waiting_since = None
                        last_bot_media = now
                        chunk = base64.b64decode(data["media"]["payload"])
                        playback_end = max(playback_end, now) + len(chunk) / 8000
                        bot_audio.extend(chunk)
                    elif data.get("event") == "clear":
                        playback_end = time.perf_counter()
            except websockets.ConnectionClosed:
                pass
            closed.set()

        async def send_audio(chunk: bytes):
            for i in range(0, len(chunk), FRAME):
                if closed.is_set():
                    return
                part = chunk[i:i + FRAME].ljust(FRAME, b"\xff")
                try:
                    await ws.send(json.dumps({"event": "media", "media": {"payload": base64.b64encode(part).decode()}}))
                except websockets.ConnectionClosed:
                    closed.set()  # the bot hung up
                    return
                await asyncio.sleep(0.02)

        async def wait_bot_quiet(max_wait=90.0):
            """Keep streaming silence until the bot has spoken and gone quiet for 1.2 s."""
            start = time.perf_counter()
            while time.perf_counter() - start < max_wait and not closed.is_set():
                await send_audio(silence * 5)
                now = time.perf_counter()
                if last_bot_media and waiting_since is None and now - last_bot_media > 1.2 and now > playback_end + 0.6:
                    return

        rtask = asyncio.create_task(reader())
        t_call = time.perf_counter()
        await wait_bot_quiet()  # greeting
        for line, audio in zip(LINES, caller_audio):
            if closed.is_set():
                break
            print(f"[{time.strftime('%H:%M:%S')}] Caller: {line}", flush=True)
            await send_audio(audio)
            waiting_since = time.perf_counter()
            await wait_bot_quiet()
            if first_bot_media_after:
                print(f"   bot started answering {first_bot_media_after[-1]:.2f}s after the caller stopped", flush=True)
        # Wait for the hang-up
        for _ in range(300):
            if closed.is_set():
                break
            await send_audio(silence * 5)
        print(f"Call lasted {time.perf_counter() - t_call:.0f}s; server closed the stream: {closed.is_set()}")
        rtask.cancel()

    out = settings.data_dir / "smoke" / "fake_call_bot_audio.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(audioop.ulaw2lin(bytes(bot_audio), 2))
    print(f"Bot audio saved to {out}")
    if first_bot_media_after:
        lat = first_bot_media_after
        import statistics

        print(f"Caller-stops-to-bot-starts: min {min(lat):.2f}s, median {statistics.median(lat):.2f}s, "
              f"avg {sum(lat) / len(lat):.2f}s, max {max(lat):.2f}s over {len(lat)} turns")


if __name__ == "__main__":
    asyncio.run(main())
