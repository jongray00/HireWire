import json

import pytest
import structlog

from agent.lib.logging_setup import configure_logging
from agent.lib.swaig_log import log_swaig


def _setup_logging():
    structlog.reset_defaults()
    configure_logging("INFO")


class FakeAgent:
    @log_swaig("test_fn")
    def call(self, args, raw_data=None):
        return {"ok": True, "args": args}

    @log_swaig("boom_fn")
    def boom(self, args, raw_data=None):
        raise RuntimeError("kaboom")


def _read_lines(captured) -> list[dict]:
    return [json.loads(l) for l in captured.out.strip().splitlines() if l.strip()]


def test_entry_and_exit_logged_on_success(capsys):
    _setup_logging()
    FakeAgent().call({"name": "alice"})
    out = _read_lines(capsys.readouterr())
    events = {e.get("event") for e in out}
    assert {"swaig.entry", "swaig.exit"} <= events
    exit_event = next(e for e in out if e.get("event") == "swaig.exit")
    assert exit_event["function"] == "test_fn"
    assert exit_event["ok"] is True
    assert isinstance(exit_event["duration_ms"], int)


def test_entry_args_are_redacted(capsys):
    _setup_logging()
    FakeAgent().call({"name": "alice", "auth_token": "supersecret"})
    out = _read_lines(capsys.readouterr())
    entry = next(e for e in out if e.get("event") == "swaig.entry")
    assert entry["args"]["auth_token"] == "<redacted>"
    assert entry["args"]["name"] == "alice"


def test_exception_logs_error_event_and_reraises(capsys):
    _setup_logging()
    with pytest.raises(RuntimeError, match="kaboom"):
        FakeAgent().boom({})
    out = _read_lines(capsys.readouterr())
    err = next(e for e in out if e.get("event") == "swaig.exit")
    assert err["ok"] is False
    assert err["error_type"] == "RuntimeError"
    assert "kaboom" in err["error_msg"]
