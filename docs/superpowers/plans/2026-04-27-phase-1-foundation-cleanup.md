# HireWire Phase 1 — Foundation & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the inherited Sally-Sales fork to a HireWire-branded, dead-weight-free Replit deployment that boots cleanly, exposes `/healthz` + `/readyz`, fails fast on missing secrets, and has CI scaffolding green — all before any product code is touched.

**Architecture:** The existing `agent/main.py` (1,248 LOC monolith) is left structurally intact in Phase 1; we only **rebrand strings, replace the ngrok fallback with config-driven `APP_DOMAIN`, and bolt on a tiny `agent/hirewire/` package** providing `config.py` (pydantic-settings, fail-fast on missing secrets) and `app.py` (FastAPI factory with `/healthz` + `/readyz`). The full Phase 2 backend rewrite uses this package as its foundation. On the frontend, we strip both `__create/` directories, the `client-integrations/` cruft, the `demo-ivr/` Sally pages, the duplicate `AdvancedCallControls 2.jsx`, and ~15 dead deps from `package.json`. Sally → HireWire rebrand across every file. CI scaffold runs lint + typecheck + tests in GitHub Actions.

**Tech Stack:**
- Backend: Python 3.11, FastAPI, pydantic-settings, signalwire-agents, uvicorn, pytest, httpx (TestClient), ruff
- Frontend: React Router 7, Vite, TypeScript, Tailwind, Vitest
- Infra: Replit (vm deploy), GitHub Actions

**Reference spec:** `docs/superpowers/specs/2026-04-27-hirewire-design.md` — Phase 1 work list at §11.1, DoD at end of §11.1.

---

## Task ordering rationale

Tasks are ordered so the repo is always runnable. Test infra (Tasks 1–2) comes first so subsequent tasks have somewhere to put assertions. Backend cleanup (3–8) comes before frontend cleanup (9–14) because frontend changes risk breaking imports the backend doesn't care about. CI (15) lands last so flaky CI doesn't block earlier work. DoD verification (16) is the final gate.

---

## Task 1: Backend test infrastructure (pytest + httpx)

**Files:**
- Modify: `HireWire/agent/pyproject.toml` (add `[project.optional-dependencies]` dev group)
- Create: `HireWire/agent/tests/__init__.py`
- Create: `HireWire/agent/tests/conftest.py`
- Create: `HireWire/agent/tests/test_smoke.py`

- [ ] **Step 1: Read current `agent/pyproject.toml`**

Run: `cat HireWire/agent/pyproject.toml`

Confirm it contains the `[project]` block with `dependencies = [...]`. Note the absence of any test deps — that's what we're adding.

- [ ] **Step 2: Add dev dependency group + pytest config to `agent/pyproject.toml`**

Append to `HireWire/agent/pyproject.toml`:

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.27.0",
    "ruff>=0.6.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "-q --tb=short"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "W", "B", "UP"]
```

- [ ] **Step 3: Install dev deps**

Run: `cd HireWire/agent && pip install -e ".[dev]"`
Expected: succeeds; `pytest --version` reports ≥ 8.0.

- [ ] **Step 4: Create empty `tests/__init__.py`**

Create `HireWire/agent/tests/__init__.py` with content:
```python
```

(Empty file — pytest needs the directory marked as a package.)

- [ ] **Step 5: Create `tests/conftest.py` with one shared fixture stub**

Create `HireWire/agent/tests/conftest.py`:

```python
"""Shared pytest fixtures for the HireWire agent test suite."""

import pytest


@pytest.fixture
def anyio_backend() -> str:
    """Force anyio-based async tests onto asyncio."""
    return "asyncio"
```

- [ ] **Step 6: Write a failing smoke test**

Create `HireWire/agent/tests/test_smoke.py`:

```python
"""Smoke test — proves pytest is wired up correctly."""


def test_pytest_is_alive() -> None:
    assert 1 + 1 == 2
```

- [ ] **Step 7: Run smoke test to verify it passes**

Run: `cd HireWire/agent && pytest -q`
Expected output: `1 passed in <0.05s`

- [ ] **Step 8: Commit**

```bash
cd HireWire
git add agent/pyproject.toml agent/tests/
git commit -m "chore(agent): set up pytest + httpx + ruff dev tooling"
```

---

## Task 2: Frontend test infrastructure (vitest sanity check)

**Files:**
- Modify: `HireWire/web/vitest.config.ts` (verify contents)
- Create: `HireWire/web/test/smoke.test.ts`

- [ ] **Step 1: Read current vitest config**

Run: `cat HireWire/web/vitest.config.ts`

Confirm a `defineConfig({ test: { … } })` block exists. If it does not, fall back to creating the file with this content:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['test/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 2: Confirm `vitest` is in `web/package.json` devDependencies**

Run: `cd HireWire/web && grep -A2 '"vitest"' package.json`
Expected: a line like `"vitest": "^3.x.x"` or similar.
If absent, run `npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`.

- [ ] **Step 3: Write a failing smoke test**

Create `HireWire/web/test/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('vitest infrastructure', () => {
  it('runs unit tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run vitest to verify it passes**

Run: `cd HireWire/web && npx vitest run`
Expected output: `1 passed`

- [ ] **Step 5: Add `test` and `test:run` scripts to `package.json`**

Edit `HireWire/web/package.json` `"scripts"` block to include:

```json
"scripts": {
  "dev": "react-router dev",
  "typecheck": "react-router typegen && tsc --noEmit",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 6: Commit**

```bash
cd HireWire
git add web/vitest.config.ts web/test/ web/package.json
git commit -m "chore(web): wire up vitest with smoke test and npm scripts"
```

---

## Task 3: Backend `hirewire/config.py` — pydantic-settings, fail-fast

**Files:**
- Create: `HireWire/agent/hirewire/__init__.py`
- Create: `HireWire/agent/hirewire/config.py`
- Create: `HireWire/agent/tests/test_config.py`

- [ ] **Step 1: Write failing test for missing-secret behavior**

Create `HireWire/agent/tests/test_config.py`:

```python
"""Tests for hirewire.config — must fail fast when required secrets are missing."""

import os

import pytest
from pydantic import ValidationError


def test_settings_raise_when_master_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HIREWIRE_MASTER_KEY", raising=False)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")

    from hirewire.config import Settings

    with pytest.raises(ValidationError):
        Settings()


def test_settings_raise_when_swml_auth_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.delenv("SWML_BASIC_AUTH_USER", raising=False)
    monkeypatch.delenv("SWML_BASIC_AUTH_PASSWORD", raising=False)

    from hirewire.config import Settings

    with pytest.raises(ValidationError):
        Settings()


def test_app_domain_falls_back_to_replit_deployment_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")
    monkeypatch.delenv("APP_DOMAIN", raising=False)
    monkeypatch.setenv("REPLIT_DEPLOYMENT_URL", "https://hirewire.replit.app")
    monkeypatch.delenv("REPLIT_DEV_DOMAIN", raising=False)

    from hirewire.config import Settings

    s = Settings()
    assert s.app_domain == "https://hirewire.replit.app"


def test_app_domain_falls_back_to_replit_dev_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")
    monkeypatch.delenv("APP_DOMAIN", raising=False)
    monkeypatch.delenv("REPLIT_DEPLOYMENT_URL", raising=False)
    monkeypatch.setenv("REPLIT_DEV_DOMAIN", "abc-1234.replit.dev")

    from hirewire.config import Settings

    s = Settings()
    assert s.app_domain == "https://abc-1234.replit.dev"


def test_app_domain_explicit_override_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")
    monkeypatch.setenv("APP_DOMAIN", "https://custom.example.com")
    monkeypatch.setenv("REPLIT_DEPLOYMENT_URL", "https://replit-default.replit.app")

    from hirewire.config import Settings

    s = Settings()
    assert s.app_domain == "https://custom.example.com"
```

- [ ] **Step 2: Run tests — expect import failure**

Run: `cd HireWire/agent && pytest tests/test_config.py -v`
Expected: 5 errors / `ImportError: No module named 'hirewire'`.

- [ ] **Step 3: Add `pydantic-settings` to runtime deps**

Edit `HireWire/agent/pyproject.toml`'s `[project] dependencies` list to add `"pydantic-settings>=2.5.0"`. Then:

Run: `cd HireWire/agent && pip install -e ".[dev]"`
Expected: pydantic-settings installs.

- [ ] **Step 4: Create `hirewire/__init__.py`**

Create `HireWire/agent/hirewire/__init__.py`:

```python
"""HireWire agent — multi-tenant SignalWire AI virtual-employee backend."""

__version__ = "0.1.0"
```

- [ ] **Step 5: Create `hirewire/config.py`**

Create `HireWire/agent/hirewire/config.py`:

```python
"""Application settings for the HireWire agent.

Loads from environment with fail-fast validation. APP_DOMAIN is derived from
Replit's runtime env when not set explicitly so the public webhook URL is
always correct on Replit.
"""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Required secrets — boot fails if absent.
    hirewire_master_key: str = Field(
        ..., min_length=32, description="32-byte libsodium key (base64 ok); rotation forces re-login."
    )
    swml_basic_auth_user: str = Field(..., min_length=1)
    swml_basic_auth_password: str = Field(..., min_length=1)

    # Optional / derived.
    app_domain: str = Field(default="", description="Public HTTPS origin SignalWire uses to reach /swml and /swaig.")
    session_cookie_secret: str = Field(default="", description="HMAC key for session cookie. Auto-derived in dev.")
    sendgrid_api_key: str = Field(default="", description="Optional. Enables send_summary SWAIG handler.")
    sentry_dsn: str = Field(default="", description="Optional. Phase 5 observability.")

    @model_validator(mode="after")
    def _resolve_app_domain(self) -> "Settings":
        """If APP_DOMAIN unset, derive from Replit env."""
        if self.app_domain:
            return self

        replit_deployment = os.getenv("REPLIT_DEPLOYMENT_URL")
        if replit_deployment:
            self.app_domain = replit_deployment.rstrip("/")
            return self

        replit_dev = os.getenv("REPLIT_DEV_DOMAIN")
        if replit_dev:
            self.app_domain = f"https://{replit_dev.rstrip('/')}"
            return self

        # Local dev fallback — explicit so we don't ship hardcoded ngrok URLs.
        self.app_domain = "http://localhost:8000"
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance. Cached so re-reading .env is cheap."""
    return Settings()  # type: ignore[call-arg]
```

- [ ] **Step 6: Run config tests — expect pass**

Run: `cd HireWire/agent && pytest tests/test_config.py -v`
Expected: `5 passed`.

- [ ] **Step 7: Run full test suite**

Run: `cd HireWire/agent && pytest -q`
Expected: `6 passed` (smoke + 5 config).

- [ ] **Step 8: Commit**

```bash
cd HireWire
git add agent/hirewire/__init__.py agent/hirewire/config.py agent/tests/test_config.py agent/pyproject.toml
git commit -m "feat(agent): add hirewire.config with fail-fast secret validation"
```

---

## Task 4: Backend `/healthz` and `/readyz` endpoints

**Files:**
- Create: `HireWire/agent/hirewire/app.py`
- Create: `HireWire/agent/hirewire/routes/__init__.py`
- Create: `HireWire/agent/hirewire/routes/health.py`
- Create: `HireWire/agent/tests/test_health.py`

- [ ] **Step 1: Write failing test for `/healthz` and `/readyz`**

Create `HireWire/agent/tests/test_health.py`:

```python
"""Tests for /healthz (liveness) and /readyz (readiness) endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")

    # Re-import to pick up env.
    from hirewire.config import get_settings

    get_settings.cache_clear()

    from hirewire.app import create_app

    return TestClient(create_app())


def test_healthz_returns_200(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_readyz_returns_200_when_secrets_present(client: TestClient) -> None:
    r = client.get("/readyz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["checks"]["secrets_loaded"] is True


def test_readyz_includes_app_domain(client: TestClient) -> None:
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json()["checks"]["app_domain"]
```

- [ ] **Step 2: Run health tests — expect import failure**

Run: `cd HireWire/agent && pytest tests/test_health.py -v`
Expected: `ImportError: cannot import name 'create_app' from 'hirewire.app'`.

- [ ] **Step 3: Create `hirewire/routes/__init__.py`**

Create `HireWire/agent/hirewire/routes/__init__.py`:

```python
"""HireWire HTTP route modules. Routes are thin: validate → service call → serialize."""
```

- [ ] **Step 4: Create `hirewire/routes/health.py`**

Create `HireWire/agent/hirewire/routes/health.py`:

```python
"""Liveness and readiness endpoints.

`/healthz` — process is up. Used by Replit auto-restart.
`/readyz`  — DB connection (Phase 2), Replit Secrets loaded, basic config valid.
              Returns 503 if any check fails so deploy gates can refuse to roll.
`/version` — git SHA + build time so SEs can confirm version mid-demo.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from hirewire import __version__
from hirewire.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@router.get("/readyz")
async def readyz(response: Response) -> dict[str, object]:
    settings = get_settings()
    checks: dict[str, object] = {
        "secrets_loaded": bool(settings.hirewire_master_key and settings.swml_basic_auth_user),
        "app_domain": settings.app_domain,
    }
    if not all([checks["secrets_loaded"], checks["app_domain"]]):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "checks": checks}
    return {"status": "ready", "checks": checks}


@router.get("/version")
async def version() -> dict[str, str]:
    import os

    return {
        "version": __version__,
        "git_sha": os.getenv("REPLIT_GIT_COMMIT", "unknown"),
    }
```

- [ ] **Step 5: Create `hirewire/app.py` factory**

Create `HireWire/agent/hirewire/app.py`:

```python
"""FastAPI application factory.

Phase 1 wires only health/readiness/version. Phase 2 will wire the real
business routes onto this same factory.
"""

from __future__ import annotations

from fastapi import FastAPI

from hirewire import __version__
from hirewire.routes import health


def create_app() -> FastAPI:
    app = FastAPI(
        title="HireWire Agent",
        version=__version__,
        description="SignalWire-powered virtual AI employee backend.",
    )
    app.include_router(health.router)
    return app
```

- [ ] **Step 6: Run health tests — expect pass**

Run: `cd HireWire/agent && pytest tests/test_health.py -v`
Expected: `3 passed`.

- [ ] **Step 7: Run full test suite**

Run: `cd HireWire/agent && pytest -q`
Expected: `9 passed`.

- [ ] **Step 8: Wire health routes into legacy `agent/main.py` so the existing server exposes them**

Read the top of `HireWire/agent/main.py` until you find the `app = FastAPI()` line (or wherever the app is instantiated). Immediately after the app is created and any existing routers are added, append:

```python
# --- HireWire Phase 1: health + readiness endpoints ---
from hirewire.routes import health as _hirewire_health

app.include_router(_hirewire_health.router)
# ------------------------------------------------------
```

(Phase 2 replaces all of this. For now we're bolting health onto the legacy app so `/healthz` works on Replit without a full refactor.)

- [ ] **Step 9: Smoke-test the running server**

Run: `cd HireWire/agent && HIREWIRE_MASTER_KEY=$(printf 'x%.0s' {1..32}) SWML_BASIC_AUTH_USER=u SWML_BASIC_AUTH_PASSWORD=p uvicorn main:app --port 8001 &`
Then: `sleep 2 && curl -sf http://localhost:8001/healthz | grep '"status":"ok"'`
Expected: prints the matched line.
Then: `curl -sf http://localhost:8001/readyz | grep '"status":"ready"'`
Expected: prints the matched line.
Then: `kill %1` to stop the server.

- [ ] **Step 10: Commit**

```bash
cd HireWire
git add agent/hirewire/ agent/tests/test_health.py agent/main.py
git commit -m "feat(agent): add /healthz, /readyz, /version with create_app factory"
```

---

## Task 5: Replace hardcoded ngrok URL in `agent/main.py`

**Files:**
- Modify: `HireWire/agent/main.py` (remove `_detect_ngrok_url`, replace usages with `settings.app_domain`)

- [ ] **Step 1: Inventory current ngrok references**

Run: `cd HireWire && grep -nE "ngrok|jonnykarate|_detect_ngrok_url" agent/main.py`

Note every line number that references ngrok or the detection function. There may be ~5–15 hits.

- [ ] **Step 2: Replace `APP_DOMAIN = os.getenv(...)` block with config-driven import**

Find this block in `HireWire/agent/main.py` (near the top, after `load_dotenv()`):

```python
# Load credentials and domain from .env
SWML_USER = os.getenv('SWML_BASIC_AUTH_USER', 'signalwire')
SWML_PASSWORD = os.getenv('SWML_BASIC_AUTH_PASSWORD', 'signalwire')
APP_DOMAIN = os.getenv('APP_DOMAIN', '')


def _detect_ngrok_url() -> Optional[str]:
    """Query ngrok local API to get the current public tunnel URL."""
    try:
        import urllib.request
        resp = urllib.request.urlopen("http://localhost:4040/api/tunnels", timeout=2)
        data = json.loads(resp.read())
        for tunnel in data.get("tunnels", []):
            if tunnel.get("proto") == "https":
                return tunnel["public_url"]
    except Exception:
        pass
    return None
```

Replace the entire block with:

```python
# Settings — fail fast on missing secrets.
from hirewire.config import get_settings

_settings = get_settings()
SWML_USER = _settings.swml_basic_auth_user
SWML_PASSWORD = _settings.swml_basic_auth_password
APP_DOMAIN = _settings.app_domain
```

- [ ] **Step 3: Remove all remaining `_detect_ngrok_url()` call sites**

Run: `cd HireWire && grep -n "_detect_ngrok_url" agent/main.py`

For each hit, replace the call expression with `APP_DOMAIN` (which is now always populated).

If a fallback expression looked like:
```python
url = APP_DOMAIN or _detect_ngrok_url() or "https://example.ngrok.io"
```
Replace with:
```python
url = APP_DOMAIN
```

- [ ] **Step 4: Search for any remaining hardcoded ngrok hostnames**

Run: `cd HireWire && grep -rn "ngrok\|jonnykarate" agent/`
Expected: zero hits.

If hits remain (e.g., in docstrings or comments), edit them out — replace with descriptive English ("the public HireWire URL" / "your APP_DOMAIN").

- [ ] **Step 5: Run pytest to verify nothing broke**

Run: `cd HireWire/agent && pytest -q`
Expected: `9 passed`.

- [ ] **Step 6: Boot the server and verify it still serves**

Run: `cd HireWire/agent && HIREWIRE_MASTER_KEY=$(printf 'x%.0s' {1..32}) SWML_BASIC_AUTH_USER=u SWML_BASIC_AUTH_PASSWORD=p APP_DOMAIN=http://localhost:8001 uvicorn main:app --port 8001 &`
Then: `sleep 2 && curl -sf http://localhost:8001/healthz`
Expected: 200 with the health JSON.
Then: `kill %1`.

- [ ] **Step 7: Commit**

```bash
cd HireWire
git add agent/main.py
git commit -m "refactor(agent): drop ngrok fallback; APP_DOMAIN comes from settings"
```

---

## Task 6: Backend Sally → HireWire string rebrand

**Files:**
- Modify: `HireWire/agent/main.py`
- Modify: `HireWire/agent/README.md`
- Modify: `HireWire/pyproject.toml` (root)
- Modify: `HireWire/agent/pyproject.toml`

- [ ] **Step 1: Inventory Sally references in backend files**

Run: `cd HireWire && grep -nri "sally" --include="*.py" --include="*.toml" --include="*.md" agent/ pyproject.toml`

You should see hits in `agent/main.py` (lines around 3, 784, 786, 1122, 1124, 1172), `agent/README.md`, and the two `pyproject.toml` files.

- [ ] **Step 2: Replace string contents in `agent/main.py`**

Edit `HireWire/agent/main.py`:
- Line ~3 (module docstring): replace `Sally Sales AI Agent Backend - Multi-Employee Support` with `HireWire AI Agent Backend - Multi-Tenant Virtual Employee Server`.
- Lines ~784/786 (`sally_idle.mp4` / `sally_talking.mp4`): replace with `idle.mp4` / `talking.mp4`.
- Line ~1122 (`"name": "Sally Sales"`): replace with `"name": "HireWire Demo Employee"`.
- Line ~1124 (`"greeting": "Hello! Welcome to Sally Sales."`): replace with `"greeting": "Hello! Welcome to HireWire."`.
- Line ~1172 (`"prompt": "Welcome to Sally Sales"`): replace with `"prompt": "Welcome to HireWire"`.

(Line numbers may have shifted after Task 5; use the exact text matches from Step 1's grep output.)

- [ ] **Step 3: Update `agent/pyproject.toml` package metadata**

Edit `HireWire/agent/pyproject.toml`'s `[project]` block:

```toml
[project]
name = "hirewire-agent"
version = "0.1.0"
description = "HireWire — multi-tenant SignalWire AI virtual-employee backend"
requires-python = ">=3.11"
```

(Keep dependencies and dev deps as they are.)

- [ ] **Step 4: Update root `HireWire/pyproject.toml`**

Edit `HireWire/pyproject.toml`'s `[project]` block (this file mirrors agent's metadata for the monorepo):

```toml
[project]
name = "hirewire"
version = "0.1.0"
description = "HireWire — SignalWire virtual AI employee demo"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.119.1",
    "pydantic-settings>=2.5.0",
    "python-dotenv>=1.1.1",
    "sendgrid>=6.10.0",
    "signalwire-agents>=1.1.0",
    "uvicorn[standard]>=0.38.0",
]
```

- [ ] **Step 5: Replace `agent/README.md` with a HireWire-branded stub**

Overwrite `HireWire/agent/README.md` with:

```markdown
# HireWire Agent

Python FastAPI backend for HireWire — serves SWML and SWAIG endpoints for the
multi-tenant virtual-employee demo.

## Quickstart (local dev)

```bash
pip install -e ".[dev]"
export HIREWIRE_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
export SWML_BASIC_AUTH_USER=signalwire
export SWML_BASIC_AUTH_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(16))')
uvicorn main:app --reload --port 8000
```

## Tests

```bash
pytest -q
```

See `../docs/superpowers/specs/2026-04-27-hirewire-design.md` for the full
architecture and `../docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md`
for the current phase plan.
```

- [ ] **Step 6: Verify zero remaining Sally references in backend**

Run: `cd HireWire && grep -nri "sally" --include="*.py" --include="*.toml" --include="*.md" agent/ pyproject.toml`
Expected: zero hits.

- [ ] **Step 7: Run pytest**

Run: `cd HireWire/agent && pytest -q`
Expected: `9 passed`.

- [ ] **Step 8: Commit**

```bash
cd HireWire
git add agent/main.py agent/README.md agent/pyproject.toml pyproject.toml
git commit -m "chore(agent): rebrand Sally → HireWire across backend strings"
```

---

## Task 7: Backend `.env.example` + Replit Secrets documentation

**Files:**
- Create: `HireWire/agent/.env.example`
- Create: `HireWire/.env.example` (root, references agent/.env.example)

- [ ] **Step 1: Write a test asserting `.env.example` has the required keys**

Append to `HireWire/agent/tests/test_config.py`:

```python
from pathlib import Path


def test_env_example_lists_required_keys() -> None:
    """`.env.example` must enumerate every required Replit Secret."""
    env_path = Path(__file__).resolve().parent.parent / ".env.example"
    assert env_path.exists(), f"{env_path} must exist"
    content = env_path.read_text()
    for key in (
        "HIREWIRE_MASTER_KEY",
        "SWML_BASIC_AUTH_USER",
        "SWML_BASIC_AUTH_PASSWORD",
        "APP_DOMAIN",
    ):
        assert key in content, f"{key} missing from .env.example"
```

- [ ] **Step 2: Run the new test — expect failure**

Run: `cd HireWire/agent && pytest tests/test_config.py::test_env_example_lists_required_keys -v`
Expected: `AssertionError: <path> must exist`.

- [ ] **Step 3: Create `agent/.env.example`**

Create `HireWire/agent/.env.example`:

```dotenv
# HireWire Agent — required environment variables
# Copy to .env (gitignored) for local dev. On Replit, set these as Secrets.

# REQUIRED — boot fails without these.
HIREWIRE_MASTER_KEY=                    # 32+ chars. Generate: python -c 'import secrets; print(secrets.token_urlsafe(32))'
SWML_BASIC_AUTH_USER=signalwire         # Basic-auth user SignalWire uses to fetch /swml + call /swaig.
SWML_BASIC_AUTH_PASSWORD=               # Basic-auth password. Generate: python -c 'import secrets; print(secrets.token_urlsafe(16))'

# OPTIONAL — derived from Replit env if absent (REPLIT_DEPLOYMENT_URL or REPLIT_DEV_DOMAIN).
APP_DOMAIN=                             # Public HTTPS origin. e.g. https://hirewire.replit.app

# OPTIONAL — defense-in-depth cookie signing key (auto-derived in dev).
SESSION_COOKIE_SECRET=

# OPTIONAL — Phase 5 observability.
SENTRY_DSN=

# OPTIONAL — enables the send_summary SWAIG handler.
SENDGRID_API_KEY=
```

- [ ] **Step 4: Run the test — expect pass**

Run: `cd HireWire/agent && pytest tests/test_config.py::test_env_example_lists_required_keys -v`
Expected: `1 passed`.

- [ ] **Step 5: Run full pytest**

Run: `cd HireWire/agent && pytest -q`
Expected: `10 passed`.

- [ ] **Step 6: Commit**

```bash
cd HireWire
git add agent/.env.example agent/tests/test_config.py
git commit -m "docs(agent): add .env.example documenting required Replit Secrets"
```

---

## Task 8: Frontend strip Replit `__create/` directories

**Files:**
- Delete: `HireWire/web/src/__create/` (entire directory)
- Delete: `HireWire/web/src/app/__create/` (entire directory)
- Modify: `HireWire/web/src/app/routes.ts` (replace not-found import)
- Create: `HireWire/web/src/components/feedback/NotFound.tsx`
- Delete: `HireWire/web/src/auth.js`
- Delete: `HireWire/web/src/utils/useUser.js`
- Delete: `HireWire/web/src/utils/useUpload.js`
- Delete: `HireWire/web/src/utils/useHandleStreamResponse.js`
- Delete: `HireWire/web/src/utils/create.js`

- [ ] **Step 1: Inventory imports of `__create` and the auth/utils helpers we plan to delete**

Run from `HireWire/`:
```bash
grep -rn "from '\./__create\|from '\.\./__create\|from '\.\./\.\./__create\|from 'src/__create\|/__create/" web/src/ | grep -v "node_modules"
grep -rn "from '~/auth\|from '\./auth\|src/auth.js\|from '\.\./utils/useUser\|from '\.\./utils/useUpload\|from '\.\./utils/useHandleStreamResponse\|from '\.\./utils/create" web/src/
```

Capture every importer — they are call sites that will need updating (or to be deleted along with the page).

- [ ] **Step 2: Create the replacement `NotFound` component**

Create `HireWire/web/src/components/feedback/NotFound.tsx`:

```tsx
import { Link } from 'react-router';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="text-4xl font-semibold">404 — page not found</h1>
      <p className="text-slate-400">That page is not part of HireWire.</p>
      <Link
        to="/"
        className="rounded-md bg-indigo-500 px-4 py-2 font-medium text-white hover:bg-indigo-400"
      >
        Go home
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Update `web/src/app/routes.ts` to import the new NotFound**

Find this line in `HireWire/web/src/app/routes.ts`:
```ts
const notFound = route('*?', './__create/not-found.tsx');
```

Replace with:
```ts
const notFound = route('*?', '../components/feedback/NotFound.tsx');
```

- [ ] **Step 4: Delete the two `__create/` directories**

Run from `HireWire/`:
```bash
rm -rf web/src/__create web/src/app/__create
```

- [ ] **Step 5: Delete the unused auth + utils helpers**

Run from `HireWire/`:
```bash
rm -f web/src/auth.js web/src/utils/useUser.js web/src/utils/useUpload.js web/src/utils/useHandleStreamResponse.js web/src/utils/create.js
```

- [ ] **Step 6: Verify there are no remaining imports of deleted modules**

Run from `HireWire/`:
```bash
grep -rn "from '.*__create\|from '\./auth\|from '\.\./auth\|/auth\.js\|useUser\|useUpload\|useHandleStreamResponse\|utils/create" web/src/ || echo "clean"
```
Expected: prints `clean`. If hits remain, those importers must either be deleted (if Sally-only — likely demo-ivr or login pages) or migrated to a sibling utility. For Phase 1 the simplest fix is to delete the file containing the broken import if it is dead code; otherwise replace the import with a local stub. **Note any hits and resolve before proceeding.**

- [ ] **Step 7: Typecheck**

Run from `HireWire/web`:
```bash
npm run typecheck
```
Expected: clean. Fix any reported errors by deleting the offending file (if dead) or stubbing the missing helper.

- [ ] **Step 8: Run vitest**

Run from `HireWire/web`:
```bash
npx vitest run
```
Expected: `1 passed` (the smoke test).

- [ ] **Step 9: Commit**

```bash
cd HireWire
git add -A web/src/
git commit -m "chore(web): strip Replit __create/ scaffolding and orphan auth helpers"
```

---

## Task 9: Frontend strip Sally-Sales `demo-ivr/` pages and dup file

**Files:**
- Delete: `HireWire/web/src/app/demo-ivr/` (entire directory)
- Delete: `HireWire/web/src/components/demo-ivr/` (entire directory — Sally-specific)
- Delete: `HireWire/web/src/app/api/signalwire/fix-sally-webhook/` (Sally-specific endpoint)

- [ ] **Step 1: Inventory imports of demo-ivr / fix-sally-webhook**

Run from `HireWire/`:
```bash
grep -rn "demo-ivr\|fix-sally-webhook" web/src/ | grep -v "node_modules"
```

Note any hits in pages that aren't themselves being deleted.

- [ ] **Step 2: Delete the directories**

Run from `HireWire/`:
```bash
rm -rf web/src/app/demo-ivr web/src/components/demo-ivr web/src/app/api/signalwire/fix-sally-webhook
```

This also removes the duplicate `AdvancedCallControls 2.jsx` (it lived under `web/src/components/demo-ivr/`).

- [ ] **Step 3: Verify no surviving references**

Run from `HireWire/`:
```bash
grep -rn "demo-ivr\|fix-sally-webhook\|AdvancedCallControls" web/src/ || echo "clean"
```
Expected: prints `clean`. If `AdvancedCallControls` still appears (it may be referenced from a dashboard page), that means the dashboard still expects the Sally-style call controls. For Phase 1, replace any such import with a stub `<div>Phase 3 will wire the call panel</div>` — the dashboard call experience is rebuilt in Phase 3.

- [ ] **Step 4: Typecheck**

Run from `HireWire/web`:
```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Run vitest**

Run from `HireWire/web`:
```bash
npx vitest run
```
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
cd HireWire
git add -A web/src/
git commit -m "chore(web): remove demo-ivr/, dup AdvancedCallControls 2.jsx, fix-sally-webhook endpoint"
```

---

## Task 10: Frontend strip `client-integrations/` cruft

**Files:**
- Delete: `HireWire/web/src/client-integrations/` (entire directory — Stripe, Google Maps, Chakra, etc.)

- [ ] **Step 1: Inventory imports**

Run from `HireWire/`:
```bash
grep -rn "client-integrations" web/src/ | grep -v "node_modules"
```

- [ ] **Step 2: Delete the directory**

Run from `HireWire/`:
```bash
rm -rf web/src/client-integrations
```

- [ ] **Step 3: Resolve broken imports**

Run from `HireWire/`:
```bash
grep -rn "client-integrations" web/src/ || echo "clean"
```
Expected: `clean`. If any importer remains, it is dead code from a deleted page; delete it or replace the import with `null`.

- [ ] **Step 4: Typecheck**

Run from `HireWire/web`:
```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd HireWire
git add -A web/src/
git commit -m "chore(web): remove client-integrations/ shims (Stripe, Maps, Chakra, etc.)"
```

---

## Task 11: Frontend prune dead `package.json` dependencies

**Files:**
- Modify: `HireWire/web/package.json` (remove ~15 deps)
- Delete: `HireWire/web/bun.lock` and `HireWire/web/package-lock.json` (regenerated)

- [ ] **Step 1: Edit `web/package.json`**

Open `HireWire/web/package.json` and remove these entries from `dependencies`:

```
"@auth/core"
"@chakra-ui/react"
"@emotion/react"
"@emotion/styled"
"@hono/auth-js"
"@lshay/ui"
"@neondatabase/serverless"
"@vis.gl/react-google-maps"
"argon2"
"papaparse"
"pdfjs-dist"
"stripe"
"three"
```

Leave everything else untouched.

- [ ] **Step 2: Delete lockfiles**

Run from `HireWire/web`:
```bash
rm -f bun.lock package-lock.json
```

- [ ] **Step 3: Reinstall**

Run from `HireWire/web`:
```bash
npm install
```
Expected: completes without errors. Warnings about peer deps are acceptable. Watch for `Cannot find module` errors — they reveal stale imports.

- [ ] **Step 4: Typecheck and fix**

Run from `HireWire/web`:
```bash
npm run typecheck
```

If the typecheck reports a missing module from the pruned list, that means a surviving page imports a removed package. Open the offending file and either:
- Delete the page if it is Sally-specific (e.g., a Stripe billing screen), **or**
- Stub the import with a local placeholder if the page is part of v1 surface area.

Iterate until typecheck is clean.

- [ ] **Step 5: Run vitest**

Run from `HireWire/web`:
```bash
npx vitest run
```
Expected: `1 passed`.

- [ ] **Step 6: Commit**

```bash
cd HireWire
git add web/package.json web/package-lock.json
git rm -f web/bun.lock 2>/dev/null || true
git commit -m "chore(web): prune ~13 dead deps (Stripe, Chakra, three, neon-db, etc.)"
```

---

## Task 12: Frontend Sally → HireWire rebrand

**Files:**
- Modify: every file under `HireWire/web/src/` containing "Sally" or "SALLY"
- Modify: `HireWire/web/src/app/root.tsx` (if it has a `<title>`)
- Modify: `HireWire/web/public/` favicon (if it's branded Sally)

- [ ] **Step 1: Inventory remaining Sally references**

Run from `HireWire/`:
```bash
grep -rn -l "[Ss]ally\|SALLY" web/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.json" --include="*.html" --include="*.md" --include="*.css"
```

- [ ] **Step 2: Replace Sally with HireWire across the listed files**

For each file printed in Step 1:
- "Sally Sales" → "HireWire"
- "Sally" (standalone) → "HireWire"
- "sally" (lowercase, e.g. CSS class names or test data) → "hirewire"
- "SALLY_*" env-var names → "HIREWIRE_*"

Use targeted edits, **not** a recursive `sed -i` — Sally may appear in path-sensitive contexts that need human judgment. (The reviewer subagent will catch misses in Task 16.)

- [ ] **Step 3: Update `web/package.json` `"name"` field**

Edit `HireWire/web/package.json`:
```json
{
  "name": "hirewire-web",
  ...
}
```

- [ ] **Step 4: Verify zero Sally references in `web/`**

Run from `HireWire/`:
```bash
grep -rn "[Ss]ally\|SALLY" web/src/ web/package.json web/index.html 2>/dev/null || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Typecheck + vitest**

Run from `HireWire/web`:
```bash
npm run typecheck && npx vitest run
```
Expected: both green.

- [ ] **Step 6: Commit**

```bash
cd HireWire
git add -A web/
git commit -m "chore(web): rebrand Sally → HireWire across frontend strings + package name"
```

---

## Task 13: Top-level docs rebrand (README, ARCHITECTURE, replit.md)

**Files:**
- Modify: `HireWire/README.md`
- Modify: `HireWire/ARCHITECTURE.md`
- Modify: `HireWire/replit.md`

- [ ] **Step 1: Replace `HireWire/README.md` with a Phase-1-accurate quickstart**

Overwrite `HireWire/README.md` with:

```markdown
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
cd agent
pip install -e ".[dev]"
export HIREWIRE_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
export SWML_BASIC_AUTH_USER=signalwire
export SWML_BASIC_AUTH_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(16))')
uvicorn main:app --reload --port 8000 &

# Frontend
cd ../web
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
cd agent && pytest -q

# Frontend
cd web && npm run test:run
```

## Documentation

- **Design spec**: [`docs/superpowers/specs/2026-04-27-hirewire-design.md`](docs/superpowers/specs/2026-04-27-hirewire-design.md)
- **Phase plans**: [`docs/superpowers/plans/`](docs/superpowers/plans/)
- **Architecture diagrams**: §3 of the design spec.
```

- [ ] **Step 2: Replace `HireWire/replit.md` with a HireWire-aware version**

Overwrite `HireWire/replit.md`:

```markdown
# HireWire — Replit Notes

Full-stack SignalWire demo. Users log in with their SignalWire Project ID, hire
a virtual AI employee from a template gallery, and call it from the browser.

## Architecture

- **Frontend** (`web/`): React Router 7 + Vite + TypeScript + Tailwind + Chakra-free UI primitives. Runs on port 5000.
- **Backend** (`agent/`): FastAPI + `signalwire-agents` SDK. Runs on port 8000.

## Required Replit Secrets

- `HIREWIRE_MASTER_KEY` — 32+ char libsodium key
- `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD`
- *(optional)* `APP_DOMAIN`, `SENTRY_DSN`, `SENDGRID_API_KEY`

## Workflows

- **Backend**: `cd agent && uvicorn main:app --reload --port 8000`
- **Frontend**: `cd web && npm run dev`
- **Project** (parallel): runs both.

## Phase status

Phase 1 complete: repo cleaned, branded HireWire, `/healthz` + `/readyz` live,
secrets documented, CI scaffold green. See
`docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md`.
```

- [ ] **Step 3: Replace `HireWire/ARCHITECTURE.md` with a pointer to the spec**

Overwrite `HireWire/ARCHITECTURE.md`:

```markdown
# HireWire Architecture

The authoritative architecture document is the design spec at
[`docs/superpowers/specs/2026-04-27-hirewire-design.md`](docs/superpowers/specs/2026-04-27-hirewire-design.md).

It covers:

- High-level system architecture (§3)
- Backend module structure (§4)
- Frontend module structure (§5)
- Data model & multi-tenant isolation (§6)
- Auth, sessions, secrets (§7)
- Real-time event flow (§8)
- Testing strategy (§9)
- Observability & error handling (§10)
- Phase-by-phase plan (§11)

This file is intentionally short to avoid drift; update the spec instead.
```

- [ ] **Step 4: Verify zero Sally references at top level**

Run from `HireWire/`:
```bash
grep -in "sally" README.md ARCHITECTURE.md replit.md || echo "clean"
```
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
cd HireWire
git add README.md ARCHITECTURE.md replit.md
git commit -m "docs: rewrite README, ARCHITECTURE, replit.md for HireWire Phase 1"
```

---

## Task 14: Update `.replit` workflows for HireWire

**Files:**
- Modify: `HireWire/.replit`

- [ ] **Step 1: Read the current `.replit`**

Run: `cat HireWire/.replit`

The existing workflows already run agent on 8000 and web on 5000 in parallel — they just need explicit `--reload` for auto-restart on backend changes (frontend Vite dev server already hot-reloads).

- [ ] **Step 2: Update the Backend workflow command**

Edit `HireWire/.replit`. Find:

```toml
[[workflows.workflow.tasks]]
task = "shell.exec"
args = "cd agent && python main.py"
waitForPort = 8000
```

Replace with:

```toml
[[workflows.workflow.tasks]]
task = "shell.exec"
args = "cd agent && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
waitForPort = 8000
```

- [ ] **Step 3: Confirm the deployment line still works**

The existing line:
```toml
run = ["bash", "-c", "(cd agent && uvicorn main:app --host 0.0.0.0 --port 8000) & (cd web && npm run dev -- --port 5000 --host 0.0.0.0)"]
```
… is correct. No change needed.

- [ ] **Step 4: Commit**

```bash
cd HireWire
git add .replit
git commit -m "chore(replit): use uvicorn --reload for backend workflow auto-restart"
```

---

## Task 15: GitHub Actions CI scaffold

**Files:**
- Create: `HireWire/.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `HireWire/.github/workflows/ci.yml`:

```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  agent:
    name: agent (python)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: agent
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: pip
      - name: Install
        run: pip install -e ".[dev]"
      - name: Lint
        run: ruff check .
      - name: Test
        run: pytest -q

  web:
    name: web (typescript)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - name: Install
        run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Test
        run: npm run test:run
```

- [ ] **Step 2: Verify ruff is happy locally**

Run: `cd HireWire/agent && ruff check .`
Expected: zero errors. Fix any reported issues by running `ruff check --fix .` then resolving anything left manually.

- [ ] **Step 3: Verify the full local equivalent of CI passes**

Run from `HireWire/`:
```bash
(cd agent && pip install -e ".[dev]" && ruff check . && pytest -q) && \
(cd web && npm ci && npm run typecheck && npm run test:run)
```
Expected: every step exits 0.

- [ ] **Step 4: Commit**

```bash
cd HireWire
git add .github/
git commit -m "ci: add GitHub Actions workflow for agent + web (lint, typecheck, test)"
```

- [ ] **Step 5: Push and verify CI green on the remote**

```bash
cd HireWire
git push origin main
```
Then: open the GitHub Actions tab on the repo and confirm the latest run is green. If anything fails, the workflow logs will show which job — fix and push again.

---

## Task 16: Phase 1 Definition-of-Done verification

**Files:**
- Create: `HireWire/docs/superpowers/plans/2026-04-27-phase-1-completion-report.md`

- [ ] **Step 1: Run the DoD grep checks**

Run from `HireWire/`:
```bash
echo '== sally check ==' && (grep -rn -i "sally" --include="*.py" --include="*.toml" --include="*.md" --include="*.json" --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" . || echo "clean")
echo '== ngrok check ==' && (grep -rn "jonnykarate\|ngrok" --include="*.py" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" . || echo "clean")
```

Both should report `clean`. If hits remain in committed files (excluding node_modules), open them and finish the rebrand.

- [ ] **Step 2: Run the full test suites**

Run from `HireWire/`:
```bash
(cd agent && pytest -q) && (cd web && npm run typecheck && npm run test:run)
```
Expected: every step exits 0.

- [ ] **Step 3: Boot both services locally and hit `/healthz` + `/readyz`**

Run from `HireWire/`:
```bash
(cd agent && \
  HIREWIRE_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))') \
  SWML_BASIC_AUTH_USER=signalwire \
  SWML_BASIC_AUTH_PASSWORD=$(python -c 'import secrets; print(secrets.token_urlsafe(16))') \
  APP_DOMAIN=http://localhost:8000 \
  uvicorn main:app --port 8000) &
sleep 3
curl -sf http://localhost:8000/healthz | tee /tmp/healthz.json
curl -sf http://localhost:8000/readyz | tee /tmp/readyz.json
kill %1 2>/dev/null || true
```

Both `/tmp/healthz.json` and `/tmp/readyz.json` should contain `"status":"ok"` / `"status":"ready"` respectively.

- [ ] **Step 4: Confirm `npm install` is warning-free for removed deps**

Run from `HireWire/web`:
```bash
rm -rf node_modules package-lock.json
npm install 2>&1 | tail -50
```
Expected: no `npm error` lines; no warnings about packages we deliberately removed (Stripe, Chakra, etc.).

- [ ] **Step 5: Read-through README walkthrough check**

Open `HireWire/README.md` and run through every command in the Quickstart from a fresh terminal. The walkthrough must succeed end-to-end in ≤ 10 minutes (excluding npm install download time). Note any friction in the completion report.

- [ ] **Step 6: Write the completion report**

Create `HireWire/docs/superpowers/plans/2026-04-27-phase-1-completion-report.md`:

```markdown
# Phase 1 Completion Report — 2026-04-27

## DoD checklist

- [x] `npm install` and `pip install` produce no warnings about deprecated/removed deps.
- [x] `git grep -i "sally"` returns zero hits.
- [x] `git grep "jonnykarate"` returns zero hits.
- [x] `npm run typecheck` clean; `pytest --collect-only` lists ≥ 1 placeholder test.
- [x] `/healthz` and `/readyz` both return 200 on Replit.
- [x] README walks a new SE from clone → running demo on Replit in ≤ 10 minutes.

## Test counts

- Backend pytest: <N> passed
- Frontend vitest: <N> passed
- ruff lint: clean

## Stack snapshot at end of Phase 1

- web/package.json: <N> direct deps (was ~70 pre-cleanup)
- agent/main.py: <N> LOC (Phase 2 splits this into modules)
- agent/hirewire/: 4 files (config.py, app.py, routes/__init__.py, routes/health.py)

## Phase 2 readiness

Foundation in place for the Phase 2 backend rewrite:
- pydantic-settings config available via `hirewire.config.get_settings()`
- FastAPI factory (`hirewire.app.create_app`) ready to receive new routers
- Test infra (pytest + httpx + ruff) wired
- Replit Secrets documented
- CI scaffold green
```

Replace each `<N>` with the real count from your runs.

- [ ] **Step 7: Final commit**

```bash
cd HireWire
git add docs/superpowers/plans/2026-04-27-phase-1-completion-report.md
git commit -m "docs: Phase 1 completion report — DoD checklist green"
git push origin main
```

- [ ] **Step 8: Tag the Phase 1 milestone**

```bash
cd HireWire
git tag -a phase-1-complete -m "HireWire Phase 1 — foundation & cleanup"
git push origin phase-1-complete
```

---

## Self-review notes

**Spec coverage**: every Phase 1 work item from §11.1 of the design spec maps to a task above. Replit Secrets list documented (Tasks 7 + 13). Sally rebrand spans Tasks 6 + 12 + 13. Ngrok removal is Task 5. CI is Task 15. `/healthz` + `/readyz` are Task 4. `.replit` update is Task 14. DoD verification is Task 16.

**Type/method consistency**: `Settings` class (Task 3) exposes `hirewire_master_key`, `swml_basic_auth_user`, `swml_basic_auth_password`, `app_domain` — these names match the env var names in `.env.example` (Task 7) and the lookups in the patched `main.py` (Task 5). `create_app()` factory (Task 4) is referenced by the same name in `main.py`'s health-router bolt-on (Task 4 step 8). The `NotFound.tsx` component path (Task 8) matches the `routes.ts` import.

**Out-of-scope (deferred to later phases)**:
- Splitting the 1,248-LOC `main.py` into modules → Phase 2.
- libsodium encryption-at-rest implementation → Phase 2 (key is required *now* via Task 3, but `services/crypto.py` is built in Phase 2).
- Frontend design system / Chakra removal completion → Phase 4 (Phase 1 only drops the package; pages still using Chakra get refactored in Phase 4).
- The 4 templates' actual SWAIG handlers → Phase 2.
- Sentry, structured logging, rate limiting → Phase 5 (Sentry DSN is documented as optional now; wiring is Phase 5).

---

## Execution handoff

Plan complete and saved to `HireWire/docs/superpowers/plans/2026-04-27-phase-1-foundation-cleanup.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, code-review subagent runs between tasks, fastest iteration loop. Required sub-skill: `superpowers:subagent-driven-development`.

2. **Inline Execution** — execute tasks in this session with batch checkpoints for review. Required sub-skill: `superpowers:executing-plans`.

Which approach?
