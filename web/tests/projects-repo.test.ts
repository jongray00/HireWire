import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { _resetCacheForTests } from '@/lib/crypto';
import {
	disableProject,
	getDecryptedAuthToken,
	getDecryptedWebhookPassword,
	getProject,
	listProjects,
	setWizardResource,
	upsertProject,
} from '@/lib/projects-repo';

let dataDir: string;
let db: Database.Database;

const SCHEMA_SQL = `
CREATE TABLE projects (
  id                   TEXT PRIMARY KEY,
  space_url            TEXT NOT NULL,
  auth_token_enc       BLOB NOT NULL,
  webhook_password_enc BLOB NOT NULL,
  display_name         TEXT,
  auth_scope           TEXT NOT NULL DEFAULT 'unknown',
  wizard_resource_id   TEXT,
  wizard_status        TEXT NOT NULL DEFAULT 'pending',
  first_seen_at        INTEGER NOT NULL,
  last_login_at        INTEGER NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active'
);
`;

beforeEach(() => {
	dataDir = mkdtempSync(join(tmpdir(), 'hirewire-test-'));
	process.env.DATA_DIR = dataDir;
	process.env.ENCRYPTION_KEY = Buffer.alloc(32, 0x01).toString('base64');
	_resetCacheForTests();

	db = new Database(':memory:');
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	db.exec(SCHEMA_SQL);
});

afterEach(() => {
	if (db) db.close();
	if (dataDir) rmSync(dataDir, { recursive: true, force: true });
	delete process.env.DATA_DIR;
	delete process.env.ENCRYPTION_KEY;
	_resetCacheForTests();
});

describe('upsertProject', () => {
	test('inserts a new project on first call', () => {
		const p = upsertProject(
			{
				projectId: 'proj-1',
				spaceUrl: 'acme.signalwire.com',
				authToken: 'PT_secret',
				displayName: 'Acme',
			},
			db,
		);
		expect(p.id).toBe('proj-1');
		expect(p.space_url).toBe('acme.signalwire.com');
		expect(p.display_name).toBe('Acme');
		expect(p.status).toBe('active');
		expect(p.first_seen_at).toBe(p.last_login_at);
		expect(p.wizard_status).toBe('pending');
	});

	test('encrypts auth_token at rest', () => {
		upsertProject(
			{ projectId: 'p', spaceUrl: 'x.com', authToken: 'PT_secret' },
			db,
		);
		const row = db
			.prepare('SELECT auth_token_enc FROM projects WHERE id = ?')
			.get('p') as { auth_token_enc: Buffer };
		expect(row.auth_token_enc.includes(Buffer.from('PT_secret'))).toBe(false);
		expect(getDecryptedAuthToken('p', db)).toBe('PT_secret');
	});

	test('generates a webhook password on insert', () => {
		upsertProject({ projectId: 'p', spaceUrl: 'x', authToken: 't' }, db);
		const pw = getDecryptedWebhookPassword('p', db);
		expect(pw).not.toBeNull();
		expect(pw!.length).toBeGreaterThanOrEqual(30);
	});

	test('upsert rotates webhook password on re-login', () => {
		upsertProject({ projectId: 'p', spaceUrl: 'x', authToken: 't1' }, db);
		const pw1 = getDecryptedWebhookPassword('p', db);
		upsertProject({ projectId: 'p', spaceUrl: 'x', authToken: 't2' }, db);
		const pw2 = getDecryptedWebhookPassword('p', db);
		expect(pw1).not.toEqual(pw2);
		expect(getDecryptedAuthToken('p', db)).toBe('t2');
	});

	test('preserves first_seen_at across re-login', async () => {
		const p1 = upsertProject(
			{ projectId: 'p', spaceUrl: 'x', authToken: 't' },
			db,
		);
		await new Promise((r) => setTimeout(r, 1100));
		const p2 = upsertProject(
			{ projectId: 'p', spaceUrl: 'x', authToken: 't' },
			db,
		);
		expect(p2.first_seen_at).toBe(p1.first_seen_at);
		expect(p2.last_login_at).toBeGreaterThan(p1.last_login_at);
	});
});

describe('reads', () => {
	test('getProject returns null for missing', () => {
		expect(getProject('missing', db)).toBeNull();
	});

	test('listProjects skips disabled by default', () => {
		upsertProject({ projectId: 'a', spaceUrl: 'x', authToken: 't' }, db);
		upsertProject({ projectId: 'b', spaceUrl: 'x', authToken: 't' }, db);
		disableProject('b', db);
		const ids = listProjects({}, db).map((p) => p.id);
		expect(ids).toEqual(['a']);
	});

	test('decrypt helpers return null for disabled projects', () => {
		upsertProject({ projectId: 'p', spaceUrl: 'x', authToken: 't' }, db);
		disableProject('p', db);
		expect(getDecryptedAuthToken('p', db)).toBeNull();
		expect(getDecryptedWebhookPassword('p', db)).toBeNull();
	});
});

describe('setWizardResource', () => {
	test('updates resource id + status', () => {
		upsertProject({ projectId: 'p', spaceUrl: 'x', authToken: 't' }, db);
		setWizardResource('p', { resourceId: 'res-1', status: 'ready' }, db);
		const after = getProject('p', db)!;
		expect(after.wizard_resource_id).toBe('res-1');
		expect(after.wizard_status).toBe('ready');
	});
});
