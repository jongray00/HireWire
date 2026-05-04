# HireWire

A SignalWire AI voice-agent dashboard. Configure virtual AI employees through a
web UI, then call them in the browser via WebRTC. Each employee gets a dedicated
SWML endpoint, a personality, a function set (transfer, SMS, email, knowledge-
base lookup, scheduled callbacks), and a real-time event channel back to the UI.

```
┌─────────────────────────────────────────┐
│  Browser  (React + @signalwire/js)      │
│  - WebRTC audio/video                   │
│  - Real-time SWML user events           │
└──────────┬──────────────────────────────┘
           │ WebSocket / WebRTC
           │ Dial: /{subscriberId}/{employee_name}
┌──────────▼──────────────────────────────┐
│  SignalWire Cloud (Fabric + AI)         │
│  - Subscriber / Address API             │
│  - WebRTC media gateway                 │
│  - STT / TTS                            │
│  - SWML / SWAIG orchestration           │
└──────────┬──────────────────────────────┘
           │ HTTPS + Basic Auth
           │ GET  /swml/{employee_id}
           │ POST /swaig/{function}
┌──────────▼──────────────────────────────┐
│  Python Agent  (FastAPI + signalwire-   │
│  agents SDK)                            │
│  - Dynamic SWML per employee            │
│  - SWAIG function execution             │
│  - DataSphere KB lookup                 │
│  URL: ${APP_DOMAIN}                     │
└─────────────────────────────────────────┘
```

## Repository layout

```
HireWire/
├── agent/                  # Python backend (FastAPI)
│   ├── main.py             # VirtualEmployeeAgent + FastAPI app
│   ├── requirements.txt    # mirror of pyproject.toml
│   ├── .env.example
│   └── README.md
├── web/                    # React Router 7 + Vite frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/signalwire/   # connect, token, generate-agent, …
│   │   │   ├── api/swml/         # SWML proxy
│   │   │   └── demo-ivr/page.jsx # main dashboard
│   │   ├── components/demo-ivr/  # call controls, transcript, code viewer
│   │   └── lib/db.ts             # SQLite (better-sqlite3)
│   ├── package.json
│   └── .env.example
├── docs/                   # Architecture notes
├── ARCHITECTURE.md         # Deep-dive on SWML / address creation flow
├── replit.md               # Replit-specific setup
├── pyproject.toml          # Python deps (source of truth)
├── uv.lock
└── .replit                 # Replit workflow + deployment config
```

## Prerequisites

- Node.js 20+
- Python 3.11+
- A SignalWire account (Space URL, Project ID, API Token)
- (Optional) SendGrid API key for email follow-ups

## Quickstart — Local

### 1. Install
```bash
# Backend
cd agent
pip install -r requirements.txt          # or: uv sync from repo root

# Frontend
cd ../web
npm install
```

### 2. Configure environment
```bash
cp agent/.env.example agent/.env         # fill in SWML_BASIC_AUTH_PASSWORD, etc.
cp web/.env.example   web/.env           # fill in AGENT_BACKEND_URL, APP_URL
```

### 3. Run
In two terminals:
```bash
# Terminal 1 — agent
cd agent && python main.py        # → http://localhost:8000

# Terminal 2 — web
cd web && npm run dev             # → http://localhost:5000
```

Open <http://localhost:5000/demo-ivr> in the browser, fill in your SignalWire
credentials, generate an employee, and place a call.

### 4. (Optional) Expose locally for SignalWire callbacks
SignalWire needs a public URL to fetch SWML and call SWAIG functions. For local
dev, use ngrok or any HTTPS tunnel:
```bash
ngrok http 8000
# then export APP_DOMAIN=https://<your-ngrok-host> before starting the agent
```
The agent auto-detects ngrok at startup if `APP_DOMAIN` is unset.

## Deploying to Replit

1. **Push to GitHub**, then **Import** the repo into Replit (`Create Repl → Import from GitHub`).
2. Replit reads `.replit` and uses the `Project` workflow to start both services:
   - Backend: `cd agent && python main.py` on port `8000`
   - Frontend: `cd web && npm run dev` on port `5000`
3. **Set Secrets** under *Tools → Secrets*. Required at minimum:
   - `SIGNALWIRE_SPACE_URL`, `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`
   - `SWML_BASIC_AUTH_PASSWORD` (generate with `openssl rand -hex 24`)
   - `APP_DOMAIN` — the public URL of your deployed Repl, e.g. `https://hirewire.you.repl.co`
   - `AGENT_BACKEND_URL` — public URL of the backend (Repl exposes 8000 publicly)

   See `replit.md` for the full Secrets reference, including optional ones.
4. Click **Run**. The Webview opens the frontend; the backend serves SWML on the same Repl on port 8000.

The deploy command in `.replit` (`uvicorn main:app …`) shares startup logic
with `python main.py` via `@app.on_event("startup")` — credentials handoff and
ngrok fallback work in both modes.

## Environment variables

### Backend (`agent/.env`)
| Var | Required | Description |
|-----|----------|-------------|
| `SWML_BASIC_AUTH_USER` | no (default `signalwire`) | Username for the SWML endpoint |
| `SWML_BASIC_AUTH_PASSWORD` | **yes** | Password for the SWML endpoint |
| `APP_DOMAIN` | recommended | Public URL of the deployment, no trailing slash |
| `AGENT_PORT` | no (default `8000`) | Port the agent listens on |
| `CORS_ORIGINS` | no (default `*`) | Comma-separated allowlist for the agent CORS |
| `SIGNALWIRE_SPACE`, `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN` | only if using DataSphere KB | Credentials for `search_knowledge` |
| `SENDGRID_API_KEY` | only if using `send_email` | SendGrid API key |

### Frontend (`web/.env`)
| Var | Required | Description |
|-----|----------|-------------|
| `AGENT_BACKEND_URL` | **yes** in deploy | Where the frontend calls the agent (`http://localhost:8000` for dev) |
| `APP_URL` | recommended | Public URL of the frontend, used to build webhook callback URLs |
| `NEXT_PUBLIC_APP_URL` | optional | Same value as `APP_URL`, exposed to the browser bundle |

## SWAIG functions exposed by each employee

Each virtual employee inherits a default toolset that the AI may call during a
conversation. Functions can be enabled/disabled per employee via the `enabled_functions`
config field.

| Function | Purpose |
|----------|---------|
| `transfer_to_human` | Bridge the call to a configured PSTN number |
| `send_summary_sms` | SMS the caller a summary or confirmation |
| `send_email` | Email the caller via SendGrid |
| `schedule_callback` | Capture name + number + preferred time |
| `collect_customer_info` | Capture structured contact details |
| `check_business_hours` | Decide if the agent should offer a callback |
| `search_<doc>` | DataSphere or local-vector knowledge-base lookup (one tool per attached document) |
| `end_call` | Politely hang up |

## Real-time events

The agent ships custom events to the browser via `swml_user_event()`. The
frontend subscribes to `userInput` on the SignalWire client and updates UI state
in response (e.g. live transcript, KB results, captured contact details).

```python
result = SwaigFunctionResult("Got it.")
result.swml_user_event({"type": "customer_info", "fields": {...}})
return result
```

```javascript
client.on('userInput', (event) => {
  if (event.detail.type === 'customer_info') updateUI(event.detail.fields);
});
```

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Frontend can't reach agent | `AGENT_BACKEND_URL` unset or wrong; agent not running on `:8000` |
| SignalWire returns 401 on SWML fetch | `SWML_BASIC_AUTH_PASSWORD` mismatch between agent and `agent-credentials.json` |
| `APP_DOMAIN not set and ngrok not detected` warning | Set `APP_DOMAIN` env var (or start ngrok before the agent) |
| Empty `webhookUrl` in generated address | Agent failed to write `web/agent-credentials.json` — check agent startup logs |
| Call connects but no audio | Browser microphone permission missing |

## License

MIT — see [LICENSE](./LICENSE).

## Credits

Built with: SignalWire Agents SDK (Python), `@signalwire/js`, React Router 7,
Tailwind CSS, Chakra UI, FastAPI.
