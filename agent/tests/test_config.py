import base64
import os
import secrets
import pytest
from agent.lib.config import Config, ConfigError


def test_config_loads_required_values(monkeypatch, tmp_path):
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(secrets.token_bytes(32)).decode())
    monkeypatch.setenv("AGENT_API_KEY", "x" * 40)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.real")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "https://agent.example.com")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://web.example.com")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))

    cfg = Config.load()

    assert len(cfg.encryption_key_bytes) == 32
    assert cfg.agent_api_key.startswith("x")
    assert cfg.public_base_url_agent == "https://agent.example.com"
    assert cfg.data_dir == tmp_path
    assert cfg.db_path == tmp_path / "hirewire.db"


def test_config_missing_required_raises(monkeypatch):
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(ConfigError, match="ENCRYPTION_KEY"):
        Config.load()


def test_config_short_api_key_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(secrets.token_bytes(32)).decode())
    monkeypatch.setenv("AGENT_API_KEY", "tooshort")
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.x")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "https://a.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://w.test")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    with pytest.raises(ConfigError, match="AGENT_API_KEY.*length"):
        Config.load()


def test_config_wrong_encryption_key_length_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(secrets.token_bytes(16)).decode())
    monkeypatch.setenv("AGENT_API_KEY", "x" * 40)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.x")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "https://a.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://w.test")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    with pytest.raises(ConfigError, match="ENCRYPTION_KEY.*32"):
        Config.load()


def test_config_http_url_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv("ENCRYPTION_KEY", base64.b64encode(secrets.token_bytes(32)).decode())
    monkeypatch.setenv("AGENT_API_KEY", "x" * 40)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.x")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "http://insecure.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://w.test")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    with pytest.raises(ConfigError, match="https"):
        Config.load()


def test_config_malformed_base64_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv("ENCRYPTION_KEY", "not!valid@base64")
    monkeypatch.setenv("AGENT_API_KEY", "x" * 40)
    monkeypatch.setenv("SENDGRID_API_KEY", "SG.x")
    monkeypatch.setenv("PUBLIC_BASE_URL_AGENT", "https://a.test")
    monkeypatch.setenv("PUBLIC_BASE_URL_WEB", "https://w.test")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    with pytest.raises(ConfigError, match="base64"):
        Config.load()
