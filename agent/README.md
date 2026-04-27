# HireWire Agent

Python FastAPI backend for HireWire — serves SWML and SWAIG endpoints for the
multi-tenant virtual-employee demo.

## Quickstart (local dev)

```bash
# From the repo root
uv sync --extra dev
export HIREWIRE_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
export SWML_BASIC_AUTH_USER=signalwire
export SWML_BASIC_AUTH_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(16))')
cd agent
uv run uvicorn main:app --reload --port 8000
```

## Tests

From the repo root:

```bash
uv run pytest -q
```

See `../docs/superpowers/specs/2026-04-27-hirewire-design.md` for the full
architecture and `../docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md`
for the current phase plan.
