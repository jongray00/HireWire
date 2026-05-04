import json

from agent.lib.log_redact import redact_event_dict
from agent.lib.logging_setup import configure_logging, get_logger


def test_redacts_sensitive_keys():
    out = redact_event_dict(None, "info", {"auth_token": "abc", "msg": "ok"})
    assert out["auth_token"] == "<redacted>"
    assert out["msg"] == "ok"


def test_masks_phone_numbers():
    out = redact_event_dict(None, "info", {"caller_number": "+15551234567"})
    assert out["caller_number"] == "+****4567"


def test_masks_short_phone_numbers():
    out = redact_event_dict(None, "info", {"phone_number": "12"})
    assert out["phone_number"] == "+****"


def test_replaces_blob_fields_with_size():
    out = redact_event_dict(None, "info", {"transcript": "x" * 500})
    assert "encrypted" in out["transcript"]
    assert "500" in out["transcript"]


def test_masks_emails():
    out = redact_event_dict(None, "info", {"email": "alice@example.com"})
    assert out["email"] == "a****@****.com"


def test_redacts_authorization_header_value():
    out = redact_event_dict(None, "info", {"headers": {"Authorization": "Bearer abc"}})
    assert out["headers"]["Authorization"] == "<redacted>"


def test_configure_logging_redacts_in_rendered_json(capsys):
    import structlog
    structlog.reset_defaults()
    configure_logging("INFO")
    get_logger("t").info("hello", auth_token="abc", caller_number="+15551234567")
    out = capsys.readouterr().out
    assert out.strip(), "no output captured from configured logger"
    line = out.strip().splitlines()[-1]
    payload = json.loads(line)
    assert payload["auth_token"] == "<redacted>"
    assert payload["caller_number"] == "+****4567"
    assert payload["event"] == "hello"
    assert payload["level"] == "info"
    assert "timestamp" in payload
