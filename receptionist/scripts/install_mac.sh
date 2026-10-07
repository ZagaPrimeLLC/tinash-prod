#!/usr/bin/env bash
# Set up the receptionist on a Mac for trying it out (local mic mode and text mode).
# Run from the receptionist/ folder:   bash scripts/install_mac.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PY="${PYTHON:-python3}"
"$PY" -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ needed"'

command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
brew list portaudio >/dev/null 2>&1 || brew install portaudio   # for the microphone mode

[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/pip install -q --upgrade pip

if [ "$(uname -m)" = "x86_64" ]; then
  # Intel Mac: the newest onnxruntime and numba/llvmlite have no Intel-Mac builds,
  # so install the last versions that do, then Pipecat itself without its pins.
  .venv/bin/pip install -q "onnxruntime==1.23.2" "numba==0.61.2" "llvmlite==0.44.0"
  .venv/bin/pip install -q --no-deps "pipecat-ai==1.12.0"
  .venv/bin/pip install -q "aiofiles>=24.1,<27" "aiohttp>=3.11.12,<4" "docstring_parser>=0.16,<1" \
    "loguru~=0.7.3" "loudness>=0.2,<1" "Markdown>=3.7,<4" "sentencex==1.0.31" "numpy>=1.26.4,<3" \
    "Pillow>=11.1,<13" "protobuf>=5.29.6,<7" "pydantic>=2.10.6,<3" "python-dotenv>=1,<2" \
    "resampy~=0.4.3" "soundfile~=0.13.1" "soxr~=1.0.0" "openai>=1.74,<4" "typing_extensions>=4.9" \
    "websockets>=13.1" "pyyaml>=6,<7" "num2words>=0.5.14" \
    "faster-whisper~=1.2.1" "piper-tts>=1.3,<2" "requests>=2.32.5,<3" "fastapi>=0.115.6,<1" \
    "uvicorn>=0.32,<1" "httpx>=0.27,<1" "pytest>=8" "pyaudio~=0.2.14"
else
  .venv/bin/pip install -q -r requirements.txt "pipecat-ai[local]==1.12.0"
fi

.venv/bin/python scripts/download_models.py

if ! command -v ollama >/dev/null; then
  if [ "$(uname -m)" = "arm64" ]; then
    brew install ollama
  else
    echo
    echo "Ollama: Homebrew has no ready-made Intel build (it compiles for a long time)."
    echo "Download the Mac app from https://ollama.com/download instead, open it once,"
    echo "then re-run this script."
    exit 1
  fi
fi
ollama list >/dev/null 2>&1 || { echo "Start Ollama (open the Ollama app, or run: ollama serve) and re-run."; exit 1; }
ollama pull "${LLM_MODEL:-qwen2.5:3b}"

[ -f .env ] || cp .env.example .env
echo
echo "Done. Try it:"
echo "  .venv/bin/python -m receptionist.local --text     # type as the caller"
echo "  .venv/bin/python -m receptionist.local            # talk with the microphone"
