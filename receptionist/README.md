# Tinash phone receptionist

A virtual receptionist that answers Tinash Homecare Services calls when nobody
in the office can pick up. It runs on a small computer in the office (a
Raspberry Pi 5), not in the cloud: the speech recognition, the language model
and the voice all run on that box.

## What it does

1. A call to the main number that is not answered (busy, no answer, phone
   off, after hours) is forwarded by T-Mobile to a Telnyx phone number.
2. Telnyx sends the call audio over the internet to the Pi, through a free
   Cloudflare Tunnel.
3. The assistant greets the caller: *"Thank you for calling Tinash Homecare
   Services. This is the Tinash virtual assistant. Calls may be noted so our
   team can follow up. How can I help?"*
4. It takes a message one question at a time:
   - **Families:** name, callback number (read back digit by digit), who needs
     care and how they are related, the kind of help, town and county, how
     care would be paid for, how soon, and the best time to call back.
   - **Job seekers:** name, number, the role they want (caregiver, DSP or
     nurse) and town, and points them to the Careers page.
5. It answers simple questions from the fact sheet (`config/facts.md`): the
   services, the counties served, office hours, the website, the free in-home
   assessment and the GUIDE dementia program. It never quotes prices, never
   promises a start date and never decides whether someone qualifies.
   If a caller describes an emergency it tells them to hang up and call 911.
   If asked, it says it is a virtual assistant and a person will call back.
6. It ends with "Someone from our team will call you back at ..." and hangs up.
7. The message goes into the CRM through the website's existing contact
   endpoint (the same place website inquiries go, marked
   **source: phone-assistant**), so the office gets the usual email.
8. The full transcript stays only on the Pi, in `data/transcripts/`, and is
   deleted automatically after 30 days.

### How it is built (for whoever maintains it)

| Part | What |
|---|---|
| Phone line | Telnyx number + TeXML `<Connect><Stream>` (Pipecat has a built-in Telnyx serializer) |
| Pipeline | [Pipecat](https://github.com/pipecat-ai/pipecat) 1.12: Silero VAD + smart-turn, faster-whisper (Whisper `base.en` or `small.en`, int8), Ollama (`qwen2.5:3b`), Piper (`en_US-amy-medium`) |
| Conversation | `receptionist/checklist.py` runs the question order in plain code. Simple answers get the next question instantly; only real questions from the caller go to the language model. A 3B model on a Pi is too slow and too forgetful to run a 9-question intake by itself (tested: it skipped questions, invented phone numbers and never called its "hang up" tool). |
| Intake record | After the call the model fills a fixed JSON form from the transcript (Ollama structured output), checked against what the script captured. |
| Server | FastAPI: `POST /texml/<token>` (Telnyx webhook), `WS /ws/<token>` (call audio), `GET /health` |

Files you may want to edit:

- `config/facts.md`: everything the assistant is allowed to say about Tinash.
- `config/script.md`: tone and rules for the language model.
- `receptionist/checklist.py`: the exact wording and order of the questions
  (`QUESTION = {...}` near the top).

After editing, restart the service (`sudo systemctl restart tinash-receptionist`).

## Costs (approximate: check current pricing)

| Item | Approximate cost |
|---|---|
| Telnyx local NJ number | about $1 to $2 a month. **Check current pricing.** |
| Telnyx inbound calls + media streaming | roughly half a cent to 2 cents a minute in total. **Check current pricing.** A 3-minute call is a few cents. |
| T-Mobile forwarding | usually included on unlimited plans (forwarded calls can count as plan minutes). Confirm with T-Mobile. |
| Cloudflare Tunnel | free (the domain must use Cloudflare DNS) |
| Raspberry Pi 5 (8 or 16 GB) + NVMe drive + case + official power supply | about $150 to $250 one time |
| Electricity | about $1 a month |
| AI services | $0. Everything runs on the Pi; no OpenAI or other cloud AI account. |

## Step 1: try it on the Mac (no phone account needed)

From this folder (`receptionist/`):

```bash
bash scripts/install_mac.sh          # one time: Python packages, models, Ollama
```

Then either:

```bash
.venv/bin/python -m receptionist.local --text   # type what a caller would say
.venv/bin/python -m receptionist.local          # speak into the Mac microphone
```

Use headphones in microphone mode, otherwise the assistant hears itself. Say
"bye" or press Ctrl-C to hang up. At the end it prints the message it would
send to the website. `DRY_RUN=true` (the default) means nothing is sent.

Other checks:

```bash
.venv/bin/python -m tests.test_scenarios   # 3 scripted callers (senior care, DDD, job seeker)
.venv/bin/python scripts/audio_smoke.py    # Piper speaks, Whisper listens, with timings
```

On an Intel Mac, Ollama must be the app from https://ollama.com/download
(Homebrew would compile it for a long time). On Apple Silicon `brew install ollama` works.

## Step 2: Telnyx number

1. Sign up at telnyx.com and finish account verification (they ask for
   business details and a payment method).
2. **Numbers > Buy numbers:** pick a New Jersey local number (973 or 862
   area code). You will forward to this number; callers never see it.
3. **Voice > TeXML Applications > Create:**
   - Name: `Tinash receptionist`
   - Voice method: **POST**
   - Webhook URL: `https://voice.tinashhomecareservices.com/texml/<CALL_TOKEN>`
     (the `CALL_TOKEN` value from `.env` on the Pi; the Pi installer prints the full path)
4. **Numbers > My numbers:** edit the new number and set its connection/application
   to the TeXML application from step 3.
5. Recommended: **Account > API Keys > Create**, and paste the key into
   `TELNYX_API_KEY=` in `.env`. With it the assistant hangs up through the
   Telnyx API right after its goodbye; without it the call still ends (the
   assistant closes the audio stream and the TeXML `<Hangup/>` runs).

What the webhook returns (you can check it with curl once the tunnel is up):

```xml
<Response>
  <Connect>
    <Stream url="wss://voice.tinashhomecareservices.com/ws/<CALL_TOKEN>" bidirectionalMode="rtp"></Stream>
  </Connect>
  <Hangup/>
</Response>
```

## Step 3: Cloudflare Tunnel (gives the Pi a public address without opening the router)

This assumes `tinashhomecareservices.com` uses Cloudflare DNS. On the Pi:

```bash
# Install cloudflared from Cloudflare's package repository
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

cloudflared tunnel login                       # opens a link: log in, pick tinashhomecareservices.com
cloudflared tunnel create tinash-voice         # prints a TUNNEL_ID
cloudflared tunnel route dns tinash-voice voice.tinashhomecareservices.com

sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /etc/cloudflared/
sudo cp deploy/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml          # put the TUNNEL_ID in both places
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Check from any computer: `curl https://voice.tinashhomecareservices.com/health`
should show `"status":"ok"`.

(Alternative: the Cloudflare dashboard, Zero Trust > Networks > Tunnels, can
create the tunnel and give you a one-line install command. Point the public
hostname `voice.tinashhomecareservices.com` to `http://127.0.0.1:8765`.)

## Step 4: T-Mobile conditional forwarding

Forward the main number to the Telnyx number only when the call is not
answered. On the T-Mobile phone, dial each code and press call (use the
Telnyx number with the 1 in front, e.g. `**61*19735551234#`):

| When | Turn on | Turn off |
|---|---|---|
| No answer | `**61*1XXXXXXXXXX#` | `##61#` |
| Busy (already on a call / declined) | `**67*1XXXXXXXXXX#` | `##67#` |
| Unreachable (phone off, no signal) | `**62*1XXXXXXXXXX#` | `##62#` |

- To change how long it rings before forwarding (5 to 30 seconds), T-Mobile
  supports `**61*1XXXXXXXXXX**20#` (20 seconds) on most plans.
- After hours: decline the call, turn the phone off, or use all-calls
  forwarding (`**21*1XXXXXXXXXX#`, off with `##21#`) when the office closes.
- **Call T-Mobile (611) to confirm** forwarding is enabled on the line, that
  these codes work on your plan, and whether forwarded minutes cost anything.
  Some business lines manage forwarding in the T-Mobile app or account instead.
- Forward the main number callers dial: the T-Mobile line (973) 636-8328,
  which is also the number on the website and the Google Business Profile.

## Step 5: move it to the Raspberry Pi

Hardware: Raspberry Pi 5 (8 GB is enough, 16 GB gives headroom), NVMe drive
(much faster than an SD card for loading models), the official 27 W power
supply and a case with a fan. Install Raspberry Pi OS 64-bit (Lite is fine).
Use a wired network connection if possible.

```bash
git clone <this repository> ~/tinash-prod      # or copy the receptionist/ folder
cd ~/tinash-prod/receptionist
bash deploy/install_pi.sh
```

The installer sets up Python, Ollama with the model, the speech models, a
`.env` with a new random `CALL_TOKEN` (with `DRY_RUN=true`) and a system
service that starts at boot. Then:

1. Do step 3 (tunnel) and step 2 (Telnyx webhook URL with the token).
2. Call the Telnyx number directly from a cell phone and test a few calls.
   With `DRY_RUN=true`, the message is printed in the log instead of sent:
   `journalctl -u tinash-receptionist -f`
3. When happy, set `DRY_RUN=false` in `.env`, then
   `sudo systemctl restart tinash-receptionist`. Make one more test call and
   check it appears in the CRM.
4. Turn on T-Mobile forwarding (step 4).

Useful commands:

```bash
sudo systemctl status tinash-receptionist     # is it running?
journalctl -u tinash-receptionist -f          # live log
curl -s localhost:8765/health                 # quick check
ls data/transcripts/                          # local call records (kept 30 days)
```

### How fast will it be on the Pi? (honest expectations)

Measured on the test Mac (Intel i7, 2020) over a simulated Telnyx call:

| Step | Mac (measured) | Pi 5 (estimate, not measured) |
|---|---|---|
| Speech recognition per sentence, Whisper small.en | 1.7 to 2.2 s | 4 to 6 s |
| Speech recognition per sentence, Whisper base.en | about 0.7 s | 1.5 to 2.5 s |
| Scripted reply (most turns: no language model) | under 0.1 s | under 0.2 s |
| Voice starts after text is ready (Piper) | 0.1 to 0.4 s | 0.3 to 0.8 s |
| Caller stops talking until assistant starts (normal turn) | 2 to 3.5 s with small.en | about 2.5 to 4 s with base.en |
| Turn where the caller asks a question (language model) | first words about 2.5 s after the text, about 6 to 10 s total | first words about 6 to 12 s after the text |

So on the Pi most of the call feels like a slightly slow human
receptionist, but a caller's question ("how much does it cost?", "do you
cover Morris County?") can take several seconds to answer. That is why the
`.env.example` uses `base.en` on the Pi. If questions are too slow, use the
smaller `qwen2.5:1.5b` model (`ollama pull qwen2.5:1.5b`, set `LLM_MODEL`):
roughly twice as fast, a little less careful. Pi figures are estimates
scaled from the Mac numbers and published Pi 5 benchmarks. Measure on the
real Pi with `scripts/fake_telnyx_call.py` (below).

The Pi handles **one call at a time** (`MAX_CONCURRENT_CALLS=1`). A second
caller during a call hears "all of our lines are busy, please call again".

### Testing a "phone call" without a phone

`scripts/fake_telnyx_call.py` connects to the server exactly like Telnyx
does, speaks caller lines with a synthetic voice over 8 kHz phone audio, and
prints how long each reply took:

```bash
CALL_TOKEN=<token from .env> .venv/bin/python scripts/fake_telnyx_call.py
```

## Step 6: privacy and compliance notes

- **AI disclosure:** the greeting says it is a virtual assistant and that
  calls may be noted. It answers honestly if asked whether it is a robot.
- **Recording:** no audio is recorded or stored. Only the text transcript is
  kept, on the Pi, for 30 days, then deleted automatically
  (`TRANSCRIPT_RETENTION_DAYS`). The message sent to the CRM contains the
  intake answers and a short excerpt. New Jersey is a one-party-consent state,
  but some callers may be in other states; the greeting's notice covers note
  taking. Talk to your attorney if you want to record audio.
- **HIPAA:** callers may mention health details. Everything here runs on
  your own device; nothing goes to a cloud AI service. Do **not** switch the
  language model or speech recognition to a cloud provider (OpenAI, Google,
  etc.) unless that provider signs a Business Associate Agreement (BAA) with
  Tinash. Telnyx carries the call audio; ask Telnyx about a BAA if you need
  one for phone traffic. The CRM/website side already handles inquiries today.
- **Logs:** the service logs at `LOG_LEVEL=INFO`, which leaves out what
  callers say. Only switch to `DEBUG` while troubleshooting (with `DRY_RUN=true`
  the would-be message is printed to the log too).
- **Security:** keep `.env` private (it holds the `CALL_TOKEN` and the Telnyx
  key). The server only listens on the Pi itself; the public only reaches it
  through the tunnel, and only with the token. Keep the Pi updated
  (`sudo apt update && sudo apt full-upgrade` monthly).
- **Emergencies:** the assistant tells callers to hang up and call 911 and
  flags the message ("caller mentioned a possible emergency") so the team sees it.
- **Not a replacement for a person:** it takes messages and answers basic
  questions. Someone still needs to check the CRM and call people back.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/health` says `degraded` | Ollama not running or model missing: `sudo systemctl restart ollama`, `ollama list` |
| Telnyx call connects but silence | Tunnel down (`systemctl status cloudflared`), or wrong `PUBLIC_WS_URL`/token in `.env` |
| Messages not in the CRM | `DRY_RUN` still `true`, or check the log for `Inquiry post` errors (the website limits 5 requests a minute per address) |
| Assistant mishears names | Use `WHISPER_MODEL=models/whisper/small.en` (slower, more accurate) |
| Replies too slow | `WHISPER_MODEL=models/whisper/base.en`, `LLM_MODEL=qwen2.5:1.5b` |
