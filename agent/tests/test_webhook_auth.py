import base64

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from agent.lib.db import open_connection
from agent.lib.migrate import run_migrations
from agent.lib.projects_repo import (
    get_decrypted_webhook_password,
    upsert_project,
)
from agent.lib.webhook_auth import WebhookAuthMiddleware, _parse_basic_auth_header


def _build_app(db_path):
    app = FastAPI()
    app.add_middleware(WebhookAuthMiddleware, db_path=db_path)

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/swml/test")
    def swml_test(request: Request):
        return {"project_id": request.state.project_id}

    @app.post("/swaig/foo")
    def swaig_foo(request: Request):
        return {"project_id": request.state.project_id}

    @app.post("/post-prompt/x")
    def post_prompt_x(request: Request):
        return {"project_id": request.state.project_id}

    return app


def _seed_project(db_path, *, project_id: str = "proj-test-1"):
    conn = open_connection(db_path)
    run_migrations(conn)
    upsert_project(conn, project_id=project_id, space_url="x.signalwire.com", auth_token="t")
    pw = get_decrypted_webhook_password(conn, project_id)
    conn.close()
    return pw


def _basic_auth(user, pw):
    return "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()


def test_unprotected_path_passes_through(tmp_path):
    db_path = tmp_path / "x.db"
    open_connection(db_path).close()
    client = TestClient(_build_app(db_path))
    r = client.get("/health")
    assert r.status_code == 200


def test_protected_path_requires_auth(tmp_path):
    db_path = tmp_path / "x.db"
    _seed_project(db_path)
    client = TestClient(_build_app(db_path))
    r = client.get("/swml/test")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate", "").startswith('Basic realm="HireWire"')


def test_correct_creds_pass_and_set_project_id(tmp_path):
    db_path = tmp_path / "x.db"
    pw = _seed_project(db_path, project_id="proj-test-1")
    client = TestClient(_build_app(db_path))
    r = client.get("/swml/test", headers={"Authorization": _basic_auth("proj-test-1", pw)})
    assert r.status_code == 200
    assert r.json() == {"project_id": "proj-test-1"}


def test_wrong_password_returns_401(tmp_path):
    db_path = tmp_path / "x.db"
    _seed_project(db_path, project_id="proj-1")
    client = TestClient(_build_app(db_path))
    r = client.get("/swml/test", headers={"Authorization": _basic_auth("proj-1", "wrong")})
    assert r.status_code == 401


def test_unknown_project_returns_401(tmp_path):
    db_path = tmp_path / "x.db"
    _seed_project(db_path, project_id="proj-1")
    client = TestClient(_build_app(db_path))
    r = client.get(
        "/swml/test",
        headers={"Authorization": _basic_auth("nonexistent-project", "anything")},
    )
    assert r.status_code == 401


def test_cross_project_isolation(tmp_path):
    """Project A's webhook creds cannot authenticate as project B."""
    db_path = tmp_path / "x.db"
    pw_a = _seed_project(db_path, project_id="proj-a")
    pw_b = _seed_project(db_path, project_id="proj-b")
    client = TestClient(_build_app(db_path))
    # B's password with A's username → 401
    r = client.get("/swml/test", headers={"Authorization": _basic_auth("proj-a", pw_b)})
    assert r.status_code == 401
    # A's password with A's username → 200
    r = client.get("/swml/test", headers={"Authorization": _basic_auth("proj-a", pw_a)})
    assert r.status_code == 200
    assert r.json()["project_id"] == "proj-a"


def test_malformed_auth_header_returns_401(tmp_path):
    db_path = tmp_path / "x.db"
    _seed_project(db_path)
    client = TestClient(_build_app(db_path))
    r = client.get("/swml/test", headers={"Authorization": "Bearer xyz"})
    assert r.status_code == 401
    r = client.get("/swml/test", headers={"Authorization": "Basic !!!notbase64"})
    assert r.status_code == 401
    r = client.get("/swml/test", headers={"Authorization": "Basic " + base64.b64encode(b"nopassword").decode()})
    assert r.status_code == 401


def test_swaig_post_path_protected(tmp_path):
    db_path = tmp_path / "x.db"
    pw = _seed_project(db_path, project_id="proj-1")
    client = TestClient(_build_app(db_path))
    r = client.post("/swaig/foo", headers={"Authorization": _basic_auth("proj-1", pw)})
    assert r.status_code == 200


def test_post_prompt_path_protected(tmp_path):
    db_path = tmp_path / "x.db"
    pw = _seed_project(db_path, project_id="proj-1")
    client = TestClient(_build_app(db_path))
    r = client.post("/post-prompt/x", headers={"Authorization": _basic_auth("proj-1", pw)})
    assert r.status_code == 200


def test_disabled_project_cannot_authenticate(tmp_path):
    """When a project is disabled, get_decrypted_webhook_password returns None."""
    db_path = tmp_path / "x.db"
    pw = _seed_project(db_path, project_id="proj-1")
    # disable the project
    from agent.lib.projects_repo import disable_project
    conn = open_connection(db_path)
    disable_project(conn, "proj-1")
    conn.close()

    client = TestClient(_build_app(db_path))
    r = client.get("/swml/test", headers={"Authorization": _basic_auth("proj-1", pw)})
    assert r.status_code == 401


def test_parse_basic_auth_header_unit():
    user, pw = _parse_basic_auth_header("Basic " + base64.b64encode(b"u:p").decode())
    assert (user, pw) == ("u", "p")
