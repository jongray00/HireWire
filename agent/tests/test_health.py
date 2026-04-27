"""Tests for /healthz (liveness) and /readyz (readiness) endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")

    # Import inside fixture, not at module top: env vars must be set before
    # the autouse cache-clear fires and the next get_settings() reads them.
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


def test_version_endpoint(client: TestClient) -> None:
    r = client.get("/version")
    assert r.status_code == 200
    body = r.json()
    assert "version" in body
    assert "git_sha" in body


def test_readyz_returns_503_when_app_domain_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """When no APP_DOMAIN is set and Replit env vars are absent, app_domain falls
    back to http://localhost:8000 (which IS truthy). To force the 503 path we
    must construct a Settings instance whose app_domain ends up empty — which
    can't happen in normal flow because the field_validator always returns a
    non-empty string. So we patch get_settings() to return a Settings-shaped
    object with app_domain="" instead.
    """
    from types import SimpleNamespace

    from hirewire import app as app_module
    from hirewire.routes import health as health_module

    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")

    fake = SimpleNamespace(
        hirewire_master_key="x" * 32,
        swml_basic_auth_user="u",
        swml_basic_auth_password="p",
        app_domain="",
    )
    monkeypatch.setattr(health_module, "get_settings", lambda: fake)

    client = TestClient(app_module.create_app())
    r = client.get("/readyz")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "not_ready"
    assert body["checks"]["app_domain"] == ""
