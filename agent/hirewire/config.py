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
        ...,
        min_length=32,
        description="32-byte libsodium key (base64 ok); rotation forces re-login.",
    )
    swml_basic_auth_user: str = Field(..., min_length=1)
    swml_basic_auth_password: str = Field(..., min_length=1)

    # Optional / derived.
    app_domain: str = Field(
        default="",
        description="Public HTTPS origin SignalWire uses to reach /swml and /swaig.",
    )
    session_cookie_secret: str = Field(
        default="",
        description="HMAC key for session cookie. Auto-derived in dev.",
    )
    sendgrid_api_key: str = Field(
        default="",
        description="Optional. Enables send_summary SWAIG handler.",
    )
    sentry_dsn: str = Field(
        default="",
        description="Optional. Phase 5 observability.",
    )

    @model_validator(mode="after")
    def _resolve_app_domain(self) -> Settings:
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
