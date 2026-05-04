import pytest

from agent.lib.db import open_connection, transaction
from agent.lib.migrate import run_migrations
from agent.lib.projects_repo import (
    Project,
    disable_project,
    get_decrypted_auth_token,
    get_decrypted_webhook_password,
    get_project,
    list_projects,
    set_wizard_resource,
    upsert_project,
)


def _migrated_conn(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    run_migrations(conn)
    return conn


def test_upsert_inserts_new_project(tmp_path):
    conn = _migrated_conn(tmp_path)
    p = upsert_project(
        conn,
        project_id="proj-uuid-1",
        space_url="example.signalwire.com",
        auth_token="PT_secret_token",
        display_name="Acme Corp",
    )
    assert p.id == "proj-uuid-1"
    assert p.space_url == "example.signalwire.com"
    assert p.display_name == "Acme Corp"
    assert p.status == "active"
    assert p.first_seen_at == p.last_login_at  # first insert
    assert p.wizard_status == "pending"


def test_upsert_round_trip_encrypts_auth_token(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(
        conn,
        project_id="proj-1",
        space_url="x.signalwire.com",
        auth_token="PT_my_token",
    )
    # Stored as ciphertext, never plaintext
    row = conn.execute("SELECT auth_token_enc FROM projects WHERE id = ?", ("proj-1",)).fetchone()
    assert b"PT_my_token" not in row["auth_token_enc"]
    # And we can decrypt it back
    assert get_decrypted_auth_token(conn, "proj-1") == "PT_my_token"


def test_upsert_generates_webhook_password(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
    pw = get_decrypted_webhook_password(conn, "p")
    assert pw is not None
    assert len(pw) >= 30


def test_upsert_existing_project_rotates_webhook_password(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(conn, project_id="p", space_url="x.com", auth_token="t1")
    pw1 = get_decrypted_webhook_password(conn, "p")
    upsert_project(conn, project_id="p", space_url="x.com", auth_token="t2")
    pw2 = get_decrypted_webhook_password(conn, "p")
    assert pw1 != pw2
    # And auth token rotated too
    assert get_decrypted_auth_token(conn, "p") == "t2"


def test_upsert_existing_updates_last_login_preserves_first_seen(tmp_path):
    conn = _migrated_conn(tmp_path)
    p1 = upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
    import time as _t
    _t.sleep(1.01)
    p2 = upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
    assert p2.first_seen_at == p1.first_seen_at
    assert p2.last_login_at > p1.last_login_at


def test_get_project_returns_none_for_missing(tmp_path):
    conn = _migrated_conn(tmp_path)
    assert get_project(conn, "missing") is None


def test_list_projects_only_returns_active_by_default(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(conn, project_id="a", space_url="x.com", auth_token="t")
    upsert_project(conn, project_id="b", space_url="x.com", auth_token="t")
    disable_project(conn, "b")
    active = list_projects(conn)
    ids = {p.id for p in active}
    assert ids == {"a"}


def test_disabled_project_not_returned_by_decrypt_helpers(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
    disable_project(conn, "p")
    assert get_decrypted_auth_token(conn, "p") is None
    assert get_decrypted_webhook_password(conn, "p") is None


def test_set_wizard_resource_updates_id_and_status(tmp_path):
    conn = _migrated_conn(tmp_path)
    upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
    set_wizard_resource(conn, "p", resource_id="res-123", status="ready")
    p = get_project(conn, "p")
    assert p.wizard_resource_id == "res-123"
    assert p.wizard_status == "ready"


def test_upsert_inside_transaction_rolls_back_on_error(tmp_path):
    conn = _migrated_conn(tmp_path)
    with pytest.raises(RuntimeError):
        with transaction(conn):
            upsert_project(conn, project_id="p", space_url="x.com", auth_token="t")
            raise RuntimeError("boom")
    assert get_project(conn, "p") is None
