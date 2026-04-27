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
