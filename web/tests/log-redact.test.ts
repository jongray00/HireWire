import { describe, expect, test } from 'vitest';

import { redactObject, redactValue } from '@/lib/log-redact';

describe('redactValue', () => {
	test('redacts sensitive keys', () => {
		expect(redactValue('auth_token', 'abc')).toBe('<redacted>');
		expect(redactValue('password', 'p')).toBe('<redacted>');
		expect(redactValue('api_key', 'k')).toBe('<redacted>');
	});

	test('masks phone numbers', () => {
		expect(redactValue('caller_number', '+15551234567')).toBe('+****4567');
		expect(redactValue('phone_number', '12')).toBe('+****');
	});

	test('masks emails', () => {
		expect(redactValue('email', 'alice@example.com')).toBe('a****@****.com');
	});

	test('replaces blob fields with size hint', () => {
		expect(redactValue('transcript', 'x'.repeat(500))).toBe('<encrypted, 500 bytes>');
	});

	test('preserves unknown keys', () => {
		expect(redactValue('event', 'login')).toBe('login');
		expect(redactValue('count', 42)).toBe(42);
	});

	test('recurses into nested objects', () => {
		const out = redactValue('headers', { Authorization: 'Bearer xyz' }) as Record<
			string,
			unknown
		>;
		expect(out.Authorization).toBe('<redacted>');
	});

	test('recurses into arrays only when key is not a sensitive type', () => {
		// Mirrors agent/lib/log_redact.py — for sensitive keys (phone, email, etc.)
		// the masker runs on the whole value (here: the stringified array), not on
		// individual elements. Use the array path only for non-sensitive keys.
		const out = redactValue('items', [
			{ caller_number: '+15551234567' },
			{ caller_number: '12' },
		]) as Array<{ caller_number: string }>;
		expect(out[0].caller_number).toBe('+****4567');
		expect(out[1].caller_number).toBe('+****');
	});
});

describe('redactObject', () => {
	test('redacts a flat object', () => {
		const out = redactObject({ msg: 'ok', auth_token: 'abc' });
		expect(out).toEqual({ msg: 'ok', auth_token: '<redacted>' });
	});

	test('redacts a nested object', () => {
		const out = redactObject({
			req: {
				headers: { Authorization: 'Bearer abc' },
				body: { caller_number: '+15551234567' },
			},
		});
		expect((out.req as any).headers.Authorization).toBe('<redacted>');
		expect((out.req as any).body.caller_number).toBe('+****4567');
	});
});
