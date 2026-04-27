# HireWire

A SignalWire demo: multi-tenant virtual AI employees you can hire from a
template gallery and call from your browser. Built on the
[`signalwire-agents`](https://github.com/signalwire/signalwire-agents) Python
SDK and `@signalwire/js`.

> **Status:** Phase 1 complete — repo cleanup and Replit-deployable foundation.
> Phases 2–5 (backend rewrite, vertical slice, polished UI, observability) are
> tracked in `docs/superpowers/plans/`.

## Stack

- **Frontend** (`web/`): React Router 7 + Vite + TypeScript + Tailwind + `@signalwire/js`
- **Backend** (`agent/`): FastAPI + `signalwire-agents` + pydantic-settings
- **Storage**: SQLite (Phase 2)
- **Deploy target**: Replit (vm)

## Quickstart

```bash
git clone https://github.com/jongray00/HireWire.git
cd HireWire

# Backend
uv sync --extra dev
export HIREWIRE_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
export SWML_BASIC_AUTH_USER=signalwire
export SWML_BASIC_AUTH_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(16))')
(cd agent && uv run uvicorn main:app --reload --port 8000) &

# Frontend
cd web
npm install
npm run dev
```

Open `http://localhost:5000`.

## Required Replit Secrets

| Key | Purpose |
|---|---|
| `HIREWIRE_MASTER_KEY` | 32+ char libsodium key — encrypts tenant credentials at rest. |
| `SWML_BASIC_AUTH_USER` | basic-auth user SignalWire uses to fetch `/swml` + call `/swaig`. |
| `SWML_BASIC_AUTH_PASSWORD` | basic-auth password (same pair, same secret value across tenants). |
| `APP_DOMAIN` | *(optional)* — derived from `REPLIT_DEPLOYMENT_URL` / `REPLIT_DEV_DOMAIN` if unset. |
| `SENTRY_DSN` | *(optional)* — Phase 5 observability. |
| `SENDGRID_API_KEY` | *(optional)* — enables email-summary SWAIG handler. |

## Health check

```bash
curl https://<your-replit-url>/healthz
# → {"status":"ok","version":"0.1.0"}
```

## Tests

```bash
# Backend
uv run pytest -q

# Frontend
cd web && npm run test:run
```

## Documentation

- **Design spec**: [`docs/superpowers/specs/2026-04-27-hirewire-design.md`](docs/superpowers/specs/2026-04-27-hirewire-design.md)
- **Phase plans**: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- **Architecture diagrams**: §3 of the design spec.

## License

MIT
