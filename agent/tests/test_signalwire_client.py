import base64

import httpx
import pytest
import respx

from agent.lib.signalwire_client import (
    SignalWireError,
    _basic_auth_header,
    _normalize_space_url,
    validate_credentials,
)


def test_basic_auth_header_format():
    h = _basic_auth_header("PROJID", "TOKEN")
    assert h.startswith("Basic ")
    decoded = base64.b64decode(h[6:]).decode("utf-8")
    assert decoded == "PROJID:TOKEN"


@pytest.mark.parametrize(
    "given,expected",
    [
        ("acme.signalwire.com", "https://acme.signalwire.com"),
        ("https://acme.signalwire.com", "https://acme.signalwire.com"),
        ("https://acme.signalwire.com/", "https://acme.signalwire.com"),
        ("  acme.signalwire.com  ", "https://acme.signalwire.com"),
    ],
)
def test_normalize_space_url(given, expected):
    assert _normalize_space_url(given) == expected


@respx.mock
def test_validate_credentials_returns_valid_on_200():
    route = respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(200, json={"data": []})
    )
    result = validate_credentials("acme.signalwire.com", "proj", "tok")
    assert result.valid is True
    assert result.status_code == 200
    assert result.space_url == "https://acme.signalwire.com"
    assert route.called


@respx.mock
def test_validate_credentials_returns_invalid_on_401():
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(401, text="unauthorized")
    )
    result = validate_credentials("acme.signalwire.com", "proj", "wrong")
    assert result.valid is False
    assert result.status_code == 401


@respx.mock
def test_validate_credentials_returns_invalid_on_403():
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(403, text="forbidden")
    )
    result = validate_credentials("acme.signalwire.com", "proj", "tok")
    assert result.valid is False
    assert result.status_code == 403


@respx.mock
def test_validate_credentials_raises_on_500():
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(500, text="oops")
    )
    with pytest.raises(SignalWireError, match="500"):
        validate_credentials("acme.signalwire.com", "proj", "tok")


@respx.mock
def test_validate_credentials_raises_on_network_error():
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        side_effect=httpx.ConnectError("connection refused")
    )
    with pytest.raises(SignalWireError, match="network error"):
        validate_credentials("acme.signalwire.com", "proj", "tok")


@respx.mock
def test_validate_credentials_sends_basic_auth_header():
    route = respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(200, json={})
    )
    validate_credentials("acme.signalwire.com", "PROJ", "TOKEN")
    sent_auth = route.calls.last.request.headers.get("authorization")
    assert sent_auth == "Basic " + base64.b64encode(b"PROJ:TOKEN").decode()


@respx.mock
def test_validate_credentials_retries_on_503_then_succeeds():
    sleeps = []

    route = respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        side_effect=[
            httpx.Response(503, text="busy"),
            httpx.Response(503, text="busy"),
            httpx.Response(200, json={}),
        ]
    )
    result = validate_credentials(
        "acme.signalwire.com", "p", "t", sleep=lambda d: sleeps.append(d)
    )
    assert result.valid is True
    assert route.call_count == 3
    # Two backoffs between the three attempts
    assert len(sleeps) == 2
    assert sleeps[1] > sleeps[0]


@respx.mock
def test_validate_credentials_does_not_retry_401():
    route = respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(401)
    )
    sleeps = []
    result = validate_credentials(
        "acme.signalwire.com", "p", "wrong", sleep=lambda d: sleeps.append(d)
    )
    assert result.valid is False
    assert route.call_count == 1  # no retry on 401
    assert sleeps == []


@respx.mock
def test_validate_credentials_retries_on_network_error():
    sleeps = []
    # First two attempts fail with ConnectError, third succeeds
    route = respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        side_effect=[
            httpx.ConnectError("refused"),
            httpx.ConnectError("refused"),
            httpx.Response(200, json={}),
        ]
    )
    result = validate_credentials(
        "acme.signalwire.com", "p", "t", sleep=lambda d: sleeps.append(d)
    )
    assert result.valid is True
    assert route.call_count == 3
    assert len(sleeps) == 2


@respx.mock
def test_validate_credentials_exhausts_retries_on_persistent_5xx():
    respx.get("https://acme.signalwire.com/api/fabric/resources").mock(
        return_value=httpx.Response(503)
    )
    sleeps = []
    with pytest.raises(SignalWireError, match="503"):
        validate_credentials(
            "acme.signalwire.com", "p", "t", sleep=lambda d: sleeps.append(d)
        )
    # 3 attempts → 2 backoffs
    assert len(sleeps) == 2
