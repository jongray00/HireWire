/**
 * GET /api/auth/me
 *
 * Inspects the session JWT cookie and returns the authenticated project_id,
 * or 401 if the cookie is missing/expired/tampered. The dashboard layout
 * polls this on mount to enforce the cookie-based session.
 */
import { JwtError, readSessionCookie, verifySession } from '@/lib/jwt';

export async function GET(request: Request) {
	const token = readSessionCookie(request.headers.get('cookie'));
	if (!token) {
		return json(401, { ok: false, error: 'no session' });
	}
	try {
		const claims = verifySession(token);
		return json(200, {
			ok: true,
			project_id: claims.sub,
			expires_at: claims.exp,
		});
	} catch (e) {
		if (e instanceof JwtError) {
			return json(401, { ok: false, error: e.message });
		}
		return json(500, { ok: false, error: 'session check failed' });
	}
}

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}
