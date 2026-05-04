/**
 * Connection helper for the SHARED multi-tenant SQLite DB.
 *
 * This is the same file the Python agent reads/writes (see
 * `agent/lib/db.py`). The schema is owned by the agent's migration runner
 * (`agent/migrations/001_initial_schema.sql`); the web layer is a
 * reader/writer over it.
 *
 * Distinct from `web/src/lib/db.ts`, which manages the legacy
 * `web/data/sally_sales.db` schema. The two databases coexist during the
 * Phase 3 migration; new code should use this module.
 */
import Database, { type Database as DB } from 'better-sqlite3';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

let _conn: DB | null = null;

export function dbPath(): string {
	const dir = process.env.DATA_DIR;
	if (!dir) {
		throw new Error('DATA_DIR env var is not set (multi-tenant DB)');
	}
	return join(dir, 'hirewire.db');
}

export function getMultiTenantDb(): DB {
	if (_conn) return _conn;
	const path = dbPath();
	const parent = dirname(path);
	if (!existsSync(parent)) {
		mkdirSync(parent, { recursive: true, mode: 0o700 });
	}
	const conn = new Database(path);
	conn.pragma('journal_mode = WAL');
	conn.pragma('foreign_keys = ON');
	conn.pragma('busy_timeout = 5000');
	conn.pragma('synchronous = NORMAL');
	_conn = conn;
	return conn;
}

/** Test-only: close the cached connection so the next call reopens. */
export function _resetConnectionForTests(): void {
	if (_conn) {
		_conn.close();
		_conn = null;
	}
}

/** Verify the schema the agent's migration runner produces is in place. */
export function assertSchemaIsMigrated(db: DB = getMultiTenantDb()): void {
	const row = db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
		)
		.get();
	if (!row) {
		throw new Error(
			'projects table not found — run the agent migration runner first (python -c "from agent.lib.db import open_connection; from agent.lib.migrate import run_migrations; from agent.lib.config import Config; conn = open_connection(Config.load().db_path); run_migrations(conn)")',
		);
	}
}
