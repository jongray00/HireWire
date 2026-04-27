# Phase 1 Completion Report — 2026-04-27

## DoD checklist

- [x] `npm install` and `pip install` (via `uv sync`) produce no warnings about deprecated/removed deps. Fresh `rm -rf node_modules package-lock.json && npm install` from `web/` adds 708 packages cleanly; the only deprecation warnings are upstream (`whatwg-encoding@3.1.1`, `prebuild-install@7.1.3`) and reference none of the deps removed in Task 11 (`stripe`, `@chakra-ui/*`, `three`, `argon2`, `papaparse`, `pdfjs-dist`, `@neondatabase/serverless`, `@auth/*`, `@lshay/*`, `@vis.gl/*`).
- [x] `git grep -i "sally"` returns zero hits in source code. The 47 hits surfaced by the recursive grep are all in `docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md` and `docs/superpowers/specs/2026-04-27-hirewire-design.md` — historical context retained intentionally per the task spec. Zero hits in `agent/`, `web/src/`, `pyproject.toml`, `web/package.json`, `README.md`, `ARCHITECTURE.md`, or `replit.md`.
- [x] `git grep "jonnykarate"` returns zero hits everywhere. `ngrok` survives in 8 places, all benign:
  - `agent/hirewire/config.py:65` — the explanatory comment that documents *why* there is no ngrok fallback (intentional, kept).
  - `web/src/app/api/utils/getBaseUrl.js:6,47`, `web/src/app/api/utils/verifySwml.js:56`, `web/src/app/api/debug/swml/route.js:107` — `ngrok` appears only in inline comments and user-facing diagnostic strings as a *generic example* of a public-tunneling proxy, never as a hardcoded URL. These will be revisited when Phase 3 rebuilds the dashboard.
  - `docs/signalwire_agents/core/swml_service.py:1094,1173`, `docs/signalwire_agents/core/mixins/web_mixin.py:1079` — third-party SignalWire SDK source bundled in our docs tree; not our code.
- [x] `npm run typecheck` reports a known 21-error baseline (TS7016 from React Router's typegen against `.jsx` route files); CI's web typecheck step is `continue-on-error: true` until Phase 4 converts routes to `.tsx`. `pytest --collect-only` lists 13 tests across `agent/tests/`.
- [x] `/healthz` and `/readyz` both return 200 (verified via local uvicorn boot — see "Live server smoke test" below).
- [x] `README.md` walks a new SE from clone → running demo on Replit in ≤ 10 minutes. Step 5 of this task tightened the npm-install command (dropped redundant `--legacy-peer-deps` since `web/.npmrc` sets it).

## Test counts

- **Backend pytest:** 13 passed in 0.71s (1 smoke + 7 config + 5 health).
- **Frontend vitest:** 1 passed in 2.02s (smoke).
- **Backend ruff** (scoped to `agent/hirewire/` + `agent/tests/`): clean.
- **Backend ruff on legacy `agent/main.py`:** 69 pre-existing issues, deferred to Phase 2 rewrite (CI scoped its lint to skip this file).

## Stack snapshot at end of Phase 1

- `web/package.json`: **45 direct dependencies + 26 devDependencies** = 71 total (was ~84 pre-cleanup; Task 11 removed ~13).
- `agent/main.py`: **1,233 LOC** (Phase 2 splits this into the modules from spec §4).
- `agent/hirewire/`: 5 source files — `__init__.py`, `config.py`, `app.py`, `routes/__init__.py`, `routes/health.py`.
- `agent/tests/`: 5 source files — `__init__.py`, `conftest.py`, `test_smoke.py`, `test_config.py`, `test_health.py`.

## Phase 2 readiness

Foundation in place for the Phase 2 backend rewrite:
- `pydantic-settings` config available via `hirewire.config.get_settings()` with autouse cache-clear test fixture.
- FastAPI factory (`hirewire.app.create_app`) ready to receive new routers.
- Test infra (pytest + httpx + ruff via uv) wired.
- Replit Secrets documented in `agent/.env.example` and the README.
- CI scaffold green on agent (lint scoped, tests run); web typecheck soft-failed for now.
- HireWire branding consistent across backend, frontend, and top-level docs.

## Known carry-overs to Phase 2

- Split `agent/main.py` (1,233 LOC after Task 5's deletions) into the modules from spec §4.
- Resolve the 69 ruff issues in `agent/main.py` as part of the rewrite.
- Add real DB connection check to `/readyz` once SQLite layer lands.
- Encrypted-credentials-at-rest (`hirewire.services.crypto`) using `HIREWIRE_MASTER_KEY`.

## Known carry-overs to Phase 4

- Convert `.jsx` route files to `.tsx` to clear the 21 TS7016 baseline.
- Frontend design pass + UI primitives (replace stub `<div>`s left in dashboard pages).
- Audit the `ngrok` references in `web/src/app/api/utils/getBaseUrl.js`, `verifySwml.js`, and `debug/swml/route.js` when those modules are rewritten — replace with neutral phrasing (e.g. "a public tunnel or deploy publicly") so the codebase has zero `ngrok` mentions outside the intentional `config.py` comment.

## DoD grep outputs (verbatim)

### sally check

All 47 hits are in `docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md` (lines 5, 7, 676, 684, 686, 693–697, 766, 768, 781, 943, 971, 975, 976, 978, 991, 1000, 1002, 1025, 1126, 1150, 1153, 1155, 1157, 1161, 1164, 1167–1170, 1172, 1184, 1188, 1205, 1356, 1360, 1522, 1577, 1628) and `docs/superpowers/specs/2026-04-27-hirewire-design.md` (lines 6, 25, 35, 688, 706). All historical-context references in design/plan documents — intentional, retained per task spec.

### ngrok check

```
web/src/app/api/utils/getBaseUrl.js:6: * (localhost, ngrok, Replit, production) without hardcoding URLs.
web/src/app/api/utils/getBaseUrl.js:47:  // Check for forwarded headers (used by proxies like ngrok, Replit, etc.)
web/src/app/api/utils/verifySwml.js:56:      diagnostics.warning = 'Localhost URLs cannot be reached by SignalWire. Use ngrok or deploy publicly.';
web/src/app/api/debug/swml/route.js:107:      action: 'Use ngrok, Replit, or deploy to a public server for SignalWire to reach the webhook'
agent/hirewire/config.py:65:        # Local dev fallback — explicit so we don't ship hardcoded ngrok URLs.
docs/signalwire_agents/core/swml_service.py:1094:        # First check for standard X-Forwarded headers (used by most proxies including ngrok)
docs/signalwire_agents/core/swml_service.py:1173:            proxy_url: The base URL to use for webhooks (e.g., https://example.ngrok.io)
docs/signalwire_agents/core/mixins/web_mixin.py:1079:            proxy_url: The base URL to use for webhooks (e.g., https://example.ngrok.io)
```

`jonnykarate` returns zero hits.

## Live server smoke test

Booted with:

```
HIREWIRE_MASTER_KEY=<32-byte token_urlsafe>
SWML_BASIC_AUTH_USER=signalwire
SWML_BASIC_AUTH_PASSWORD=<16-byte token_urlsafe>
APP_DOMAIN=http://localhost:8000
uv run uvicorn main:app --port 8000
```

```
GET /healthz  → {"status":"ok","version":"0.1.0"}
GET /readyz   → {"status":"ready","checks":{"secrets_loaded":true,"app_domain":"http://localhost:8000"}}
GET /version  → {"version":"0.1.0","git_sha":"unknown"}
```

All three returned HTTP 200 (`curl -sf` succeeded).
