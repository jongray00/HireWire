import { describe, expect, test } from 'vitest';

import { RateLimiter, rateLimitKey } from '@/lib/rate-limit';

describe('RateLimiter', () => {
	test('allows up to max within window', () => {
		const limiter = new RateLimiter({ max: 3, windowSeconds: 60 });
		const r1 = limiter.check('k');
		const r2 = limiter.check('k');
		const r3 = limiter.check('k');
		expect([r1.allowed, r2.allowed, r3.allowed]).toEqual([true, true, true]);
		expect(r3.remaining).toBe(0);
	});

	test('blocks after exceeding max', () => {
		const limiter = new RateLimiter({ max: 2, windowSeconds: 60 });
		limiter.check('k');
		limiter.check('k');
		const blocked = limiter.check('k');
		expect(blocked.allowed).toBe(false);
		expect(blocked.resetSeconds).toBeGreaterThan(0);
	});

	test('isolates buckets by key', () => {
		const limiter = new RateLimiter({ max: 1, windowSeconds: 60 });
		expect(limiter.check('a').allowed).toBe(true);
		expect(limiter.check('b').allowed).toBe(true);
		expect(limiter.check('a').allowed).toBe(false);
		expect(limiter.check('b').allowed).toBe(false);
	});

	test('drops hits outside window', () => {
		let now = 1_000_000;
		const limiter = new RateLimiter({
			max: 2,
			windowSeconds: 10,
			now: () => now,
		});
		limiter.check('k'); // t=0
		limiter.check('k'); // t=0
		expect(limiter.check('k').allowed).toBe(false);
		// Advance past window
		now += 11_000;
		expect(limiter.check('k').allowed).toBe(true);
	});
});

describe('rateLimitKey', () => {
	test('uses X-Forwarded-For first IP', () => {
		const req = new Request('http://x', {
			headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
		});
		expect(rateLimitKey(req)).toBe('1.2.3.4');
	});

	test('falls back to X-Real-IP', () => {
		const req = new Request('http://x', { headers: { 'x-real-ip': '9.9.9.9' } });
		expect(rateLimitKey(req)).toBe('9.9.9.9');
	});

	test('falls back to unknown', () => {
		const req = new Request('http://x');
		expect(rateLimitKey(req)).toBe('unknown');
	});
});
