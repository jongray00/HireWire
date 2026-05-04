/**
 * HS256 session JWTs for the HireWire web app.
 *
 * Subject is the SignalWire project_id; the cookie carries no other identity.
 * Default lifetime is 24h; on expiry the user re-logs in (which also rotates
 * the per-project webhook password).
 *
 * Implemented with Node's built-in `crypto` (HMAC-SHA256) — no external
 * dependency, so this is portable to the Hono server runtime.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours
export const COOKIE_NAME = 'hirewire_session';

export class JwtError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'JwtError';
	}
}

export interface SessionClaims {
	sub: string; // project_id
	iat: number; // issued-at, epoch seconds
	exp: number; // expires-at, epoch seconds
}

function loadSecret(): Buffer {
	const raw = process.env.JWT_SECRET;
	if (!raw || raw.length < 32) {
		throw new JwtError('JWT_SECRET must be set and at least 32 chars');
	}
	return Buffer.from(raw, 'utf-8');
}

function b64urlEncode(buf: Buffer | string): string {
	const b = typeof buf === 'string' ? Buffer.from(buf, 'utf-8') : buf;
	return b
		.toString('base64')
		.replace(/=+$/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

function b64urlDecode(s: string): Buffer {
	const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
	const std = padded.replace(/-/g, '+').replace(/_/g, '/');
	return Buffer.from(std, 'base64');
}

function sign(message: string, secret: Buffer): string {
	const mac = createHmac('sha256', secret).update(message).digest();
	return b64urlEncode(mac);
}

export interface SignOptions {
	ttlSeconds?: number;
	now?: number;
}

export function signSession(projectId: string, opts: SignOptions = {}): string {
	if (!projectId) throw new JwtError('projectId is required');
	const now = opts.now ?? Math.floor(Date.now() / 1000);
	const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;

	const header = { alg: 'HS256', typ: 'JWT' };
	const claims: SessionClaims = {
		sub: projectId,
		iat: now,
		exp: now + ttl,
	};
	const segH = b64urlEncode(JSON.stringify(header));
	const segP = b64urlEncode(JSON.stringify(claims));
	const signature = sign(`${segH}.${segP}`, loadSecret());
	return `${segH}.${segP}.${signature}`;
}

export function verifySession(
	token: string,
	opts: { now?: number } = {},
): SessionClaims {
	if (!token || typeof token !== 'string') {
		throw new JwtError('missing or invalid token');
	}
	const parts = token.split('.');
	if (parts.length !== 3) {
		throw new JwtError('malformed token');
	}
	const [segH, segP, segS] = parts;
	const expected = sign(`${segH}.${segP}`, loadSecret());
	const expectedBuf = Buffer.from(expected);
	const gotBuf = Buffer.from(segS);
	if (
		expectedBuf.length !== gotBuf.length ||
		!timingSafeEqual(expectedBuf, gotBuf)
	) {
		throw new JwtError('signature mismatch');
	}
	let header: { alg?: string; typ?: string };
	let claims: SessionClaims;
	try {
		header = JSON.parse(b64urlDecode(segH).toString('utf-8'));
		claims = JSON.parse(b64urlDecode(segP).toString('utf-8'));
	} catch {
		throw new JwtError('malformed payload');
	}
	if (header.alg !== 'HS256') {
		throw new JwtError(`unsupported alg ${header.alg}`);
	}
	if (!claims.sub || typeof claims.sub !== 'string') {
		throw new JwtError('missing sub claim');
	}
	if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number') {
		throw new JwtError('missing iat/exp claims');
	}
	const now = opts.now ?? Math.floor(Date.now() / 1000);
	if (claims.exp < now) {
		throw new JwtError('token expired');
	}
	return claims;
}

export interface CookieOptions {
	secure?: boolean; // default: true
	maxAge?: number; // default: DEFAULT_TTL_SECONDS
	path?: string; // default: '/'
	domain?: string;
}

/** Build a Set-Cookie header value carrying the session JWT. */
export function buildSessionCookie(
	token: string,
	opts: CookieOptions = {},
): string {
	const secure = opts.secure ?? true;
	const maxAge = opts.maxAge ?? DEFAULT_TTL_SECONDS;
	const path = opts.path ?? '/';
	const parts = [
		`${COOKIE_NAME}=${token}`,
		`Path=${path}`,
		`Max-Age=${maxAge}`,
		'HttpOnly',
		'SameSite=Strict',
	];
	if (secure) parts.push('Secure');
	if (opts.domain) parts.push(`Domain=${opts.domain}`);
	return parts.join('; ');
}

/** Build a Set-Cookie header value that immediately clears the session. */
export function buildLogoutCookie(opts: CookieOptions = {}): string {
	const secure = opts.secure ?? true;
	const path = opts.path ?? '/';
	const parts = [
		`${COOKIE_NAME}=`,
		`Path=${path}`,
		'Max-Age=0',
		'HttpOnly',
		'SameSite=Strict',
	];
	if (secure) parts.push('Secure');
	if (opts.domain) parts.push(`Domain=${opts.domain}`);
	return parts.join('; ');
}

/** Read the session JWT from a Cookie header. */
export function readSessionCookie(cookieHeader: string | null): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const [k, ...rest] = part.trim().split('=');
		if (k === COOKIE_NAME) return rest.join('=');
	}
	return null;
}
