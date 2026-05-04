import os

import httpx
import pytest
import respx
from fastapi import FastAPI
from fastapi.testclient import TestClient

from agent.lib.internal_auth import HEADER_API_KEY
from agent.routes.auth import router as auth_router


def _build_app():
    app = FastAPI()
    app.include_router(auth_router)
    return app


def _key():
    return os.environ["AGENT_API_KEY"]


@respx.mock
def test_validate_credentials_returns_valid_for_good_creds():
    app = _build_app()
    client = TestClient(app)
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(200, json={})
    )
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "acme.signalwire.com", "project_id": "proj-1234", "api_token": "PT_token_xyz"},
        headers={HEADER_API_KEY: _key()},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["valid"] is True
    assert body["space_url"] == "https://acme.signalwire.com"


@respx.mock
def test_validate_credentials_returns_invalid_for_bad_creds():
    app = _build_app()
    client = TestClient(app)
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(401)
    )
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "acme.signalwire.com", "project_id": "proj-1234", "api_token": "PT_wrong"},
        headers={HEADER_API_KEY: _key()},
    )
    assert r.status_code == 200
    assert r.json()["valid"] is False


def test_validate_credentials_requires_internal_api_key():
    app = _build_app()
    client = TestClient(app)
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "x.com", "project_id": "p1234567", "api_token": "tttttttt"},
    )
    assert r.status_code == 401


@respx.mock
def test_validate_credentials_502s_on_signalwire_5xx():
    app = _build_app()
    client = TestClient(app)
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(503)
    )
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "acme.signalwire.com", "project_id": "proj-1234", "api_token": "PT_token"},
        headers={HEADER_API_KEY: _key()},
    )
    assert r.status_code == 502


def test_validate_credentials_422_on_short_input():
    app = _build_app()
    client = TestClient(app)
    r = client.post(
        "/api/auth/validate-credentials",
        json={"space_url": "x", "project_id": "p", "api_token": "t"},
        headers={HEADER_API_KEY: _key()},
    )
    assert r.status_code == 422
