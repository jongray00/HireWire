# HireWire — Replit Notes

Full-stack SignalWire demo. Users log in with their SignalWire Project ID, hire
a virtual AI employee from a template gallery, and call it from the browser.

## Architecture

- **Frontend** (`web/`): React Router 7 + Vite + TypeScript + Tailwind. Runs on port 5000.
- **Backend** (`agent/`): FastAPI + `signalwire-agents` SDK. Runs on port 8000.

## Required Replit Secrets

- `HIREWIRE_MASTER_KEY` — 32+ char libsodium key
- `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD`
- *(optional)* `APP_DOMAIN`, `SENTRY_DSN`, `SENDGRID_API_KEY`

## Workflows

- **Backend**: `cd agent && uv run uvicorn main:app --reload --port 8000`
- **Frontend**: `cd web && npm run dev`
- **Project** (parallel): runs both.

## Phase status

Phase 1 complete: repo cleaned, branded HireWire, `/healthz` + `/readyz` live,
secrets documented, CI scaffold green. See
`docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md`.
