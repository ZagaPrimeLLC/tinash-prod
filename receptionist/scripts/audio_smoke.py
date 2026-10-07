"""Audio stack check: Piper speaks a sentence, Whisper transcribes it back.

    python scripts/audio_smoke.py

Also runs the same audio through phone quality (8 kHz mu-law, like a real
call) to show what the speech recognizer hears on the phone. Prints timings.
"""

import audioop  # deprecated in 3.13 but present in 3.12; only used for this check
import sys
import time
import wave
from pathlib import Path

import numpy as np
import soxr

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from receptionist.settings import settings  # noqa: E402

SENTENCES = [
    "Hi, my name is Maria Gonzalez and I need care for my mother in Montclair.",
    "My number is nine seven three, five five five, zero one four two.",
]


def main():
    from faster_whisper import WhisperModel
    from piper import PiperVoice

    out_dir = settings.data_dir / "smoke"
    out_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    voice = PiperVoice.load(str(settings.piper_dir / f"{settings.piper_voice}.onnx"))
    t_piper_load = time.perf_counter() - t0
    t0 = time.perf_counter()
    model = WhisperModel(settings.whisper_model, device="cpu", compute_type=settings.whisper_compute_type)
    t_whisper_load = time.perf_counter() - t0
    print(f"Load: Piper {t_piper_load:.2f}s, Whisper {t_whisper_load:.2f}s ({settings.whisper_model}, {settings.whisper_compute_type})")

    for i, text in enumerate(SENTENCES):
        t0 = time.perf_counter()
        first = None
        chunks = []
        for chunk in voice.synthesize(text):
            if first is None:
                first = time.perf_counter() - t0
            chunks.append(chunk.audio_int16_bytes)
        t_tts = time.perf_counter() - t0
        pcm = b"".join(chunks)
        sr = voice.config.sample_rate
        dur = len(pcm) / 2 / sr
        wav_path = out_dir / f"smoke_{i}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(sr)
            w.writeframes(pcm)

        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        audio16 = soxr.resample(audio, sr, 16000)
        t0 = time.perf_counter()
        segs, _ = model.transcribe(audio16, language="en", beam_size=5)
        heard = " ".join(s.text.strip() for s in segs)
        t_stt = time.perf_counter() - t0

        # Phone quality: 8 kHz mu-law and back, then 16 kHz for Whisper.
        a8 = soxr.resample(audio, sr, 8000)
        pcm8 = (np.clip(a8, -1, 1) * 32767).astype(np.int16).tobytes()
        back = audioop.ulaw2lin(audioop.lin2ulaw(pcm8, 2), 2)
        a_phone = soxr.resample(np.frombuffer(back, dtype=np.int16).astype(np.float32) / 32768.0, 8000, 16000)
        t0 = time.perf_counter()
        segs, _ = model.transcribe(a_phone, language="en", beam_size=5)
        heard_phone = " ".join(s.text.strip() for s in segs)
        t_stt_phone = time.perf_counter() - t0

        print(f"\nSentence {i + 1}: {text}")
        print(f"  Piper: {dur:.1f}s of audio in {t_tts:.2f}s (first audio after {first:.2f}s, {dur / t_tts:.1f}x real time) -> {wav_path}")
        print(f"  Whisper (clean 16k): {t_stt:.2f}s -> {heard}")
        print(f"  Whisper (phone 8k mu-law): {t_stt_phone:.2f}s -> {heard_phone}")


if __name__ == "__main__":
    main()
