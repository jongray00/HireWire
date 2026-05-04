import os

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from agent.lib.internal_auth import (
    HEADER_API_KEY,
    HEADER_PROJECT_ID,
    InternalCaller,
    require_internal_caller,
)


def _build_app():
    app = FastAPI()

    @app.get("/internal/ping")
    def ping(caller: InternalCaller = Depends(require_internal_caller)):
        return {"project_id": caller.project_id}

    return app


def test_missing_api_key_returns_401(monkeypatch):
    app = _build_app()
    client = TestClient(app)
    r = client.get("/internal/ping")
    assert r.status_code == 401
    assert "missing" in r.json()["detail"].lower()


def test_wrong_api_key_returns_401():
    app = _build_app()
    client = TestClient(app)
    r = client.get("/internal/ping", headers={HEADER_API_KEY: "wrong-key-of-sufficient-length-12345"})
    assert r.status_code == 401
    assert "invalid" in r.json()["detail"].lower()


def test_correct_api_key_returns_200_and_propagates_project_id():
    app = _build_app()
    client = TestClient(app)
    correct_key = os.environ["AGENT_API_KEY"]
    r = client.get(
        "/internal/ping",
        headers={HEADER_API_KEY: correct_key, HEADER_PROJECT_ID: "proj-42"},
    )
    assert r.status_code == 200
    assert r.json() == {"project_id": "proj-42"}


def test_correct_api_key_without_project_id_still_succeeds():
    app = _build_app()
    client = TestClient(app)
    correct_key = os.environ["AGENT_API_KEY"]
    r = client.get("/internal/ping", headers={HEADER_API_KEY: correct_key})
    assert r.status_code == 200
    assert r.json() == {"project_id": None}
