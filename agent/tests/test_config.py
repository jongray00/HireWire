"""Tests for hirewire.config — must fail fast when required secrets are missing."""

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


def test_app_domain_local_dev_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")
    monkeypatch.delenv("APP_DOMAIN", raising=False)
    monkeypatch.delenv("REPLIT_DEPLOYMENT_URL", raising=False)
    monkeypatch.delenv("REPLIT_DEV_DOMAIN", raising=False)

    from hirewire.config import Settings

    assert Settings().app_domain == "http://localhost:8000"


def test_env_example_lists_required_keys() -> None:
    """`.env.example` must enumerate every required Replit Secret."""
    from pathlib import Path

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
