import re

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from agent.lib.request_id import REQUEST_ID_HEADER, RequestIdMiddleware


def _build_app():
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/echo")
    def echo(request: Request):
        return {"request_id": request.state.request_id}

    return app


def test_generates_request_id_when_header_missing():
    client = TestClient(_build_app())
    r = client.get("/echo")
    assert r.status_code == 200
    rid = r.json()["request_id"]
    assert re.fullmatch(r"[0-9a-f]{32}", rid)
    assert r.headers[REQUEST_ID_HEADER] == rid


def test_honors_incoming_request_id_header():
    client = TestClient(_build_app())
    r = client.get("/echo", headers={REQUEST_ID_HEADER: "client-supplied-123"})
    assert r.json()["request_id"] == "client-supplied-123"
    assert r.headers[REQUEST_ID_HEADER] == "client-supplied-123"


def test_overlong_request_id_is_replaced():
    client = TestClient(_build_app())
    too_long = "x" * 129
    r = client.get("/echo", headers={REQUEST_ID_HEADER: too_long})
    rid = r.json()["request_id"]
    assert rid != too_long
    assert re.fullmatch(r"[0-9a-f]{32}", rid)


def test_distinct_request_ids_for_distinct_requests():
    client = TestClient(_build_app())
    a = client.get("/echo").json()["request_id"]
    b = client.get("/echo").json()["request_id"]
    assert a != b
