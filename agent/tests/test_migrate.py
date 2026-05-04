from agent.lib.db import open_connection
from agent.lib.migrate import run_migrations, MIGRATIONS_DIR


def test_first_run_applies_all_migrations(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    applied = run_migrations(conn)
    assert applied
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    names = {r[0] for r in rows}
    expected = {
        "projects", "employees", "documents", "calls", "customers",
        "audit_log", "schema_migrations",
    }
    assert expected.issubset(names)


def test_second_run_is_a_noop(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    run_migrations(conn)
    again = run_migrations(conn)
    assert again == []


def test_schema_migrations_records_version(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    run_migrations(conn)
    versions = [r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()]
    assert 1 in versions
