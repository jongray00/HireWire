import sqlite3
from pathlib import Path
from agent.lib.db import open_connection, transaction


def test_open_connection_creates_file_with_0o600(tmp_path):
    db_path = tmp_path / "x.db"
    conn = open_connection(db_path)
    try:
        assert db_path.exists()
        mode = db_path.stat().st_mode & 0o777
        assert mode == 0o600
    finally:
        conn.close()


def test_pragmas_applied(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    try:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    finally:
        conn.close()


def test_transaction_commits_on_success(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    try:
        conn.execute("CREATE TABLE t(v INTEGER)")
        with transaction(conn):
            conn.execute("INSERT INTO t VALUES (1)")
        assert conn.execute("SELECT v FROM t").fetchone()[0] == 1
    finally:
        conn.close()


def test_transaction_rolls_back_on_exception(tmp_path):
    conn = open_connection(tmp_path / "x.db")
    conn.execute("CREATE TABLE t(v INTEGER)")
    try:
        with transaction(conn):
            conn.execute("INSERT INTO t VALUES (1)")
            raise RuntimeError("boom")
    except RuntimeError:
        pass
    assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 0
    conn.close()
