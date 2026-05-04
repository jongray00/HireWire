/**
 * CRUD over the multi-tenant `projects` table.
 *
 * Mirrors `agent/lib/projects_repo.py` semantics: project_id is the SignalWire
 * project ID; webhook basic-auth username equals project_id; webhook password
 * is generated per-project, AES-GCM encrypted at rest. Re-login (`upsertProject`
 * with an existing id) rotates the webhook password.
 */
import { randomBytes } from 'node:crypto';

import { decrypt, encrypt } from './crypto';
import { getMultiTenantDb } from './multi-tenant-db';
import type { Database as DB } from 'better-sqlite3';

export interface Project {
	id: string;
	space_url: string;
	display_name: string | null;
	auth_scope: string;
	wizard_resource_id: string | null;
	wizard_status: string;
	first_seen_at: number;
	last_login_at: number;
	status: string;
}

interface ProjectRow extends Project {
	auth_token_enc: Buffer;
	webhook_password_enc: Buffer;
}

function rowToProject(row: ProjectRow): Project {
	return {
		id: row.id,
		space_url: row.space_url,
		display_name: row.display_name,
		auth_scope: row.auth_scope,
		wizard_resource_id: row.wizard_resource_id,
		wizard_status: row.wizard_status,
		first_seen_at: row.first_seen_at,
		last_login_at: row.last_login_at,
		status: row.status,
	};
}

export interface UpsertProjectInput {
	projectId: string;
	spaceUrl: string;
	authToken: string;
	displayName?: string | null;
	authScope?: string;
}

export function upsertProject(
	input: UpsertProjectInput,
	db: DB = getMultiTenantDb(),
): Project {
	const now = Math.floor(Date.now() / 1000);
	const authTokenEnc = encrypt(input.authToken);
	const webhookPasswordEnc = encrypt(randomBytes(32).toString('base64url'));
	const authScope = input.authScope ?? 'unknown';
	const displayName = input.displayName ?? null;

	const existing = db
		.prepare('SELECT id FROM projects WHERE id = ?')
		.get(input.projectId);

	if (!existing) {
		db.prepare(
			`INSERT INTO projects
        (id, space_url, auth_token_enc, webhook_password_enc, display_name,
         auth_scope, first_seen_at, last_login_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
		).run(
			input.projectId,
			input.spaceUrl,
			authTokenEnc,
			webhookPasswordEnc,
			displayName,
			authScope,
			now,
			now,
		);
	} else {
		db.prepare(
			`UPDATE projects SET
         space_url = ?,
         auth_token_enc = ?,
         webhook_password_enc = ?,
         display_name = COALESCE(?, display_name),
         auth_scope = ?,
         last_login_at = ?
       WHERE id = ?`,
		).run(
			input.spaceUrl,
			authTokenEnc,
			webhookPasswordEnc,
			displayName,
			authScope,
			now,
			input.projectId,
		);
	}

	const row = db
		.prepare('SELECT * FROM projects WHERE id = ?')
		.get(input.projectId) as ProjectRow;
	return rowToProject(row);
}

export function getProject(
	projectId: string,
	db: DB = getMultiTenantDb(),
): Project | null {
	const row = db
		.prepare('SELECT * FROM projects WHERE id = ?')
		.get(projectId) as ProjectRow | undefined;
	return row ? rowToProject(row) : null;
}

export function listProjects(
	options: { status?: string } = {},
	db: DB = getMultiTenantDb(),
): Project[] {
	const status = options.status ?? 'active';
	const rows = db
		.prepare(
			'SELECT * FROM projects WHERE status = ? ORDER BY last_login_at DESC',
		)
		.all(status) as ProjectRow[];
	return rows.map(rowToProject);
}

export function getDecryptedAuthToken(
	projectId: string,
	db: DB = getMultiTenantDb(),
): string | null {
	const row = db
		.prepare(
			"SELECT auth_token_enc FROM projects WHERE id = ? AND status = 'active'",
		)
		.get(projectId) as { auth_token_enc: Buffer } | undefined;
	if (!row) return null;
	return decrypt(row.auth_token_enc).toString('utf-8');
}

export function getDecryptedWebhookPassword(
	projectId: string,
	db: DB = getMultiTenantDb(),
): string | null {
	const row = db
		.prepare(
			"SELECT webhook_password_enc FROM projects WHERE id = ? AND status = 'active'",
		)
		.get(projectId) as { webhook_password_enc: Buffer } | undefined;
	if (!row) return null;
	return decrypt(row.webhook_password_enc).toString('utf-8');
}

export function setWizardResource(
	projectId: string,
	input: { resourceId: string; status?: string },
	db: DB = getMultiTenantDb(),
): void {
	db.prepare(
		'UPDATE projects SET wizard_resource_id = ?, wizard_status = ? WHERE id = ?',
	).run(input.resourceId, input.status ?? 'ready', projectId);
}

export function disableProject(
	projectId: string,
	db: DB = getMultiTenantDb(),
): void {
	db.prepare("UPDATE projects SET status = 'disabled' WHERE id = ?").run(
		projectId,
	);
}
