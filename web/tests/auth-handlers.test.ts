import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { _resetCacheForTests } from '@/lib/crypto';
import {
	type LoginEnv,
	handleLogin,
	handleLogout,
} from '@/lib/auth-handlers';

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

let db: Database.Database;
let dataDir: string;

const ENV: LoginEnv = {
	agentBaseUrl: 'https://agent.test',
	agentApiKey: 'a'.repeat(48),
	publicBaseUrlAgent: 'https://agent.test',
	jwtSecret: 'b'.repeat(48),
	cookieSecure: true,
};

beforeEach(() => {
	dataDir = mkdtempSync(join(tmpdir(), 'hirewire-auth-'));
	process.env.DATA_DIR = dataDir;
	process.env.ENCRYPTION_KEY = Buffer.alloc(32, 0x01).toString('base64');
	process.env.JWT_SECRET = ENV.jwtSecret;
	_resetCacheForTests();
	db = new Database(':memory:');
	db.pragma('foreign_keys = ON');
	db.exec(SCHEMA_SQL);
});

afterEach(() => {
	if (db) db.close();
	if (dataDir) rmSync(dataDir, { recursive: true, force: true });
	vi.restoreAllMocks();
	delete process.env.DATA_DIR;
	delete process.env.ENCRYPTION_KEY;
	delete process.env.JWT_SECRET;
	_resetCacheForTests();
});

interface MockRoute {
	method: string;
	pattern: RegExp;
	respond: () => Response;
}

function mockFetch(routes: MockRoute[]): typeof fetch {
	const queue = [...routes];
	return vi.fn(async (url, init) => {
		const u = String(url);
		const m = (init?.method ?? 'GET').toUpperCase();
		for (let i = 0; i < queue.length; i++) {
			if (queue[i].method === m && queue[i].pattern.test(u)) {
				const r = queue.splice(i, 1)[0];
				return r.respond();
			}
		}
		return new Response('not mocked: ' + u, { status: 599 });
	}) as unknown as typeof fetch;
}

describe('handleLogin', () => {
	test('happy path: validate → provision → upsert → JWT cookie', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			mockFetch([
				{
					method: 'POST',
					pattern: /\/api\/auth\/validate-credentials$/,
					respond: () =>
						new Response(JSON.stringify({ valid: true, space_url: 'x' }), {
							status: 200,
						}),
				},
				{
					method: 'GET',
					pattern: /\/api\/fabric\/resources\?.*name=wizard-agent/,
					respond: () =>
						new Response(JSON.stringify({ data: [] }), { status: 200 }),
				},
				{
					method: 'POST',
					pattern: /\/api\/fabric\/resources$/,
					respond: () =>
						new Response(
							JSON.stringify({ id: 'wiz', name: 'wizard-agent', type: 'swml' }),
							{ status: 201 },
						),
				},
				{
					method: 'GET',
					pattern: /\/api\/fabric\/resources\?.*name=hirewire-agent/,
					respond: () =>
						new Response(JSON.stringify({ data: [] }), { status: 200 }),
				},
				{
					method: 'POST',
					pattern: /\/api\/fabric\/resources$/,
					respond: () =>
						new Response(
							JSON.stringify({ id: 'hw', name: 'hirewire-agent', type: 'swml' }),
							{ status: 201 },
						),
				},
			]),
		);

		const result = await handleLogin(
			{
				spaceUrl: 'acme.signalwire.com',
				projectId: 'proj-12345',
				apiToken: 'PT_token_xyz',
			},
			ENV,
			db,
		);
		expect(result.status).toBe(200);
		if (result.status !== 200) throw new Error('typeguard');
		expect(result.body).toEqual({ ok: true, project_id: 'proj-12345' });
		expect(result.setCookie).toContain('hirewire_session=');
		expect(result.setCookie).toContain('HttpOnly');
		expect(result.setCookie).toContain('SameSite=Strict');

		// Project row exists in DB
		const row = db
			.prepare('SELECT id, space_url FROM projects WHERE id = ?')
			.get('proj-12345');
		expect(row).toEqual({ id: 'proj-12345', space_url: 'acme.signalwire.com' });
	});

	test('rejects missing fields with 400', async () => {
		const r = await handleLogin(
			{ spaceUrl: '', projectId: '', apiToken: '' },
			ENV,
			db,
		);
		expect(r.status).toBe(400);
	});

	test('rejects too-short fields with 400', async () => {
		const r = await handleLogin(
			{ spaceUrl: 'x', projectId: 'p', apiToken: 't' },
			ENV,
			db,
		);
		expect(r.status).toBe(400);
	});

	test('returns 401 when agent reports invalid creds', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			mockFetch([
				{
					method: 'POST',
					pattern: /\/api\/auth\/validate-credentials$/,
					respond: () =>
						new Response(JSON.stringify({ valid: false }), { status: 200 }),
				},
			]),
		);
		const r = await handleLogin(
			{
				spaceUrl: 'acme.signalwire.com',
				projectId: 'proj-12345',
				apiToken: 'PT_token_xyz',
			},
			ENV,
			db,
		);
		expect(r.status).toBe(401);
		// No project row written
		expect(
			db.prepare('SELECT COUNT(*) AS n FROM projects').get(),
		).toEqual({ n: 0 });
	});

	test('returns 502 when agent is unreachable', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
			throw new Error('connect ECONNREFUSED');
		});
		const r = await handleLogin(
			{
				spaceUrl: 'acme.signalwire.com',
				projectId: 'proj-12345',
				apiToken: 'PT_token_xyz',
			},
			ENV,
			db,
		);
		expect(r.status).toBe(502);
	});

	test('disables project + 502 when provisioning fails', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			mockFetch([
				{
					method: 'POST',
					pattern: /\/api\/auth\/validate-credentials$/,
					respond: () =>
						new Response(JSON.stringify({ valid: true }), { status: 200 }),
				},
				{
					method: 'GET',
					pattern: /\/api\/fabric\/resources/,
					respond: () => new Response('boom', { status: 503 }),
				},
			]),
		);
		const r = await handleLogin(
			{
				spaceUrl: 'acme.signalwire.com',
				projectId: 'proj-12345',
				apiToken: 'PT_token_xyz',
			},
			ENV,
			db,
		);
		expect(r.status).toBe(502);
		// Project row exists but is disabled
		const row = db
			.prepare('SELECT status FROM projects WHERE id = ?')
			.get('proj-12345') as { status: string } | undefined;
		expect(row?.status).toBe('disabled');
	});
});

describe('handleLogout', () => {
	test('returns 200 + clears cookie', () => {
		const r = handleLogout({ cookieSecure: true });
		expect(r.status).toBe(200);
		expect(r.body).toEqual({ ok: true });
		expect(r.setCookie).toContain('Max-Age=0');
		expect(r.setCookie).toContain('HttpOnly');
	});
});
