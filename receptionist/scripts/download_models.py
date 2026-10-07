"""Download the speech models into receptionist/models/ (run once).

    python scripts/download_models.py                  # base.en + small.en + the Piper voice
    python scripts/download_models.py --whisper base.en
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--whisper", nargs="*", default=["base.en", "small.en"])
    ap.add_argument("--voice", default="en_US-amy-medium")
    args = ap.parse_args()

    from faster_whisper import download_model
    from piper.download_voices import download_voice

    for name in args.whisper:
        out = ROOT / "models" / "whisper" / name
        print(f"Whisper {name} -> {out}", flush=True)
        download_model(name, output_dir=str(out))

    piper_dir = ROOT / "models" / "piper"
    piper_dir.mkdir(parents=True, exist_ok=True)
    if not (piper_dir / f"{args.voice}.onnx").exists():
        print(f"Piper voice {args.voice} -> {piper_dir}", flush=True)
        download_voice(args.voice, piper_dir)
    print("Models ready.")


if __name__ == "__main__":
    sys.exit(main())
