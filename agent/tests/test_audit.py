import json

import pytest

from agent.lib.audit import write_audit, AuditAction, _MAX_METADATA_BYTES
from agent.lib.db import open_connection, transaction
from agent.lib.migrate import run_migrations


def _migrated_conn(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    run_migrations(conn)
    return conn


def test_write_audit_persists_row(tmp_path):
    conn = _migrated_conn(tmp_path)
    write_audit(
        conn,
        project_id="proj-1",
        actor="web:proj-1",
        action=AuditAction.LOGIN_SUCCESS,
        target_type="project",
        target_id="proj-1",
        ip_address="10.0.0.1",
        metadata={"display_name": "Acme"},
    )
    row = conn.execute("SELECT * FROM audit_log").fetchone()
    assert row["project_id"] == "proj-1"
    assert row["action"] == "login.success"
    assert row["actor"] == "web:proj-1"
    assert row["ip_address"] == "10.0.0.1"
    assert json.loads(row["metadata_json"]) == {"display_name": "Acme"}


def test_write_audit_redacts_sensitive_metadata_keys(tmp_path):
    conn = _migrated_conn(tmp_path)
    write_audit(
        conn,
        project_id="proj-1",
        actor="system",
        action=AuditAction.CREDS_DECRYPT,
        metadata={"auth_token": "supersecret", "purpose": "swml"},
    )
    row = conn.execute("SELECT metadata_json FROM audit_log").fetchone()
    md = json.loads(row["metadata_json"])
    assert md["auth_token"] == "<redacted>"
    assert md["purpose"] == "swml"


def test_write_audit_truncates_large_metadata(tmp_path):
    conn = _migrated_conn(tmp_path)
    big = {"note": "x" * 100_000}
    write_audit(conn, project_id="p", actor="system", action=AuditAction.LOGIN_FAIL, metadata=big)
    row = conn.execute("SELECT metadata_json FROM audit_log").fetchone()
    assert len(row["metadata_json"]) <= _MAX_METADATA_BYTES + 100
    md = json.loads(row["metadata_json"])
    assert md["_truncated"] is True
    assert md["size"] >= 100_000


def test_write_audit_rolls_back_with_parent_transaction(tmp_path):
    conn = _migrated_conn(tmp_path)
    with pytest.raises(RuntimeError):
        with transaction(conn):
            write_audit(conn, actor="x", action=AuditAction.LOGIN_FAIL)
            raise RuntimeError("boom")
    count = conn.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    assert count == 0


def test_write_audit_coerces_bytes_to_length_sentinel(tmp_path):
    conn = _migrated_conn(tmp_path)
    write_audit(
        conn,
        project_id="p",
        actor="system",
        action=AuditAction.SECRET_ACCESS,
        metadata={"blob": b"raw-credential-bytes"},
    )
    row = conn.execute("SELECT metadata_json FROM audit_log").fetchone()
    md = json.loads(row["metadata_json"])
    assert md["blob"] == f"<binary len={len(b'raw-credential-bytes')}>"
    assert "raw-credential-bytes" not in row["metadata_json"]


def test_write_audit_redacts_expanded_credential_keys(tmp_path):
    conn = _migrated_conn(tmp_path)
    metadata = {
        "client_secret": "cs",
        "private_key": "pk",
        "refresh_token": "rt",
        "access_token": "at",
        "authorization": "Bearer xyz",
        "kept": "ok",
    }
    write_audit(conn, project_id="p", actor="system", action=AuditAction.CREDS_DECRYPT, metadata=metadata)
    row = conn.execute("SELECT metadata_json FROM audit_log").fetchone()
    md = json.loads(row["metadata_json"])
    for k in ("client_secret", "private_key", "refresh_token", "access_token", "authorization"):
        assert md[k] == "<redacted>", f"{k} not redacted"
    assert md["kept"] == "ok"
