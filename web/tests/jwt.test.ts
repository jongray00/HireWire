import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
	COOKIE_NAME,
	JwtError,
	buildLogoutCookie,
	buildSessionCookie,
	readSessionCookie,
	signSession,
	verifySession,
} from '@/lib/jwt';

beforeEach(() => {
	process.env.JWT_SECRET = 'a'.repeat(48);
});

afterEach(() => {
	delete process.env.JWT_SECRET;
});

describe('signSession / verifySession', () => {
	test('round-trips claims', () => {
		const token = signSession('proj-1');
		const claims = verifySession(token);
		expect(claims.sub).toBe('proj-1');
		expect(claims.iat).toBeLessThanOrEqual(claims.exp);
	});

	test('respects custom TTL', () => {
		const now = 1_000_000;
		const token = signSession('proj-1', { ttlSeconds: 3600, now });
		const claims = verifySession(token, { now: now + 1 });
		expect(claims.exp - claims.iat).toBe(3600);
	});

	test('rejects expired tokens', () => {
		const now = 1_000_000;
		const token = signSession('proj-1', { ttlSeconds: 60, now });
		expect(() => verifySession(token, { now: now + 61 })).toThrow(/expired/);
	});

	test('rejects tokens with tampered payload', () => {
		const token = signSession('proj-1');
		const parts = token.split('.');
		// Mutate the payload segment so signature no longer matches
		parts[1] = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
		expect(() => verifySession(parts.join('.'))).toThrow(/signature/);
	});

	test('rejects tokens with wrong signature', () => {
		const token = signSession('proj-1');
		const tampered = token.slice(0, -3) + 'AAA';
		expect(() => verifySession(tampered)).toThrow(JwtError);
	});

	test('rejects malformed tokens', () => {
		expect(() => verifySession('not.a.jwt')).toThrow();
		expect(() => verifySession('only-two.parts')).toThrow(/malformed/);
		expect(() => verifySession('')).toThrow();
	});

	test('signSession requires projectId', () => {
		expect(() => signSession('')).toThrow(JwtError);
	});

	test('throws if JWT_SECRET is missing', () => {
		delete process.env.JWT_SECRET;
		expect(() => signSession('p')).toThrow(/JWT_SECRET/);
	});

	test('throws if JWT_SECRET is too short', () => {
		process.env.JWT_SECRET = 'short';
		expect(() => signSession('p')).toThrow(/JWT_SECRET/);
	});

	test('signature does not validate under a different secret', () => {
		const token = signSession('proj-1');
		process.env.JWT_SECRET = 'b'.repeat(48);
		expect(() => verifySession(token)).toThrow(/signature/);
	});
});

describe('cookie helpers', () => {
	test('buildSessionCookie sets HttpOnly + SameSite=Strict + Secure by default', () => {
		const cookie = buildSessionCookie('TOKEN');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Strict');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain(`${COOKIE_NAME}=TOKEN`);
		expect(cookie).toContain('Path=/');
	});

	test('buildSessionCookie can disable Secure for local dev', () => {
		const cookie = buildSessionCookie('TOKEN', { secure: false });
		expect(cookie).not.toContain('Secure');
	});

	test('buildLogoutCookie clears the cookie', () => {
		const cookie = buildLogoutCookie();
		expect(cookie).toContain(`${COOKIE_NAME}=`);
		expect(cookie).toContain('Max-Age=0');
	});

	test('readSessionCookie extracts the token', () => {
		const header = `other=x; ${COOKIE_NAME}=ABC.DEF.GHI; another=y`;
		expect(readSessionCookie(header)).toBe('ABC.DEF.GHI');
	});

	test('readSessionCookie returns null for empty/missing', () => {
		expect(readSessionCookie(null)).toBeNull();
		expect(readSessionCookie('foo=bar')).toBeNull();
	});
});
