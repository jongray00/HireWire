# HireWire — Replit Setup

Full-stack AI voice agent demo built with SignalWire. Users configure virtual AI
employees through a web dashboard and call them via browser-to-agent WebRTC.

## Architecture

- **Frontend** (`/web`) — React Router 7 + Vite + TypeScript + Tailwind + Chakra
  - Listens on port `5000` (Vite dev server, host `0.0.0.0`)
  - Uses `@signalwire/js` for WebRTC / Fabric calling
  - SQLite via `better-sqlite3` (server-side; marked SSR-external in `vite.config.ts`)
  - State: Zustand + TanStack Query
- **Backend** (`/agent`) — Python 3.11 + FastAPI + SignalWire Agents SDK
  - Listens on port `8000`, host `0.0.0.0`
  - Serves a dynamic SWML endpoint per virtual employee at `/swml/{employee_id}`
  - Handles SWAIG functions (transfer, SMS, email, callbacks, KB search, hangup)

## Workflows (defined in `.replit`)

| Workflow | Command | Port |
|----------|---------|------|
| Backend  | `cd agent && python main.py` | 8000 |
| Frontend | `cd web && npm run dev` | 5000 |
| Project  | Runs both in parallel | 5000 + 8000 |

The deployment command also works:
```
(cd agent && uvicorn main:app --host 0.0.0.0 --port 8000) &
(cd web && npm run dev -- --port 5000 --host 0.0.0.0)
```
The credentials handoff to the frontend lives in `@app.on_event("startup")`
inside `agent/main.py`, so it runs whether you launch via `python main.py` or
`uvicorn main:app`.

## Replit Secrets

Set these under **Tools → Secrets** before running. Anything not set falls back
to a sensible default or causes a clear log warning at startup.

### Required
| Key | Description | Where to find it |
|-----|-------------|------------------|
| `SIGNALWIRE_SPACE_URL` | Your SignalWire space (e.g. `example.signalwire.com`) | SignalWire Dashboard → top right |
| `SIGNALWIRE_PROJECT_ID` | Project UUID | SignalWire Dashboard → API → Project ID |
| `SIGNALWIRE_API_TOKEN` | Auth token | SignalWire Dashboard → API → API Tokens |
| `SWML_BASIC_AUTH_PASSWORD` | Strong password protecting the SWML endpoint | Generate with `openssl rand -hex 24` |

### Recommended
| Key | Default | Notes |
|-----|---------|-------|
| `SWML_BASIC_AUTH_USER` | `signalwire` | Username for the SWML endpoint |
| `APP_DOMAIN` | (auto-detected) | Public URL of the Replit deploy. Set explicitly for stability. No trailing slash. |
| `CORS_ORIGINS` | `*` | Comma-separated allowlist for the agent backend |
| `AGENT_BACKEND_URL` | `http://localhost:8000` | Frontend → backend URL. On Replit, set to the public 8000-port URL of this Repl. |
| `APP_URL` | `http://localhost:5000` | Public URL of the frontend (used in webhook callbacks) |

### Optional
| Key | Used by |
|-----|---------|
| `SENDGRID_API_KEY` | `send_email` SWAIG function |
| `SIGNALWIRE_SPACE` / `SIGNALWIRE_TOKEN` | DataSphere knowledge-base search (`search_knowledge`) |

> Frontend variables also live in `web/.env.example`. The agent backend reads
> `agent/.env.example`.

## Dependency management

- **Python**: `pyproject.toml` + `uv.lock` are the source of truth.
  `agent/requirements.txt` is kept in sync as a fallback for environments that
  don't run `uv`. Regenerate with:
  ```bash
  uv pip compile pyproject.toml -o agent/requirements.txt
  ```
- **Node**: `web/package.json` + `web/package-lock.json`. Replit runs
  `npm install` on first start.

## Key files

| File | Purpose |
|------|---------|
| `agent/main.py` | FastAPI app + `VirtualEmployeeAgent` class |
| `agent/.env.example` | Backend env-var template |
| `web/.env.example` | Frontend env-var template |
| `web/src/app/demo-ivr/page.jsx` | Main dashboard UI |
| `web/src/components/demo-ivr/AdvancedCallControls.jsx` | WebRTC call controls |
| `web/src/lib/db.ts` | SQLite database wrapper |
| `web/src/app/api/signalwire/` | API routes (connect, token, generate-agent, etc.) |
| `web/vite.config.ts` | SSR externals for `better-sqlite3` |
