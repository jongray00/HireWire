import pytest
import secrets
import base64


@pytest.fixture
def encryption_key() -> str:
    """Exposed as a separate fixture so tests can request a stable key for
    encrypt/decrypt round-trips.
    """
    return base64.b64encode(secrets.token_bytes(32)).decode()


@pytest.fixture(autouse=True)
def isolated_env(monkeypatch, tmp_path, encryption_key):
    """Every test gets a clean env with a fresh encryption key and tmp DB.

    To test missing/invalid env, use monkeypatch.delenv() or monkeypatch.setenv()
    inside the test — the per-test monkeypatch will override these autouse values.
    """
    monkeypatch.setenv("ENCRYPTION_KEY", encryption_key)
    monkeypatch.setenv("AGENT_API_KEY", "test-" + secrets.token_urlsafe(32))
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "https://agent.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://web.test")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LOG_LEVEL", "WARNING")
    # Reset cached crypto + config between tests so a fresh ENCRYPTION_KEY is used
    from agent.lib import crypto
    crypto._reset_cache_for_tests()
    yield
