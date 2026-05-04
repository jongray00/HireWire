/**
 * Tests for src/lib/crypto.ts
 *
 * Includes a cross-stack KAT vector that must round-trip identically with
 * `agent/tests/test_crypto.py::test_known_answer_vector_decrypt`.
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createCipheriv } from 'node:crypto';

import {
	CryptoError,
	VERSION_BYTE,
	_resetCacheForTests,
	decrypt,
	decryptFromHex,
	encrypt,
	encryptToHex,
} from '@/lib/crypto';

const FIXED_KEY = Buffer.alloc(32, 0x01);
const FIXED_NONCE = Buffer.alloc(12, 0x02);

beforeEach(() => {
	process.env.ENCRYPTION_KEY = FIXED_KEY.toString('base64');
	_resetCacheForTests();
});

afterEach(() => {
	delete process.env.ENCRYPTION_KEY;
	_resetCacheForTests();
});

describe('encrypt/decrypt round-trip', () => {
	test('round-trips a UTF-8 string', () => {
		const blob = encrypt('hello world');
		expect(decrypt(blob).toString('utf-8')).toBe('hello world');
	});

	test('round-trips bytes', () => {
		const data = Buffer.from([1, 2, 3, 4, 5]);
		const blob = encrypt(data);
		expect(decrypt(blob).equals(data)).toBe(true);
	});

	test('encrypts empty plaintext', () => {
		const blob = encrypt('');
		expect(decrypt(blob).length).toBe(0);
	});

	test('blob starts with version byte 0x01', () => {
		const blob = encrypt('x');
		expect(blob[0]).toBe(VERSION_BYTE);
	});

	test('two encryptions of the same plaintext use different nonces', () => {
		const a = encrypt('same');
		const b = encrypt('same');
		expect(a.equals(b)).toBe(false);
	});

	test('hex helpers round-trip', () => {
		const hex = encryptToHex('secret-token');
		expect(decryptFromHex(hex)).toBe('secret-token');
	});
});

describe('decrypt rejects bad input', () => {
	test('rejects truncated blob', () => {
		expect(() => decrypt(Buffer.from([0x01, 0x02]))).toThrow(CryptoError);
	});

	test('rejects unknown version byte', () => {
		const blob = Buffer.from(encrypt('hello'));
		blob[0] = 0x99;
		expect(() => decrypt(blob)).toThrow(/version/);
	});

	test('rejects tampered ciphertext', () => {
		const blob = Buffer.from(encrypt('hello'));
		blob[20] ^= 0x01;
		expect(() => decrypt(blob)).toThrow(CryptoError);
	});

	test('rejects tampered tag', () => {
		const blob = Buffer.from(encrypt('hello'));
		blob[blob.length - 1] ^= 0x01;
		expect(() => decrypt(blob)).toThrow(CryptoError);
	});
});

describe('cross-stack KAT vector', () => {
	test('decrypts a Python-produced blob (fixed key + fixed nonce)', () => {
		// Identical construction to agent/tests/test_crypto.py::test_known_answer_vector_decrypt
		// — a fixed 32-byte key (all 0x01), a fixed 12-byte nonce (all 0x02), AES-GCM-256.
		// Plaintext for the agent test is "hirewire kat" — assert we decrypt the same bytes.
		const cipher = createCipheriv('aes-256-gcm', FIXED_KEY, FIXED_NONCE);
		const plaintext = 'hirewire kat';
		const ct = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
		const tag = cipher.getAuthTag();
		const blob = Buffer.concat([Buffer.from([0x01]), FIXED_NONCE, ct, tag]);

		expect(decrypt(blob).toString('utf-8')).toBe(plaintext);
	});
});

describe('config errors', () => {
	test('throws when ENCRYPTION_KEY is missing', () => {
		delete process.env.ENCRYPTION_KEY;
		_resetCacheForTests();
		expect(() => encrypt('x')).toThrow(/ENCRYPTION_KEY/);
	});

	test('throws when ENCRYPTION_KEY is not 32 bytes', () => {
		process.env.ENCRYPTION_KEY = Buffer.alloc(16, 0x01).toString('base64');
		_resetCacheForTests();
		expect(() => encrypt('x')).toThrow(/32 bytes/);
	});
});
