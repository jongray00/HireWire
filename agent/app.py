"""HireWire agent application entry point.

Composes the existing single-tenant ``main.app`` with the multi-tenant Phase 2
additions: structured logging, the auth router, and (opt-in) the per-project
webhook basic-auth middleware.

The webhook middleware is gated behind ``HIREWIRE_MULTI_TENANT_AUTH=1`` so the
existing single-tenant local-dev flow keeps working until a tenant is fully
provisioned end-to-end. Once the web layer is wired up to log in and provision
projects, flip the env var.

Run with: ``uvicorn agent.app:app --host 0.0.0.0 --port 8000``
"""
from __future__ import annotations

import os

from agent.lib.request_id import RequestIdMiddleware
from agent.lib.webhook_auth import WebhookAuthMiddleware
from agent.main import app as base_app
from agent.routes.auth import router as auth_router


def _maybe_configure_full_stack() -> None:
    """If the multi-tenant env vars are set, validate them and configure logging.

    During the transition we don't want this to crash the process if the user
    hasn't set up the new env vars yet — single-tenant ``main.py`` should still
    boot. We only fail-fast when ``HIREWIRE_MULTI_TENANT_AUTH=1`` explicitly
    opts in.
    """
    if os.environ.get("HIREWIRE_MULTI_TENANT_AUTH") != "1":
        return
    # Imports + logger creation are deferred so test runs don't poison
    # structlog's cached wrapper class.
    from agent.lib.config import load_or_exit
    from agent.lib.logging_setup import configure_logging, get_logger
    cfg = load_or_exit()
    configure_logging(cfg.log_level)
    get_logger(__name__).info(
        "hirewire.boot", multi_tenant_auth=True, db_path=str(cfg.db_path)
    )


_maybe_configure_full_stack()

app = base_app
app.add_middleware(RequestIdMiddleware)
app.include_router(auth_router)

if os.environ.get("HIREWIRE_MULTI_TENANT_AUTH") == "1":
    from agent.lib.config import Config
    from agent.lib.logging_setup import get_logger
    _cfg = Config.load()
    app.add_middleware(WebhookAuthMiddleware, db_path=_cfg.db_path)
    get_logger(__name__).info(
        "hirewire.boot.middleware_enabled",
        protected_prefixes=["/swml", "/swaig", "/post-prompt"],
    )
