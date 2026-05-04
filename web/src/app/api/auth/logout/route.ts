/**
 * POST /api/auth/logout — clears the HireWire session cookie.
 */
import { handleLogout } from '@/lib/auth-handlers';

export async function POST() {
	const result = handleLogout({
		cookieSecure: process.env.ALLOW_HTTP_URLS !== '1',
	});
	return new Response(JSON.stringify(result.body), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': result.setCookie,
		},
	});
}
