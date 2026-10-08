#!/usr/bin/env bash
# Install the Tinash phone receptionist on a Raspberry Pi 5 (Raspberry Pi OS 64-bit).
#
#   cd ~/tinash-prod/receptionist && bash deploy/install_pi.sh
#
# Safe to run again (it skips what is already done). Needs internet and sudo.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
APP_USER="$(id -un)"
MODEL="${LLM_MODEL:-qwen2.5:3b}"

echo "== 1/7 System packages"
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-dev build-essential curl git openssl \
  libsndfile1 ca-certificates

echo "== 2/7 Python environment"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

echo "== 3/7 Ollama (optional: offline fallback when Claude is unreachable)"
# Claude is the conversation brain. Ollama only takes over if the internet or
# the Claude API is down; without it the assistant still takes a name and
# number. Install it with:  INSTALL_OLLAMA=1 bash deploy/install_pi.sh
if [ "${INSTALL_OLLAMA:-0}" = "1" ]; then
  if ! command -v ollama >/dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  # Keep the model loaded, give it room for the fact sheet, and keep it offline.
  sudo mkdir -p /etc/systemd/system/ollama.service.d
  printf '%s\n' '[Service]' \
    'Environment="OLLAMA_HOST=127.0.0.1:11434"' \
    'Environment="OLLAMA_CONTEXT_LENGTH=8192"' \
    'Environment="OLLAMA_KEEP_ALIVE=-1"' \
    'Environment="OLLAMA_NUM_PARALLEL=1"' \
    'Environment="OLLAMA_NO_CLOUD=1"' \
    | sudo tee /etc/systemd/system/ollama.service.d/tinash.conf >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable --now ollama
  sudo systemctl restart ollama
  for i in $(seq 1 30); do curl -sf http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 2; done
  echo "== 4/7 Local fallback model ($MODEL, about 2 GB)"
  ollama pull "$MODEL"
else
  echo "Skipping Ollama. (Set INSTALL_OLLAMA=1 to add the offline fallback.)"
  echo "== 4/7 (no local model)"
fi

echo "== 5/7 Speech models (Whisper base.en + small.en, Piper voice, Kokoro voice)"
.venv/bin/python scripts/download_models.py
mkdir -p models/kokoro
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -f "models/kokoro/$f" ] || curl -fL -o "models/kokoro/$f" \
    "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done

echo "== 6/7 Settings (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^CALL_TOKEN=.*/CALL_TOKEN=$(openssl rand -hex 24)/" .env
  sed -i "s/^LLM_MODEL=.*/LLM_MODEL=$MODEL/" .env
  echo "Created .env with a new CALL_TOKEN. DRY_RUN is true until you change it."
  echo "Now add your Claude API key:  nano .env   (the ANTHROPIC_API_KEY= line)"
fi
chmod 600 .env
mkdir -p data && chmod 700 data

echo "== 7/7 Service (starts at boot, restarts if it stops)"
sed -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__APP_USER__#$APP_USER#g" deploy/tinash-receptionist.service \
  | sudo tee /etc/systemd/system/tinash-receptionist.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now tinash-receptionist
sleep 15
curl -s http://127.0.0.1:8765/health || true
echo
echo "Installed. Next: set up the Cloudflare Tunnel (README step 3) and point Telnyx at it."
echo "Logs:   journalctl -u tinash-receptionist -f"
echo "Webhook path for Telnyx: /texml/$(grep ^CALL_TOKEN= .env | cut -d= -f2)"
