# Tinash phone receptionist

A virtual receptionist that answers Tinash Homecare Services calls when nobody
in the office can pick up. It runs on a small computer in the office (a
Raspberry Pi 5). Speech recognition and the voice run on that box; the
conversation itself is handled by **Claude** (Anthropic's AI model,
`claude-sonnet-5-5`) over the internet. If Claude can't be reached, the call
carries on with a local fallback on the Pi.

## What it does

1. A call to the main number that is not answered (busy, no answer, phone
   off, after hours) is forwarded by T-Mobile to a Telnyx phone number.
2. Telnyx sends the call audio over the internet to the Pi, through a free
   Cloudflare Tunnel.
3. The assistant greets the caller: *"Hi, thanks for calling Tinash Homecare
   Services! I'll take a few notes so our team can follow up with you. How can
   I help today?"*
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
   It doesn't say it is automated unless the caller asks directly; then it
   answers honestly and says a person will call back.
6. It ends with "Someone from our team will call you back at ..." and hangs up.
7. The message goes into the CRM through the website's existing contact
   endpoint (the same place website inquiries go, marked
   **source: phone-assistant**), so the office gets the usual email. With the
   CRM dashboard on (see "CRM dashboard" below), every call is also logged on
   the CRM's Phone Assistant page, which creates the lead itself.
8. The full transcript stays only on the Pi, in `data/transcripts/`, and is
   deleted automatically after 30 days.

### How it is built (for whoever maintains it)

| Part | What |
|---|---|
| Phone line | Telnyx number + TeXML `<Connect><Stream>` (Pipecat has a built-in Telnyx serializer) |
| Pipeline | [Pipecat](https://github.com/pipecat-ai/pipecat) 1.12: Silero VAD + smart-turn, faster-whisper (Whisper `base.en` or `small.en`, int8) and Piper (`en_US-amy-medium`) on the Pi |
| Conversation (default) | Claude Sonnet 5.5 through the official `anthropic` SDK (`receptionist/claude_brain.py`), streamed so the voice starts on the first sentence. It runs the intake naturally from `config/script.md` + `config/facts.md`, with two tools: `record_intake` (strict schema) and `end_call` (which really hangs up). Low-latency settings: `thinking: between_tools`, effort `low`; the long prompt is cached; Anthropic's server-side fallback retries a declined request on another model. |
| Fallback | If Claude errors, refuses, or is silent for 15 s (it says "One moment, please" at 6 s), the rest of the call uses the local script in `receptionist/checklist.py`: with Ollama (`qwen2.5:3b`) installed it continues the full intake; without Ollama it takes the name and number and says a person will call back. `LLM_PROVIDER=ollama` runs fully offline. |
| Intake record | After the call Claude fills a fixed JSON form from the transcript (structured output, about 4 s), merged with what `record_intake` captured. Offline: Ollama does it (20 to 26 s). |
| Server | FastAPI: `POST /texml/<token>` (Telnyx webhook), `WS /ws/<token>` (call audio), `GET /health` |

Files you may want to edit:

- `config/facts.md`: everything the assistant is allowed to say about Tinash.
- `config/script.md`: how Claude runs the call (tone, questions, rules).
- `config/script_offline.md`: the local model's rules in fallback mode.
- `receptionist/checklist.py`: the fallback script's exact questions
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
| Claude API (Anthropic) | Claude Sonnet 5.5 is $2 per million input tokens and $10 per million output tokens (cached input $0.20). **Measured in testing: about 2 to 6 cents per completed call, typically 3 to 4 cents** (very short calls under 1 cent). At 300 calls a month: **about $10 to $18 a month**, plus under $1 a month to keep the prompt cache warm. Check current pricing. |
| Local fallback (Ollama) | $0, optional |

## Step 1: try it on the Mac (no phone account needed)

From this folder (`receptionist/`):

```bash
bash scripts/install_mac.sh          # one time: Python packages and speech models
INSTALL_OLLAMA=1 bash scripts/install_mac.sh   # optional: also the offline fallback model
```

Put the Claude API key in `.env` (`ANTHROPIC_API_KEY=`). Without a key, or
with `LLM_PROVIDER=ollama`, it runs on the local model only.

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
bash deploy/install_pi.sh                      # Claude mode (recommended)
INSTALL_OLLAMA=1 bash deploy/install_pi.sh     # also install the offline fallback model
```

The installer sets up Python, the speech models, a `.env` with a new random
`CALL_TOKEN` (with `DRY_RUN=true`) and a system service that starts at boot.
Ollama is optional now: it is only used if Claude can't be reached, and
without it the assistant still takes a name and number. Then:

1. Put the Claude API key in `.env` (`nano .env`, the `ANTHROPIC_API_KEY=`
   line), then `sudo systemctl restart tinash-receptionist`.
2. Do step 3 (tunnel) and step 2 (Telnyx webhook URL with the token).
3. Call the Telnyx number directly from a cell phone and test a few calls.
   With `DRY_RUN=true`, the message is printed in the log instead of sent:
   `journalctl -u tinash-receptionist -f`
4. When happy, set `DRY_RUN=false` in `.env`, then
   `sudo systemctl restart tinash-receptionist`. Make one more test call and
   check it appears in the CRM.
5. Turn on T-Mobile forwarding (step 4).

Useful commands:

```bash
sudo systemctl status tinash-receptionist     # is it running?
journalctl -u tinash-receptionist -f          # live log
curl -s localhost:8765/health                 # quick check
ls data/transcripts/                          # local call records (kept 30 days)
```

### How fast is it? (honest expectations)

Measured on the test Mac (Intel i7, 2020), simulated Telnyx calls, Whisper small.en:

| | Claude (default) | Local model only (offline mode) |
|---|---|---|
| Speech recognition per sentence (runs on the box) | 1.7 to 2.1 s | same |
| Claude: first words after the caller's sentence is recognized | median about 1.4 s; occasional slow turns of 3 to 7 s | - |
| Caller stops talking until the assistant starts, normal turn | median 3.3 s, max 4.3 s | 2 to 3.5 s (scripted reply) |
| Caller asks a question ("how much does it cost?") | about 4 s | 6 to 10 s |
| After-call intake form | about 4 s | 20 to 26 s |

On a Pi 5 the speech recognition is the slow part (estimates, not measured):
Whisper small.en about 4 to 6 s per sentence, base.en about 1.5 to 2.5 s.
That is why `.env.example` uses `base.en` on the Pi; expect roughly 2.5 to
4.5 s from the caller finishing to the assistant starting. Claude's part
doesn't change on the Pi (it runs at Anthropic). Measure on the real Pi with
`scripts/fake_telnyx_call.py` (below).

The server keeps Claude's prompt cache warm (a tiny request every 50
minutes, under $1 a month), because the first turn after the cache expires
can take 4 to 7 s.

The Pi handles **one call at a time** (`MAX_CONCURRENT_CALLS=1`). A second
caller during a call hears "all of our lines are busy, please call again".

### Testing a "phone call" without a phone

`scripts/fake_telnyx_call.py` connects to the server exactly like Telnyx
does, speaks caller lines with a synthetic voice over 8 kHz phone audio, and
prints how long each reply took:

```bash
CALL_TOKEN=<token from .env> .venv/bin/python scripts/fake_telnyx_call.py
```

## CRM dashboard (Phone Assistant in the Tinash CRM)

Optional, and recommended once the assistant is on the real line. The CRM's
**Phone Assistant** page (crm.tinashhomecareservices.com/dashboard/phone)
then shows every call (outcome, details taken, transcript, cost), which
calls still need a callback, and whether the Pi is online, and the office can
change the assistant without touching the Pi:

- turn it **on or off** (off: callers hear a short "please call back during
  office hours" message and the call ends);
- **test mode** (on: calls are only logged in the CRM; off: real calls also
  become inbox leads and the office gets the usual email);
- the **voice** and speaking speed, the **greeting** and **goodbye**;
- **tone and extra instructions** and **extra facts**, added to the end of the
  script. The built-in rules (911, no prices, no medical advice, no promises,
  only facts from the fact sheet) always come first and win;
- how long **transcripts** are kept (in the CRM and in `data/transcripts/`).

The Pi reads the settings about every 30 seconds, so a change applies from the
next call. It also sends a heartbeat every 60 seconds; the CRM shows the device
as offline after 3 minutes without one.

**Turning it on.** You need three values in `.env`:

```bash
SUPABASE_URL=https://xqvtmvxcrgnlmvnlkunl.supabase.co
SUPABASE_ANON_KEY=        # the project's public (publishable/anon) key, the same one the website uses
DEVICE_TOKEN=             # this Pi's own secret, made below
```

Make the device token on the Pi and register only its fingerprint (SHA-256)
in the database. The token itself never leaves the Pi:

```bash
TOKEN=$(openssl rand -hex 32)
echo "DEVICE_TOKEN=$TOKEN" >> .env               # then remove any older DEVICE_TOKEN line
printf %s "$TOKEN" | sha256sum | cut -d' ' -f1  # the fingerprint (on a Mac: shasum -a 256)
```

Then, in the Supabase SQL editor (project Tinash-Prod), with the fingerprint:

```sql
insert into proj_tinash.phone_devices (name, token_hash)
values ('Office Raspberry Pi', '<fingerprint>');
```

Restart (`sudo systemctl restart tinash-receptionist`). The log says
`CRM dashboard on`, and within a minute the CRM's Setup tab shows the Pi as
healthy. To retire a device (lost Pi, leaked token), set its `revoked_at`:
`update proj_tinash.phone_devices set revoked_at = now() where name = '...';`

**What changes when it is on:**

- The CRM's **test mode replaces `DRY_RUN`** for phone calls. Every call is
  logged in the CRM (including hang-ups, so missed calls can be counted), and
  the database creates the inbox lead itself when test mode is off and the
  caller gave a name and a number. The Pi does not also post to
  `/api/inquiry`, so there are no duplicates.
- If the CRM cannot be reached when a call ends, the Pi falls back to the old
  path and posts the lead to `/api/inquiry`, so nothing is lost. That fallback
  still respects `DRY_RUN` (and is printed only if the CRM was last seen in
  test mode), so set `DRY_RUN=false` once the assistant is live.
- If the CRM cannot be reached when a call starts, the last settings it sent
  are used (or the `.env` settings, if it has never answered).
- Outcomes: **emergency** (told to call 911), **failed** (an error),
  **abandoned** (nothing useful, or under 15 seconds without a number),
  **completed** (name, number and what they need, or the role for job
  seekers), otherwise **partial**.
- A voice chosen in the CRM must be installed on the Pi (`models/kokoro` or
  `models/piper/<voice>.onnx`); otherwise the `.env` voice is used and the log
  says so. Speed applies to the Kokoro voices.

Leave any of the three values empty and the assistant behaves exactly as
described in the steps above.

## Step 6: privacy and compliance notes

- **AI disclosure:** the greeting says notes are taken but does not say the
  assistant is automated (owner's choice). It answers honestly if a caller asks
  whether they are talking to a real person. Check current New Jersey and
  federal rules on automated voice systems before relying on this.
- **Recording:** no audio is recorded or stored. Only the text transcript is
  kept, on the Pi, for 30 days, then deleted automatically
  (`TRANSCRIPT_RETENTION_DAYS`). The message sent to the CRM contains the
  intake answers and a short excerpt. New Jersey is a one-party-consent state,
  but some callers may be in other states; the greeting's notice covers note
  taking. Talk to your attorney if you want to record audio.
- **HIPAA: get Anthropic's BAA before real patient calls.** In Claude mode
  the text of what callers say (not the audio) is sent to Anthropic's API.
  Callers may mention health details, so before the assistant answers real
  calls, sign a Business Associate Agreement (BAA) with Anthropic (contact
  Anthropic sales; a BAA covers specific API features, so confirm the
  features this uses: the Messages API with prompt caching, tool use, and
  the server-side fallback beta). **Until then, use it for test calls only**,
  or run `LLM_PROVIDER=ollama` (everything stays on the Pi). Speech
  recognition and the voice always run on the Pi. Telnyx carries the call
  audio; ask Telnyx about a BAA for phone traffic too. Don't switch other
  parts to cloud services without a BAA.
- **Logs:** the service logs at `LOG_LEVEL=INFO`, which leaves out what
  callers say. Only switch to `DEBUG` while troubleshooting (with `DRY_RUN=true`
  the would-be message is printed to the log too).
- **Security:** keep `.env` private (it holds the Claude API key, the
  `CALL_TOKEN` and the Telnyx key). Never paste the key into chat, email or
  the code. The server only listens on the Pi itself; the public only reaches it
  through the tunnel, and only with the token. Keep the Pi updated
  (`sudo apt update && sudo apt full-upgrade` monthly).
- **Emergencies:** the assistant tells callers to hang up and call 911 and
  flags the message ("caller mentioned a possible emergency") so the team sees it.
- **Not a replacement for a person:** it takes messages and answers basic
  questions. Someone still needs to check the CRM and call people back.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/health` says `degraded` | No brain available: Claude key missing (`ANTHROPIC_API_KEY` in `.env`) and Ollama not running |
| Calls say "I'm having trouble on my end" | Claude unreachable (internet, API key, Anthropic outage). The log shows `Claude unavailable (...)`. The message is still taken. |
| Telnyx call connects but silence | Tunnel down (`systemctl status cloudflared`), or wrong `PUBLIC_WS_URL`/token in `.env` |
| Messages not in the CRM | `DRY_RUN` still `true`, or check the log for `Inquiry post` errors (the website limits 5 requests a minute per address) |
| CRM dashboard shows the Pi offline | The service is stopped, the Pi has no internet, or the log shows `CRM heartbeat failed` (wrong `SUPABASE_URL`/key, or the device token is not registered or was revoked) |
| Calls in the CRM but not in the inbox | Test mode is still on (CRM > Phone Assistant > Settings), or the caller left no name or number |
| Assistant mishears names | Use `WHISPER_MODEL=models/whisper/small.en` (slower, more accurate) |
| Replies too slow | `WHISPER_MODEL=models/whisper/base.en` (speech recognition is the slowest part on a Pi) |
