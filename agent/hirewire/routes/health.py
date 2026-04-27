"""Liveness and readiness endpoints.

`/healthz` — process is up. Used by Replit auto-restart.
`/readyz`  — DB connection (Phase 2), Replit Secrets loaded, basic config valid.
              Returns 503 if any check fails so deploy gates can refuse to roll.
`/version` — git SHA + build time so SEs can confirm version mid-demo.
"""

from __future__ import annotations

import os

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
    return {
        "version": __version__,
        "git_sha": os.getenv("REPLIT_GIT_COMMIT", "unknown"),
    }
