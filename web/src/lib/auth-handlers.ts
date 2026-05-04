/**
 * Pure handler logic for /api/auth/login and /api/auth/logout, factored out so
 * we can unit-test without spinning up the full router runtime.
 *
 * The login flow:
 *   1. validate inputs
 *   2. call agent /api/auth/validate-credentials
 *   3. call signalwire-provisioning to ensure SWML resources exist
 *   4. upsert the projects row (encrypts API token + webhook password)
 *   5. mint JWT, return Set-Cookie header
 *
 * Failures aborts the entire flow — no half-state in the DB.
 */
import { buildLogoutCookie, buildSessionCookie, signSession } from './jwt';
import { upsertProject } from './projects-repo';
import {
	SignalWireProvisioningError,
	provisionForLogin,
} from './signalwire-provisioning';
import type { Database as DB } from 'better-sqlite3';

export interface LoginInput {
	spaceUrl: string;
	projectId: string;
	apiToken: string;
}

export interface LoginEnv {
	agentBaseUrl: string;
	agentApiKey: string;
	publicBaseUrlAgent: string;
	jwtSecret: string;
	cookieSecure?: boolean;
}

export interface LoginOk {
	status: 200;
	body: { ok: true; project_id: string };
	setCookie: string;
}
export interface LoginFail {
	status: number;
	body: { ok: false; error: string };
}
export type LoginResult = LoginOk | LoginFail;

const TIMEOUT_MS = 10_000;

async function callAgentValidate(
	env: LoginEnv,
	input: LoginInput,
): Promise<{ valid: boolean; status: number }> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	let res: Response;
	try {
		res = await fetch(`${env.agentBaseUrl}/api/auth/validate-credentials`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Agent-API-Key': env.agentApiKey,
			},
			body: JSON.stringify({
				space_url: input.spaceUrl,
				project_id: input.projectId,
				api_token: input.apiToken,
			}),
			signal: ctrl.signal,
		});
	} finally {
		clearTimeout(timer);
	}
	if (res.status === 200) {
		const body = (await res.json()) as { valid: boolean };
		return { valid: !!body.valid, status: 200 };
	}
	return { valid: false, status: res.status };
}

export async function handleLogin(
	input: LoginInput,
	env: LoginEnv,
	db: DB,
): Promise<LoginResult> {
	if (!input.spaceUrl || !input.projectId || !input.apiToken) {
		return { status: 400, body: { ok: false, error: 'missing field' } };
	}
	if (input.apiToken.length < 8 || input.projectId.length < 8) {
		return { status: 400, body: { ok: false, error: 'invalid input' } };
	}

	// 1. validate creds
	let validation: { valid: boolean; status: number };
	try {
		validation = await callAgentValidate(env, input);
	} catch (e) {
		return {
			status: 502,
			body: { ok: false, error: 'agent unreachable' },
		};
	}
	if (!validation.valid) {
		const status = validation.status === 200 ? 401 : validation.status;
		return {
			status: status === 401 || status === 403 ? 401 : 502,
			body: { ok: false, error: 'invalid signalwire credentials' },
		};
	}

	// Generate the webhook password ourselves so we know its plaintext;
	// projects-repo upsert generates AND stores its own random one. To avoid
	// mismatch with what we send to SignalWire, we run upsert FIRST and then
	// read back the plaintext.
	const project = upsertProject(
		{
			projectId: input.projectId,
			spaceUrl: input.spaceUrl,
			authToken: input.apiToken,
			authScope: 'project',
		},
		db,
	);

	const { getDecryptedWebhookPassword } = await import('./projects-repo');
	const webhookPw = getDecryptedWebhookPassword(project.id, db);
	if (!webhookPw) {
		return {
			status: 500,
			body: { ok: false, error: 'webhook password unavailable' },
		};
	}

	// 2. provision SignalWire resources
	try {
		await provisionForLogin({
			credentials: {
				spaceUrl: input.spaceUrl,
				projectId: input.projectId,
				apiToken: input.apiToken,
			},
			publicBaseUrlAgent: env.publicBaseUrlAgent,
			webhookBasicAuthPassword: webhookPw,
		});
	} catch (e) {
		// Disable the project so a rogue half-provisioned tenant cannot proceed.
		const { disableProject } = await import('./projects-repo');
		disableProject(project.id, db);
		const sc = e instanceof SignalWireProvisioningError ? e.statusCode : 502;
		return {
			status: sc === 401 || sc === 403 ? 401 : 502,
			body: { ok: false, error: 'signalwire provisioning failed' },
		};
	}

	// 3. mint JWT + return cookie
	process.env.JWT_SECRET = env.jwtSecret; // jwt.ts reads from env
	const token = signSession(project.id);
	const setCookie = buildSessionCookie(token, { secure: env.cookieSecure });

	return {
		status: 200,
		body: { ok: true, project_id: project.id },
		setCookie,
	};
}

export function handleLogout(env: { cookieSecure?: boolean }): {
	status: 200;
	body: { ok: true };
	setCookie: string;
} {
	return {
		status: 200,
		body: { ok: true },
		setCookie: buildLogoutCookie({ secure: env.cookieSecure }),
	};
}
