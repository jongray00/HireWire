"""Smoke tests for the composed ``agent.app`` entry point.

These tests use the in-memory app object directly rather than reloading the
module — agent.app is shared with agent.main, so reloading risks accumulating
duplicate middleware/routers across the test session.
"""
from fastapi.testclient import TestClient

from agent.app import app


def test_app_includes_auth_router():
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/auth/validate-credentials" in paths


def test_existing_main_routes_preserved():
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert "/api/create-employee" in paths


def test_webhook_middleware_off_by_default():
    """Without HIREWIRE_MULTI_TENANT_AUTH=1, /swml/* should not 401 from
    the per-project webhook middleware (it 404s instead because no such
    employee is registered)."""
    client = TestClient(app)
    r = client.get("/swml/test_employee")
    assert r.status_code != 401


def test_validate_credentials_route_requires_internal_api_key():
    """The auth router rejects requests without X-Agent-API-Key."""
    client = TestClient(app)
    r = client.post(
        "/api/auth/validate-credentials",
        json={
            "space_url": "x.signalwire.com",
            "project_id": "proj-1234",
            "api_token": "tok-12345",
        },
    )
    assert r.status_code == 401


def test_request_id_middleware_attaches_header():
    client = TestClient(app)
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "x", "project_id": "p", "api_token": "t"},
    )
    # Even on 4xx, the request-id header should be present.
    assert "X-Request-ID" in r.headers
    assert len(r.headers["X-Request-ID"]) > 0
