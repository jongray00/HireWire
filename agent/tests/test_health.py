"""Tests for /healthz (liveness) and /readyz (readiness) endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("HIREWIRE_MASTER_KEY", "x" * 32)
    monkeypatch.setenv("SWML_BASIC_AUTH_USER", "u")
    monkeypatch.setenv("SWML_BASIC_AUTH_PASSWORD", "p")

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
