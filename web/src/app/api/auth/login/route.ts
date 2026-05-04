/**
 * POST /api/auth/login
 *
 * Body: { spaceUrl, projectId, apiToken }
 *
 * On success: 200 + sets HttpOnly+Secure session cookie
 * On invalid creds: 401
 * On upstream/provisioning failure: 502
 */
import { handleLogin } from '@/lib/auth-handlers';
import { getMultiTenantDb } from '@/lib/multi-tenant-db';
import { loginLimiter, rateLimitKey } from '@/lib/rate-limit';

export async function POST(request: Request) {
	const limit = loginLimiter.check(rateLimitKey(request));
	if (!limit.allowed) {
		return new Response(
			JSON.stringify({ ok: false, error: 'too many attempts' }),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(limit.resetSeconds),
				},
			},
		);
	}
	const body = (await request.json().catch(() => null)) as {
		spaceUrl?: string;
		projectId?: string;
		apiToken?: string;
	} | null;
	if (!body) {
		return jsonResponse(400, { ok: false, error: 'invalid json body' });
	}
	const result = await handleLogin(
		{
			spaceUrl: body.spaceUrl ?? '',
			projectId: body.projectId ?? '',
			apiToken: body.apiToken ?? '',
		},
		{
			agentBaseUrl: requireEnv('AGENT_BASE_URL'),
			agentApiKey: requireEnv('AGENT_API_KEY'),
			publicBaseUrlAgent: requireEnv('PUBLIC_BASE_URL_AGENT'),
			jwtSecret: requireEnv('JWT_SECRET'),
			cookieSecure: process.env.ALLOW_HTTP_URLS !== '1',
		},
		getMultiTenantDb(),
	);
	if (result.status === 200) {
		return new Response(JSON.stringify(result.body), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Set-Cookie': result.setCookie,
			},
		});
	}
	return jsonResponse(result.status, result.body);
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} env var is required`);
	return v;
}
