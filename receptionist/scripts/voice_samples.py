"""Render the same lines with several voices so the office can pick one by ear.

Each voice is written twice to data/voice-samples/: a clean copy and a
"phone" copy (8 kHz mu-law, the way callers actually hear it).

    .venv/bin/python scripts/voice_samples.py
"""

import audioop
import time
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "voice-samples"

TEXT = (
    "Thank you for calling Tinash Homecare Services. This is the Tinash virtual assistant. "
    "How can I help you today? "
    "Of course, I can help with that. Could I start with your name, please?"
)

KOKORO_VOICES = ["af_heart", "af_bella", "af_sarah", "af_nicole", "am_michael"]
PIPER_VOICES = ["en_US-amy-medium", "en_US-lessac-high", "en_US-hfc_female-medium"]


def write_wav(path: Path, audio: np.ndarray, rate: int) -> None:
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def phone_copy(audio: np.ndarray, rate: int) -> np.ndarray:
    """Down to 8 kHz mu-law and back, as Telnyx carries it."""
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes()
    pcm8, _ = audioop.ratecv(pcm, 2, 1, rate, 8000, None)
    pcm8 = audioop.ulaw2lin(audioop.lin2ulaw(pcm8, 2), 2)
    return np.frombuffer(pcm8, dtype=np.int16).astype(np.float32) / 32767


def save(name: str, audio: np.ndarray, rate: int, secs: float) -> None:
    write_wav(OUT / f"{name}.wav", audio, rate)
    write_wav(OUT / f"{name}-phone.wav", phone_copy(audio, rate), 8000)
    print(f"{name:28s} {len(audio) / rate:5.1f}s audio, rendered in {secs:4.1f}s")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(ROOT / "models/kokoro/kokoro-v1.0.onnx"), str(ROOT / "models/kokoro/voices-v1.0.bin"))
    for voice in KOKORO_VOICES:
        t = time.time()
        audio, rate = kokoro.create(TEXT, voice=voice, speed=1.0)
        save(f"kokoro-{voice}", audio, rate, time.time() - t)

    from piper import PiperVoice

    for voice in PIPER_VOICES:
        pv = PiperVoice.load(str(ROOT / f"models/piper/{voice}.onnx"))
        t = time.time()
        chunks = list(pv.synthesize(TEXT))
        audio = np.concatenate([c.audio_float_array for c in chunks])
        save(f"piper-{voice}", audio, chunks[0].sample_rate, time.time() - t)

    print(f"\nSamples in {OUT}")


if __name__ == "__main__":
    main()
