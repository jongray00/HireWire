# HireWire — Agent Backend

Python backend for HireWire's virtual AI employees. Built on FastAPI and the
SignalWire Agents SDK. Each employee gets its own dynamic SWML endpoint and
SWAIG function set.

## Setup

```bash
# Editable install with dev deps (pytest, respx, httpx, etc.)
pip install -e ".[dev]"

# Or, lockfile-style install of just runtime deps:
pip install -r agent/requirements.txt

cp agent/.env.example agent/.env   # fill in vars (see Environment variables)
```

## Run

There are two entry points:

```bash
# Single-tenant legacy entry — equivalent to running main.py directly.
uvicorn agent.main:app --host 0.0.0.0 --port 8000

# Multi-tenant entry — composes main.py with the auth router and (opt-in)
# the per-project webhook basic-auth middleware.
uvicorn agent.app:app --host 0.0.0.0 --port 8000
```

Set `HIREWIRE_MULTI_TENANT_AUTH=1` to enable the per-project webhook
middleware. With it off, all webhook routes (`/swml/*`, `/swaig/*`,
`/post-prompt/*`) keep their existing single-tenant behavior. With it on,
the agent looks up `(project_id, decrypted webhook password)` from the
shared SQLite DB on every webhook call and rejects 401 if they don't match.

## Tests

```bash
cd agent && python -m pytest
```

81 tests covering crypto, config, db, migrations, audit, log redaction,
projects repository, internal API auth, SignalWire credential validation,
the auth router, the webhook middleware, and the composed app.

## Architecture (Phase 1 + Phase 2)

```
agent/
├── app.py                  # multi-tenant entry point
├── main.py                 # legacy single-tenant FastAPI app
├── lib/
│   ├── config.py           # typed env loader, fail-fast
│   ├── crypto.py           # AES-GCM-256, versioned wire format
│   ├── db.py               # SQLite open + transaction helper
│   ├── migrate.py          # migration runner
│   ├── audit.py            # audit_log writer + redaction
│   ├── log_redact.py       # structlog PII redaction processor
│   ├── logging_setup.py    # configure structlog JSON output
│   ├── projects_repo.py    # CRUD over multi-tenant projects table
│   ├── signalwire_client.py# SignalWire credential validator
│   ├── internal_auth.py    # X-Agent-API-Key dependency
│   └── webhook_auth.py     # per-project Basic Auth middleware
├── routes/
│   └── auth.py             # /api/auth/validate-credentials
├── migrations/
│   └── 001_initial_schema.sql
└── tests/                  # pytest + respx
```

## API endpoints

### SignalWire-facing (per employee, protected by webhook basic auth in MT mode)
- `GET /swml/{employee_id}` — SWML document for the given employee
- `POST /swaig/{employee_id}/{function}` — SWAIG function handler

### Management (called by the dashboard, single-tenant legacy)
- `POST /api/create-employee` — create a virtual employee + mount its SWML route
- `GET  /api/list-employees` — list all employees
- `GET  /api/employee/{id}` — fetch one employee's config
- `PATCH /api/employee/{id}` — update + remount
- `DELETE /api/employee/{id}` — remove
- `GET /api/agent-info` — credentials + counts
- `GET /health` — liveness

### Multi-tenant auth (called by the web layer with `X-Agent-API-Key`)
- `POST /api/auth/validate-credentials` — verify a `(space_url, project_id, api_token)` triple against SignalWire

## SWAIG functions

Every `VirtualEmployeeAgent` registers the following tools (toggle per employee
via the `enabled_functions` config field):

- `transfer_to_human` — bridge to a configured PSTN number
- `send_summary_sms` — SMS the caller (requires `sms_from_number`)
- `send_email` — email the caller (requires SendGrid API key)
- `schedule_callback` — capture name + number + preferred time
- `collect_customer_info` — capture structured contact details
- `check_business_hours` — open/closed decision
- `search_<doc>` — DataSphere or local-vector KB search (one tool per attached document)
- `end_call` — polite hangup

## Real-time events

Functions push events to the browser via `SwaigFunctionResult.swml_user_event(...)`.
The frontend subscribes via `client.on('userInput', …)` to update UI state in
response.

## Environment variables

See `.env.example` for the full annotated list. Required for multi-tenant mode:

| Var | Purpose |
|-----|---------|
| `ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256 key. Used for projects table field encryption |
| `AGENT_API_KEY` | Shared secret for web → agent internal calls (≥ 32 chars) |
| `PUBLIC_BASE_URL_AGENT` / `PUBLIC_BASE_URL_WEB` | https URLs of the two services |
| `DATA_DIR` | Directory containing the shared SQLite DB |
| `SENDGRID_API_KEY` | Required by config loader (placeholder OK if email isn't used) |
| `HIREWIRE_MULTI_TENANT_AUTH` | Set to `1` to enable per-project webhook basic auth |

Single-tenant legacy variables (still respected by `agent/main.py`):

| Var | Purpose |
|-----|---------|
| `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD` | Static auth on SWML endpoints (legacy mode) |
| `APP_DOMAIN` | Public URL the SDK uses for callback construction |
| `AGENT_PORT` | Listen port (default `8000`) |
| `CORS_ORIGINS` | Comma-separated CORS allowlist |
| `SIGNALWIRE_SPACE` / `SIGNALWIRE_PROJECT_ID` / `SIGNALWIRE_TOKEN` | DataSphere KB credentials |
